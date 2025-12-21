const prisma = require("../config/db");
const cache = require("../utils/cache");

const { createTransaction } = require("./transactionService");
const userService = require("./userService");
const { emitNewOrder, emitOrderStatusUpdate } = require("../utils/socketEmitter");

// Get io instance - will be set by the controller
let ioInstance = null;
const setIoInstance = (io) => {
  ioInstance = io;
};

const submitCart = async (userId, mobileNumber = null) => {
  // Use a transaction to ensure atomicity
  return await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    // Calculate total order price
    const totalPrice = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    // Get user current balance
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.loanBalance < totalPrice) {
      throw new Error("Insufficient balance to place order");
    }

    // Set mobile number if provided
    if (mobileNumber && !cart.mobileNumber) {
      await tx.cart.update({
        where: { id: cart.id },
        data: { mobileNumber },
      });
    }

    // Create order
    const order = await tx.order.create({
      data: {
        userId,
        mobileNumber: cart.mobileNumber || mobileNumber,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            mobileNumber: item.mobileNumber,
            status: "Pending",
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    // Record transaction for the order
    // createTransaction must use the transaction-bound prisma
    await createTransaction(
      userId,
      -totalPrice, // Negative amount for deduction
      "ORDER",
      `Order #${order.id} placed with ${order.items.length} items`,
      `order:${order.id}`,
      tx // pass the transaction-bound prisma
    );

    // Clear cart (we already have the items in the order)
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return order;
  }).then(order => {
    // Emit socket event after transaction completes
    if (ioInstance) {
      emitNewOrder(ioInstance, order);
    }
    return order;
  });
};

async function getAllOrders(limit = 100, offset = 0) {
  // Fetch regular orders
  const orders = await prisma.order.findMany({
    take: Math.min(limit, 500), // Cap limit to prevent excessive memory usage
    skip: offset,
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      mobileNumber: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          mobileNumber: true,
          status: true,
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
            },
          },
        },
      },
    },
  });

  // Fetch shop orders
  const shopOrders = await prisma.shop.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  //console.log(`[OrderService] Found ${shopOrders.length} shop orders`);

  // Transform shop orders to match Order format
  const transformedShopOrders = shopOrders.map((shop) => {
    // Log each shop order to debug
    /* console.log(`[OrderService] Processing shop order ID ${shop.id}:`, {
      productName: shop.productName,
      productPrice: shop.productPrice,
      amount: shop.amount,
      fullName: shop.fullName,
      reference: shop.reference
    }); */

    const transformed = {
      id: `SHOP-${shop.id}`, // Prefix to distinguish from regular orders
      createdAt: shop.orderTime,
      status: shop.status || "Pending", // Use actual shop status from database (Pending, Processing, Completed)
      mobileNumber: shop.phoneNumber,
      user: {
        id: null,
        name: "shop", // Use "shop" as username to identify shop orders in frontend
        email: null,
        phone: shop.phoneNumber,
      },
      items: [
        {
          id: shop.id,
          productId: null,
          quantity: 1,
          mobileNumber: shop.phoneNumber,
          status: shop.status || "Pending", // Use actual shop status from database
          product: {
            id: null,
            name: shop.productName || "Shop Product",
            description: shop.productDescription || `Transaction: ${shop.reference}`,
            price: shop.productPrice || shop.amount,
          },
        },
      ],
    };

    /* console.log(`[OrderService] Transformed shop order ID ${shop.id}:`, {
      productName: transformed.items[0].product.name,
      productPrice: transformed.items[0].product.price,
      description: transformed.items[0].product.description
    }); */

    return transformed;
  });

  // Combine both order types and sort by date
  const allOrders = [...orders, ...transformedShopOrders].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  // Apply pagination to combined results
  const paginatedOrders = allOrders.slice(offset, offset + Math.min(limit, 500));
  
  // Get total count
  const totalCount = await prisma.order.count();
  const shopCount = await prisma.shop.count();
  const combinedCount = totalCount + shopCount;
  
  return {
    orders: paginatedOrders,
    totalCount: combinedCount,
    hasMore: (offset + limit) < combinedCount
  };
}

// Admin: Process and complete an order
const processOrder = async (orderId, status) => {
  const validStatuses = ["Pending", "Processing", "Completed"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid order status");
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: {
      user: true,
      items: { include: { product: true } }
    }
  });

  // Record transaction for status change
  await createTransaction(
    order.userId,
    0, // Zero amount for status change
    "ORDER_STATUS",
    `Order #${orderId} status changed to ${status}`,
    `order:${orderId}`
  );

  return order;
};

