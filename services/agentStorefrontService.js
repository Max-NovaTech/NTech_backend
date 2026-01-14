const prisma = require('../config/db');

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
};

const getStorefrontByAgentId = async (agentId) => {
  return await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) },
    include: {
      products: true
    }
  });
};

const getStorefrontBySlug = async (storeSlug) => {
  return await prisma.agentStorefront.findUnique({
    where: { storeSlug },
    include: {
      products: true
    }
  });
};

const createOrUpdateStorefront = async (agentId, data) => {
  const { storeName, momoNumber, momoName } = data;
  
  const existing = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (existing) {
    return await prisma.agentStorefront.update({
      where: { agentId: parseInt(agentId) },
      data: {
        storeName,
        momoNumber,
        momoName,
        updatedAt: new Date()
      }
    });
  }

  const storeSlug = generateSlug(storeName);
  return await prisma.agentStorefront.create({
    data: {
      agentId: parseInt(agentId),
      storeName,
      momoNumber,
      momoName,
      storeSlug,
      isActive: true
    }
  });
};

const getAvailableProductsForAgent = async (agentId) => {
  const agent = await prisma.user.findUnique({
    where: { id: parseInt(agentId) }
  });

  if (!agent) throw new Error('Agent not found');

  const roleProductFilter = {
    'SUPER': 'SUPER',
    'NORMAL': 'NORMAL',
    'PREMIUM': 'PREMIUM',
    'USER': null,
    'Other': 'Other'
  };

  const roleKeyword = roleProductFilter[agent.role];
  
  let products;
  if (roleKeyword) {
    products = await prisma.product.findMany({
      where: {
        name: { contains: roleKeyword },
        stock: { gt: 0 }
      }
    });
  } else {
    products = await prisma.product.findMany({
      where: {
        stock: { gt: 0 },
        NOT: [
          { name: { contains: 'SUPER' } },
          { name: { contains: 'NORMAL' } },
          { name: { contains: 'PREMIUM' } },
          { name: { contains: 'Other' } }
        ]
      }
    });
  }

  return products;
};

const addProductToStorefront = async (agentId, productId, customPrice) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) throw new Error('Storefront not found. Please set up your storefront first.');

  const product = await prisma.product.findUnique({
    where: { id: parseInt(productId) }
  });

  if (!product) throw new Error('Product not found');

  const existing = await prisma.agentStorefrontProduct.findUnique({
    where: {
      storefrontId_productId: {
        storefrontId: storefront.id,
        productId: parseInt(productId)
      }
    }
  });

  if (existing) {
    return await prisma.agentStorefrontProduct.update({
      where: { id: existing.id },
      data: {
        customPrice: parseFloat(customPrice),
        isActive: true,
        updatedAt: new Date()
      }
    });
  }

  return await prisma.agentStorefrontProduct.create({
    data: {
      storefrontId: storefront.id,
      productId: parseInt(productId),
      customPrice: parseFloat(customPrice),
      isActive: true
    }
  });
};

const updateProductPrice = async (agentId, storefrontProductId, customPrice) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) throw new Error('Storefront not found');

  const storefrontProduct = await prisma.agentStorefrontProduct.findFirst({
    where: {
      id: parseInt(storefrontProductId),
      storefrontId: storefront.id
    }
  });

  if (!storefrontProduct) throw new Error('Product not found in your storefront');

  return await prisma.agentStorefrontProduct.update({
    where: { id: parseInt(storefrontProductId) },
    data: {
      customPrice: parseFloat(customPrice),
      updatedAt: new Date()
    }
  });
};

const removeProductFromStorefront = async (agentId, storefrontProductId) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) throw new Error('Storefront not found');

  const storefrontProduct = await prisma.agentStorefrontProduct.findFirst({
    where: {
      id: parseInt(storefrontProductId),
      storefrontId: storefront.id
    }
  });

  if (!storefrontProduct) throw new Error('Product not found in your storefront');

  return await prisma.agentStorefrontProduct.delete({
    where: { id: parseInt(storefrontProductId) }
  });
};

