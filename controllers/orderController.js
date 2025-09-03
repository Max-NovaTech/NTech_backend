const {
  submitCart,
  getOrderStatus,
  processOrderItem,
  getAllOrders,
  processOrder,
  getUserCompletedOrders,
  getOrderHistory,
  updateOrderItemsStatus,
  // orderController
} = require("../services/orderService");

const orderService = require('../services/orderService');
const path = require('path');

exports.submitCart = async (req, res) => {
  try {
    const { userId, mobileNumber } = req.body;

    const order = await submitCart(userId, mobileNumber);

    res.status(201).json({
      success: true,
      message: "Order submitted successfully",
      order,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await getAllOrders(parseInt(limit), parseInt(offset));
    
    // Transform data to match frontend expectations
    const transformedData = result.orders.flatMap(order => 
      order.items.map(item => ({
        ...item,
        orderId: order.id,
        createdAt: order.createdAt,
        user: order.user,
        order: {
          ...order,
          items: [item] // Only include current item to avoid status mix-ups
        }
      }))
    );
    
    res.json(transformedData);
  } catch (error) {
    console.error('Error in getAllOrders:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderStatus = async (req, res) => {
  try {
    const orders = await getOrderStatus();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.processOrderItem = async (req, res) => {
  const { orderItemId, status } = req.body;
  try {
    const updatedItem = await processOrderItem(orderItemId, status);
    res.json({ message: "Order item status updated", updatedItem });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.processOrderController = async (req, res) => {
  const { status } = req.body;
  try {
    const updatedOrder = await processOrder(
      parseInt(req.params.orderId),
      status
    );
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserCompletedOrdersController = async (req, res) => {
  try {
    const orders = await getUserCompletedOrders(parseInt(req.params.userId));
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId); // Get userId from request params

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const orders = await getOrderHistory(userId);

    if (!orders.length) {
      return res.status(404).json({ message: "No order history found" });
    }

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};





exports.updateOrderItemsStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    // Validate inputs
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }
    
    if (!status) {
      return res.status(400).json({ success: false, message: "New status is required" });
    }
    
    // Validate status is one of the allowed values
    const allowedStatuses = ["Pending", "Processing", "Completed"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Status must be one of: ${allowedStatuses.join(", ")}` 
      });
    }
    
    const result = await updateOrderItemsStatus(orderId, status);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to update order items status" 
    });
  }
}

exports.getOrders = async (req, res) => {
  try {
    const { 
      page, 
      limit,
      startDate,
      endDate,
      status,
      product,
      mobileNumber
    } = req.query;
    
    const filters = {
      startDate,
      endDate,
      status,
      product,
      mobileNumber
    };
    
    const result = await orderService.getOrdersPaginated({
      page,
      limit,
      filters
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: error.message });
  }
},

// Excel Upload Controller for Agent Orders
exports.uploadExcelOrders = async (req, res) => {
  console.log('--- [UPLOAD EXCEL ORDERS] Endpoint hit ---');
  const prisma = require('../config/db');
  const userService = require('../services/userService');
  const productService = require('../services/productService');
  const cartService = require('../services/cartService');
  const xlsx = require('xlsx');
  const fs = require('fs');

  try {
    const { agentId, network } = req.body;
    if (!req.file) {
      console.log('ERROR: No file uploaded.');
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    if (!agentId || !network) {
      return res.status(400).json({ success: false, message: 'Missing agentId or network.' });
    }

    // Parse Excel file
    const filePath = req.file.path;
    let data = [];
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      console.log('Excel parsed. Rows found:', data.length);
      if (data.length > 0) {
        console.log('First row sample:', data[0]);
      }
    } catch (parseErr) {
      console.log('ERROR parsing Excel file:', parseErr);
      return res.status(400).json({ success: false, message: 'Failed to parse Excel file.' });
    }

    let total = data.length;
    let errorReport = [];
    if (total === 0) {
      console.log('WARNING: Excel file parsed but contains zero rows.');
    }

    // Fetch agent/user and role
    const agent = await userService.getUserById(parseInt(agentId));
    if (!agent) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, message: 'Agent not found.' });
    }
    const userRole = agent.role;
    const username = agent.name;

    // Validate all rows before adding to cart
    let productsToAdd = [];
    let totalCost = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const phoneNumber = row['phone'] ? String(row['phone']).trim() : '';
      const item = row['item'] ? String(row['item']).trim() : '';
      const bundleAmount = row['bundle amount'] ? String(row['bundle amount']).trim() : '';
      const quantity = row['quantity'] ? parseInt(row['quantity']) : 1;
      let rowErrors = [];
      if (!phoneNumber) rowErrors.push('Missing phone');
      if (!item) rowErrors.push('Missing item (e.g: MTN - SUPERAGENT)');
      if (!bundleAmount) rowErrors.push('Missing bundle amount (e.g: 50GB)');
      if (quantity < 1 || isNaN(quantity)) rowErrors.push('Invalid quantity');
      // Lookup product by item and bundle amount
      let product = await prisma.product.findFirst({
        where: {
          name: item,
          description: bundleAmount
        },
      });
      if (!product) {
        rowErrors.push('Product not found for item: ' + item + ' and bundle amount: ' + bundleAmount);
      }
      // Get price for user role
      let finalPrice = null;
      if (product) {
        finalPrice = productService.getPriceForUserRole(userRole, product);
        if (finalPrice == null) {
          rowErrors.push('Price could not be determined for user role and product.');
        }
      }
      // Check stock
      if (product && product.stock < quantity) {
        rowErrors.push('Not enough stock for product: ' + item + ' (' + bundleAmount + ')');
      }
      // Accumulate total cost
      if (finalPrice && rowErrors.length === 0) {
        totalCost += finalPrice * quantity;
        productsToAdd.push({ product, quantity, phoneNumber, price: finalPrice });
      } else if (rowErrors.length > 0) {
        errorReport.push({ row: i + 2, errors: rowErrors });
      }
    }

    // Check wallet balance
    if (productsToAdd.length > 0 && agent.walletBalance !== undefined) {
      if (agent.walletBalance < totalCost) {
        errorReport.push({ row: 'ALL', errors: ['Insufficient wallet balance for total order. Required: ' + totalCost + ', Available: ' + agent.walletBalance] });
      }
    }

    // If any errors, do not add to cart
    if (errorReport.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, errorReport });
    }

    // All validations passed, add to cart
    let added = 0;
    for (const item of productsToAdd) {
      await cartService.addItemToCart(agent.id, item.product.id, item.quantity, item.phoneNumber);
      added++;
    }
    fs.unlinkSync(filePath);
    return res.json({ success: true, message: `${added} products added to cart.`, summary: { total, added } });
  } catch (err) {
    console.log('ERROR in uploadExcelOrders:', err);
    if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOrderStats = async (req, res) => {
  try {
    const stats = await orderService.getOrderStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: error.message });
  }
},

exports.downloadSimplifiedTemplate = (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'order_template.xlsx');
  res.download(filePath, 'order_template.xlsx', (err) => {
    if (err) {
      console.error("Error downloading template:", err);
      res.status(500).send("Could not download the file.");
    }
  });
};

// New Excel Upload Controller for Simplified (2-column) Agent Orders
exports.uploadSimplifiedExcelOrders = async (req, res) => {
  console.log('--- [UPLOAD SIMPLIFIED EXCEL ORDERS] Endpoint hit ---');
  const prisma = require('../config/db');
  const userService = require('../services/userService');
  const cartService = require('../services/cartService');
  const xlsx = require('xlsx');
  const fs = require('fs');

  try {
    const { agentId, network } = req.body;
    if (!req.file) {
      console.log('ERROR: No file uploaded.');
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    if (!agentId || !network) {
      return res.status(400).json({ success: false, message: 'Missing agentId or network.' });
    }

    const filePath = req.file.path;
    let data = [];
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      console.log('Simplified Excel parsed. Rows found:', data.length);
    } catch (parseErr) {
      console.log('ERROR parsing Excel file:', parseErr);
      return res.status(400).json({ success: false, message: 'Failed to parse Excel file.' });
    }

    let total = data.length;
    let errorReport = [];
    if (total === 0) {
      console.log('WARNING: Excel file parsed but contains zero rows.');
    }

    const agent = await userService.getUserById(parseInt(agentId));
    if (!agent) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, message: 'Agent not found.' });
    }
    const userRole = agent.role; 

    let productsToAdd = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const phoneNumber = row['phone'] ? String(row['phone']).trim() : '';
      const bundleAmount = row['bundle_amount'] ? String(row['bundle_amount']).trim() : '';
      let rowErrors = [];

      if (!phoneNumber) rowErrors.push('Missing phone number.');
      if (!bundleAmount || isNaN(parseFloat(bundleAmount))) rowErrors.push('Invalid or missing bundle amount. It must be a number.');

      if(rowErrors.length > 0) {
        errorReport.push({ row: i + 2, errors: rowErrors });
        continue; // Skip to next row
      }

      const productDescription = `${bundleAmount}GB`;
      let productName;
      if (userRole.toUpperCase() === 'USER') {
        // For 'USER' role, product name is just the network
        productName = network.toUpperCase();
      } else {
        // For all other roles, it's 'NETWORK - ROLE'
        productName = `${network.toUpperCase()} - ${userRole.toUpperCase()}`;
      }

      // --- DEBUG LOGGING ---
      console.log(`Searching for product with NAME: [${productName}] and DESCRIPTION: [${productDescription}]`);
      // --------------------

      const product = await prisma.product.findFirst({
        where: {
          name: productName,
          description: productDescription,
        },
      });

      if (!product) {
        rowErrors.push(`Product not found for your user type (${userRole}) with bundle ${productDescription} and network ${network}.`);

        // --- DEBUG: Log all available products for easier debugging ---
        console.log('--- AVAILABLE PRODUCTS IN DATABASE ---');
        const allProducts = await prisma.product.findMany({
          select: { name: true, description: true, stock: true }
        });
        console.table(allProducts);
        console.log('-----------------------------------------');
        // ----------------------------------------------------------
      } else {
          productsToAdd.push({ 
              product, 
              quantity: 1, // Quantity is always 1 in the new flow
              phoneNumber 
            });
      }

      if (rowErrors.length > 0) {
        errorReport.push({ row: i + 2, errors: rowErrors });
      }
    }

    if (errorReport.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ 
        success: false, 
        message: 'Validation errors occurred.',
        summary: { total, successful: total - errorReport.length, failed: errorReport.length },
        errors: errorReport 
      });
    }

    // All validations passed, add to cart
    let added = 0;
    for (const item of productsToAdd) {
      await cartService.addItemToCart(agent.id, item.product.id, item.quantity, item.phoneNumber);
      added++;
    }
    fs.unlinkSync(filePath);
    return res.json({ 
        success: true, 
        message: `${added} products added to cart.`,
        summary: { total, successful: added, failed: 0 }
    });

  } catch (err) {
    console.log('ERROR in uploadSimplifiedExcelOrders:', err);
    if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const updatedOrder = await orderService.updateOrderStatus(orderId, status);
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: error.message });
  }
}