const processOrderItem = async (orderItemId, status) => {
  const validStatuses = ["Pending", "Processing", "Completed", "Cancelled", "Canceled"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid order status");
  }
  const orderItem = await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { status },
    include: { order: true, product: true }
  });

  // Auto-refund logic for cancelled/canceled
  if (["Cancelled", "Canceled"].includes(status)) {
    const refundAmount = orderItem.product.price * orderItem.quantity;
    const existingRefund = await prisma.transaction.findFirst({
      where: {
        userId: orderItem.order.userId,
        type: "ORDER_ITEM_REFUND",
        reference: `orderItem:${orderItemId}`
      }
    });
    if (!existingRefund) {
      // Refund user wallet and log transaction
      await createTransaction(
        orderItem.order.userId,
        refundAmount,
        "ORDER_ITEM_REFUND",
        `Order item #${orderItemId} (${orderItem.product.name}) refunded`,
        `orderItem:${orderItemId}`
      );
    }
  }

  await createTransaction(
    orderItem.order.userId,
    0,
    "ORDER_ITEM_STATUS",
    `Order item #${orderItemId} (${orderItem.product.name}) status changed to ${status}`,
    `orderItem:${orderItemId}`
  );
  return orderItem;
};

// ... (rest of the code remains the same)

const getOrderStatus = async (options = {}) => {
  const {
    page = 1,
    limit = 50,
    orderIdFilter,
    phoneNumberFilter,
    selectedProduct,
    selectedStatusMain,
    selectedDate,
    startTime,
    endTime,
    sortOrder = 'newest',
    showNewRequestsOnly = false
  } = options;

  // Build where clause for filtering
  const where = {};
  const itemsWhere = {};

  // Date filtering
  if (selectedDate) {
    const startDate = new Date(selectedDate);
    const endDate = new Date(selectedDate);
    endDate.setDate(endDate.getDate() + 1);
    
    if (startTime && endTime) {
      const startDateTime = new Date(`${selectedDate}T${startTime}`);
      const endDateTime = new Date(`${selectedDate}T${endTime}`);
      where.createdAt = {
        gte: startDateTime,
        lte: endDateTime
      };
    } else {
      where.createdAt = {
        gte: startDate,
        lt: endDate
      };
    }
  }

  // New requests filter (last 5 minutes)
  if (showNewRequestsOnly) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    where.createdAt = {
      gte: fiveMinutesAgo
    };
  }

  // Phone number filter - search both order-level and item-level mobile numbers
  if (phoneNumberFilter) {
    where.OR = [
      {
        mobileNumber: {
          contains: phoneNumberFilter
        }
      },
      {
        items: {
          some: {
            mobileNumber: {
              contains: phoneNumberFilter
            }
          }
        }
      }
    ];
  }

  // Order ID filter
  if (orderIdFilter) {
    where.id = parseInt(orderIdFilter) || undefined;
  }

  // Product filter
  if (selectedProduct) {
    itemsWhere.product = {
      name: selectedProduct
    };
  }

  // Status filter
  if (selectedStatusMain) {
    itemsWhere.status = selectedStatusMain;
  }

  // Add items filter to where clause if needed
  if (Object.keys(itemsWhere).length > 0) {
    where.items = {
      some: itemsWhere
    };
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  
  // Get total count for pagination
  const totalCount = await prisma.order.count({ where });
  
  // Determine sort order
  const orderBy = sortOrder === 'newest' 
    ? { createdAt: 'desc' }
    : { createdAt: 'asc' };

  // Fetch orders with optimized query
  const orders = await prisma.order.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true
            }
          }
        }
      },
      user: {
        select: { id: true, name: true, email: true, phone: true }
      }
    }
  });

  // Transform data to match frontend expectations - include nested order structure
  const transformedData = [];
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  
  for (const order of orders) {
    const orderCreatedAt = new Date(order.createdAt).getTime();
    const isNew = orderCreatedAt > fiveMinutesAgo;
    
    for (const item of order.items) {
      transformedData.push({
        id: item.id,
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        mobileNumber: item.mobileNumber || order.mobileNumber,
        user: {
          id: order.user.id,
          name: order.user.name,
          email: order.user.email,
          phone: order.user.phone
        },
        product: {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description,
          price: item.product.price
        },
        order: {
          id: order.id,
          createdAt: order.createdAt,
          items: [{
            status: item.status
          }]
        },
        isNew
      });
    }
  }

  // Fetch and include shop orders
  const shopOrders = await prisma.shop.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  // Transform shop orders to match the same format
  for (const shop of shopOrders) {
    const shopCreatedAt = new Date(shop.createdAt).getTime();
    const isNew = shopCreatedAt > fiveMinutesAgo;
    
    transformedData.push({
      id: shop.id,
      orderId: shop.id,
      productId: null,
      quantity: 1,
      mobileNumber: shop.phoneNumber,
      isShopOrder: true,
      user: {
        id: null,
        name: "shop",
        email: null,
        phone: shop.phoneNumber
      },
      product: {
        id: null,
        name: shop.productName || "Shop Product",
        description: shop.productDescription || `Ref: ${shop.reference}`,
        price: shop.productPrice || shop.amount
      },
      order: {
        id: shop.id,
        createdAt: shop.createdAt,
        items: [{
          status: shop.status || "Pending"
        }]
      },
      isNew
    });
  }

  // Sort combined data by createdAt (newest first)
  transformedData.sort((a, b) => new Date(b.order.createdAt) - new Date(a.order.createdAt));

  // Get shop count for total
  const shopCount = await prisma.shop.count();
  const combinedTotal = totalCount + shopCount;

  return {
    data: transformedData,
    pagination: {
      total: combinedTotal,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(combinedTotal / limit),
      hasMore: (page * limit) < combinedTotal
    }
  };
};