const getStorefrontProducts = async (agentId) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) },
    include: {
      products: true
    }
  });

  if (!storefront) return [];

  const productIds = storefront.products.map(p => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } }
  });

  return storefront.products.map(sp => {
    const product = products.find(p => p.id === sp.productId);
    return {
      ...sp,
      product
    };
  });
};

const getPublicStoreProducts = async (storeSlug) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { storeSlug },
    include: {
      products: {
        where: { isActive: true }
      }
    }
  });

  if (!storefront || !storefront.isActive) {
    throw new Error('Store not found or inactive');
  }

  const productIds = storefront.products.map(p => p.productId);
  const products = await prisma.product.findMany({
    where: { 
      id: { in: productIds },
      stock: { gt: 0 }
    }
  });

  return {
    storefront: {
      id: storefront.id,
      storeName: storefront.storeName,
      momoNumber: storefront.momoNumber,
      momoName: storefront.momoName,
      storeSlug: storefront.storeSlug
    },
    products: storefront.products.map(sp => {
      const product = products.find(p => p.id === sp.productId);
      if (!product) return null;
      return {
        id: sp.id,
        productId: sp.productId,
        name: product.name,
        description: product.description,
        customPrice: sp.customPrice,
        stock: product.stock
      };
    }).filter(Boolean)
  };
};

const createAgentStoreOrder = async (storeSlug, orderData) => {
  const { customerName, customerPhone, storefrontProductId, transactionId } = orderData;

  const storefront = await prisma.agentStorefront.findUnique({
    where: { storeSlug },
    include: {
      products: true
    }
  });

  if (!storefront || !storefront.isActive) {
    throw new Error('Store not found or inactive');
  }

  const storefrontProduct = storefront.products.find(p => p.id === parseInt(storefrontProductId));
  if (!storefrontProduct) {
    throw new Error('Product not found in this store');
  }

  const product = await prisma.product.findUnique({
    where: { id: storefrontProduct.productId }
  });

  if (!product) throw new Error('Product not found');

  const agent = await prisma.user.findUnique({
    where: { id: storefront.agentId }
  });

  if (!agent) throw new Error('Agent not found');

  return await prisma.agentStoreOrder.create({
    data: {
      storefrontId: storefront.id,
      customerName,
      customerPhone,
      productId: product.id,
      productName: product.name,
      productDescription: product.description,
      customerPrice: storefrontProduct.customPrice,
      agentPrice: product.price,
      transactionId,
      status: 'Pending'
    }
  });
};

const getAgentStoreOrders = async (agentId, status = null) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) return [];

  const whereClause = { storefrontId: storefront.id };
  if (status) {
    whereClause.status = status;
  }

  return await prisma.agentStoreOrder.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' }
  });
};

const approveAgentStoreOrder = async (agentId, orderId) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) throw new Error('Storefront not found');

  const order = await prisma.agentStoreOrder.findFirst({
    where: {
      id: parseInt(orderId),
      storefrontId: storefront.id
    }
  });

  if (!order) throw new Error('Order not found');

  if (order.status !== 'Pending') {
    throw new Error('Order is not pending');
  }

  // Add the order to the agent's cart
  let cart = await prisma.cart.findUnique({
    where: { userId: parseInt(agentId) }
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId: parseInt(agentId) }
    });
  }

  // Check if this product is already in the cart with the same mobile number
  const existingCartItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: order.productId,
      mobileNumber: order.customerPhone
    }
  });

  if (existingCartItem) {
    // Update quantity if exists
    await prisma.cartItem.update({
      where: { id: existingCartItem.id },
      data: { quantity: existingCartItem.quantity + 1 }
    });
  } else {
    // Create new cart item
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: order.productId,
        quantity: 1,
        price: order.agentPrice,
        mobileNumber: order.customerPhone
      }
    });
  }

  // Update order status to Approved and mark as added to cart
  return await prisma.agentStoreOrder.update({
    where: { id: parseInt(orderId) },
    data: {
      status: 'Approved',
      isAddedToCart: true,
      updatedAt: new Date()
    }
  });
};