const getOrderHistory = async (userId) => {
  return await prisma.order.findMany({
    where: { userId },
    include: {
      items: {
        include: { product: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};

const getUserCompletedOrders = async (userId) => {
  return await prisma.order.findMany({
    where: { userId, status: "Completed" },
    include: {
      items: {
        include: {
          product: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
};

const updateOrderItemsStatus = async (orderId, newStatus, isShopOrder = false) => {
  try {
    // Define final statuses that cannot be changed
    const finalStatuses = ['Completed', 'Cancelled', 'Canceled'];
    
    // console.log(`[Status Update] Updating order ${orderId}, isShopOrder: ${isShopOrder}, newStatus: ${newStatus}`);
    
    // If explicitly marked as shop order, update Shop table
    if (isShopOrder) {
      const shopOrder = await prisma.shop.findUnique({
        where: { id: parseInt(orderId) }
      });

      if (!shopOrder) {
        //console.log(`[Shop] Shop order ${orderId} not found`);
        return {
          success: false,
          updatedCount: 0,
          message: `Shop order ${orderId} not found`
        };
      }

      // Check if shop order has a final status
      if (finalStatuses.includes(shopOrder.status)) {
        //console.log(`[Shop] Cannot update shop order ${orderId} - status is already ${shopOrder.status}`);
        return {
          success: false,
          updatedCount: 0,
          message: `Cannot update order - status is already ${shopOrder.status}`
        };
      }
      
      // Update status in Shop table
      await prisma.shop.update({
        where: { id: parseInt(orderId) },
        data: { status: newStatus }
      });
      
      //console.log(`[Shop] Updated shop order ${orderId} status to ${newStatus}`);
      
      return {
        success: true,
        updatedCount: 1,
        message: `Successfully updated shop order ${orderId} to ${newStatus}`
      };
    }

    // Regular order - check Order table
    const order = await prisma.order.findUnique({ 
      where: { id: parseInt(orderId) }, 
      select: { userId: true } 
    });
    
    if (!order) {
      throw new Error("Order not found");
    }
    
    // Check if regular order items have a final status
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: parseInt(orderId) },
      select: { status: true }
    });
    
    if (orderItems.length > 0 && finalStatuses.includes(orderItems[0].status)) {
      //console.log(`[Order] Cannot update order ${orderId} - status is already ${orderItems[0].status}`);
      return {
        success: false,
        updatedCount: 0,
        message: `Cannot update order - status is already ${orderItems[0].status}`
      };
    }
    
    // If status is cancelled/canceled, handle refund logic
    if (["Cancelled", "Canceled"].includes(newStatus)) {
      const refundReference = `order_items_refund:${orderId}`;
      
      const existingRefund = await prisma.transaction.findFirst({
        where: {
          userId: order.userId,
          type: "ORDER_ITEMS_REFUND",
          reference: refundReference
        }
      });
      
      if (!existingRefund) {
        // Calculate total order amount
        const items = await prisma.orderItem.findMany({
          where: { orderId: parseInt(orderId) },
          include: { product: true }
        });
        
        let totalOrderAmount = 0;
        for (const item of items) {
          totalOrderAmount += item.product.price * item.quantity;
        }
        
        // Find the original order transaction to get the amount that was deducted
        const originalOrderTransaction = await prisma.transaction.findFirst({
          where: {
            userId: order.userId,
            type: "ORDER",
            reference: `order:${orderId}`,
            amount: { lt: 0 } // Negative amount (deduction)
          }
        });
        
        let refundAmount = totalOrderAmount;
        
        if (originalOrderTransaction) {
          refundAmount = Math.abs(originalOrderTransaction.amount);
        }
        
        if (refundAmount > 0) {
          // Process the refund
          await createTransaction(
            order.userId,
            refundAmount,
            "ORDER_ITEMS_REFUND",
            `All items in order #${orderId} refunded (Amount: ${refundAmount})`,
            refundReference
          );
        }
      } else {
        // console.log(`Refund already processed for order ${orderId}. Skipping duplicate refund.`);
      }
    }
    
    // Update order items status
    const updatedItems = await prisma.orderItem.updateMany({ 
      where: { orderId: parseInt(orderId) }, 
      data: { status: newStatus } 
    });
    
    // Create status change transaction (only if not a duplicate)
    const statusChangeReference = `order_status:${orderId}:${newStatus}`;
    const existingStatusChange = await prisma.transaction.findFirst({
      where: {
        userId: order.userId,
        type: "ORDER_ITEMS_STATUS",
        reference: statusChangeReference
      }
    });
    
    if (!existingStatusChange) {
      await createTransaction(
        order.userId, 
        0, 
        "ORDER_ITEMS_STATUS", 
        `All items in order #${orderId} status changed to ${newStatus}`, 
        statusChangeReference
      );
    }
    
    return { 
      success: true, 
      updatedCount: updatedItems.count, 
      message: `Successfully updated ${updatedItems.count} order items to ${newStatus}` 
    };
  } catch (error) {
    console.error("Error updating order items status:", error);
    throw new Error("Failed to update order items status");
  }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Exporting functions for use in controllers
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const orderService = {
  async getOrdersPaginated({ page = 1, limit = 20, filters = {} }) {
    const { startDate, endDate, status, product, mobileNumber } = filters;
    
    // Build where clause
    const where = {};
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    
    if (status) {
      where.items = {
        some: {
          status,
        },
      };
    }
    
    if (product) {
      where.items = {
        ...(where.items || {}),
        some: {
          ...(where.items?.some || {}),
          product: {
            name: product,
          },
        },
      };
    }
    
    if (mobileNumber) {
      where.mobileNumber = {
        contains: mobileNumber,
      };
    }
    
    // Calculate pagination parameters
    const skip = (page - 1) * parseInt(limit);
    
    // Get count for pagination info
    const totalOrders = await prisma.order.count({ where });
    
    // Get paginated orders
    const orders = await prisma.order.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                description: true,
              },
            },
          },
        },
        user: {
          select: { 
            id: true, 
            name: true, 
            email: true, 
            phone: true 
          },
        },
      },
    });
    
    // Transform data more efficiently - avoid flatMap and deep copying
    const transformedItems = [];
    for (const order of orders) {
      for (const item of order.items) {
        transformedItems.push({
          id: item.id,
          orderId: order.id,
          mobileNumber: order.mobileNumber,
          user: order.user,
          createdAt: order.createdAt,
          product: item.product,
          status: item.status,
          order: {
            id: order.id,
            createdAt: order.createdAt,
            items: [{ status: item.status }]
          }
        });
      }
    }
    
    return {
      items: transformedItems,
      pagination: {
        total: totalOrders,
        pages: Math.ceil(totalOrders / parseInt(limit)),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    };
  },
  
  async getOrderStats() {
    // Cache order stats for 5 minutes since they don't change frequently
    const cacheKey = 'order_stats';
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Use more efficient aggregation query
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN EXISTS(SELECT 1 FROM OrderItem oi WHERE oi.orderId = o.id AND oi.status = 'Pending') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN EXISTS(SELECT 1 FROM OrderItem oi WHERE oi.orderId = o.id AND oi.status = 'Completed') THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN EXISTS(SELECT 1 FROM OrderItem oi WHERE oi.orderId = o.id AND oi.status = 'Processing') THEN 1 ELSE 0 END) as processing
      FROM \`Order\` o
    `;

    const result = {
      total: Number(stats[0]?.total || 0),
      pending: Number(stats[0]?.pending || 0),
      completed: Number(stats[0]?.completed || 0),
      processing: Number(stats[0]?.processing || 0)
    };

    // Cache for 5 minutes
    cache.set(cacheKey, result, 300000);
    return result;
  },
  
  async updateOrderStatus(orderId, status) {
    return await prisma.order.update({
      where: { id: orderId },
      data: {
        items: {
          updateMany: {
            where: {},
            data: { status }
          }
        }
      }
    });
  }
};

module.exports = {
  submitCart,
  getAllOrders,
  processOrder,
  getUserCompletedOrders,
  processOrderItem,
  getOrderStatus,
  getOrderHistory,
  updateOrderItemsStatus,
  setIoInstance,
  orderService
};