const rejectAgentStoreOrder = async (agentId, orderId) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) throw new Error('Storefront not found');

  const order = await prisma.agentStoreOrder.findFirst({
    where: {
      id: parseInt(orderId),
      storefrontId: storefront.id
    }
  });

  if (!order) throw new Error('Order not found');

  return await prisma.agentStoreOrder.update({
    where: { id: parseInt(orderId) },
    data: {
      status: 'Rejected',
      updatedAt: new Date()
    }
  });
};

const markOrdersAsSubmitted = async (agentId, orderIds) => {
  // This is called after cart submission to mark agent store orders as pushed
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) return;

  await prisma.agentStoreOrder.updateMany({
    where: {
      id: { in: orderIds.map(id => parseInt(id)) },
      storefrontId: storefront.id,
      status: 'Approved',
      isAddedToCart: true
    },
    data: {
      isPushedToAdmin: true,
      status: 'Processing',
      updatedAt: new Date()
    }
  });
};

const getAgentProfitStats = async (agentId) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) return { totalProfit: 0, totalOrders: 0, completedOrders: 0, pendingOrders: 0 };

  const orders = await prisma.agentStoreOrder.findMany({
    where: { storefrontId: storefront.id }
  });

  const completedOrders = orders.filter(o => o.isPushedToAdmin);
  const pendingOrders = orders.filter(o => o.status === 'Pending');
  const approvedOrders = orders.filter(o => o.status === 'Approved' && !o.isPushedToAdmin);

  const totalProfit = completedOrders.reduce((sum, order) => {
    return sum + (order.customerPrice - order.agentPrice);
  }, 0);

  const potentialProfit = approvedOrders.reduce((sum, order) => {
    return sum + (order.customerPrice - order.agentPrice);
  }, 0);

  return {
    totalProfit,
    potentialProfit,
    totalOrders: orders.length,
    completedOrders: completedOrders.length,
    pendingOrders: pendingOrders.length,
    approvedOrders: approvedOrders.length
  };
};

const addMultipleProductsToStorefront = async (agentId, products) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) throw new Error('Storefront not found. Please set up your storefront first.');

  const results = [];

  for (const { productId, customPrice } of products) {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!product) continue;

    const existing = await prisma.agentStorefrontProduct.findUnique({
      where: {
        storefrontId_productId: {
          storefrontId: storefront.id,
          productId: parseInt(productId)
        }
      }
    });

    if (existing) {
      const updated = await prisma.agentStorefrontProduct.update({
        where: { id: existing.id },
        data: {
          customPrice: parseFloat(customPrice),
          isActive: true,
          updatedAt: new Date()
        }
      });
      results.push(updated);
    } else {
      const created = await prisma.agentStorefrontProduct.create({
        data: {
          storefrontId: storefront.id,
          productId: parseInt(productId),
          customPrice: parseFloat(customPrice),
          isActive: true
        }
      });
      results.push(created);
    }
  }

  return results;
};

const getApprovedOrdersInCart = async (agentId) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) return [];

  return await prisma.agentStoreOrder.findMany({
    where: {
      storefrontId: storefront.id,
      status: 'Approved',
      isAddedToCart: true,
      isPushedToAdmin: false
    },
    orderBy: { createdAt: 'desc' }
  });
};

const regenerateStoreLink = async (agentId) => {
  const storefront = await prisma.agentStorefront.findUnique({
    where: { agentId: parseInt(agentId) }
  });

  if (!storefront) throw new Error('Storefront not found');

  const newSlug = generateSlug(storefront.storeName);

  return await prisma.agentStorefront.update({
    where: { id: storefront.id },
    data: {
      storeSlug: newSlug,
      updatedAt: new Date()
    }
  });
};

module.exports = {
  getStorefrontByAgentId,
  getStorefrontBySlug,
  createOrUpdateStorefront,
  getAvailableProductsForAgent,
  addProductToStorefront,
  updateProductPrice,
  removeProductFromStorefront,
  getStorefrontProducts,
  getPublicStoreProducts,
  createAgentStoreOrder,
  getAgentStoreOrders,
  approveAgentStoreOrder,
  rejectAgentStoreOrder,
  markOrdersAsSubmitted,
  getAgentProfitStats,
  addMultipleProductsToStorefront,
  getApprovedOrdersInCart,
  regenerateStoreLink
};
