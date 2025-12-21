const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { emitNewShopOrder } = require('../utils/socketEmitter');

// Get io instance - will be set externally
let ioInstance = null;
const setIoInstance = (io) => {
  ioInstance = io;
};

// Place shop order
const placeShopOrder = async (req, res) => {
  try {
    const { fullName, phoneNumber, transactionId, productId, productName, productDescription, productPrice } = req.body;

    // Validate required fields
    if (!fullName || !phoneNumber || !transactionId || !productId || !productName || !productPrice) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if transaction ID already exists in Shop table
    const existingOrder = await prisma.shop.findFirst({
      where: { reference: transactionId }
    });

    if (existingOrder) {
      return res.status(400).json({ error: 'This transaction ID has already been used' });
    }

    // Store order with pending status (to be verified after 10 seconds)
    const orderTime = new Date();

    // Schedule verification after 10 seconds
    setTimeout(async () => {
      try {
        await verifyAndProcessOrder(transactionId, phoneNumber, productName, productDescription, productPrice, fullName, orderTime);
      } catch (error) {
        console.error('Error in delayed verification:', error);
      }
    }, 10 * 1000); // 10 seconds in milliseconds

    res.status(200).json({ 
      success: true, 
      message: 'Order placed successfully. Processing will begin shortly.' 
    });

  } catch (error) {
    console.error('Error placing shop order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
};

// Verify and process order (called after 10 seconds)
const verifyAndProcessOrder = async (transactionId, phoneNumber, productName, productDescription, productPrice, fullName, orderTime) => {
  try {
    //console.log(`[Shop] Verifying transaction ${transactionId} after 10 seconds...`);

    // Check if transaction exists in SmsMessage table
    const smsRecord = await prisma.smsMessage.findFirst({
      where: {
        reference: transactionId,
        isProcessed: false
      }
    });

    if (!smsRecord) {
      // console.log(`[Shop] Transaction ${transactionId} not found in SMS messages`);
      return;
    }

    // Update SmsMessage to mark as processed
    await prisma.smsMessage.update({
      where: { id: smsRecord.id },
      data: { isProcessed: true }
    });

    // Create entry in Shop table using actual product data (not SMS data)
    const shopData = {
      amount: productPrice, // Use actual product price, not SMS amount
      reference: transactionId,
      phoneNumber: phoneNumber,
      message: smsRecord.message, // Keep SMS message for audit trail
      deduction: productPrice,
      fullName: fullName, // Use customer's actual name
      productName: productName, // Use actual product name
      productDescription: productDescription, // Use actual product description (e.g., "3 GB")
      productPrice: productPrice, // Use actual product price
      orderTime: orderTime
    };
    
    // console.log('[Shop] Creating shop order with data:', JSON.stringify(shopData, null, 2));
    
    const createdShop = await prisma.shop.create({
      data: shopData
    });
    
    // console.log('[Shop] Created shop order:', JSON.stringify(createdShop, null, 2));
    // console.log(`[Shop] Order ${createdShop.id} created successfully for transaction ${transactionId}`);

    // Emit socket event for new shop order
    if (ioInstance) {
      emitNewShopOrder(ioInstance, createdShop);
    }

  } catch (error) {
    console.error('[Shop] Error in verifyAndProcessOrder:', error);
  }
};

// Get all shop orders (for admin)
const getAllShopOrders = async (req, res) => {
  try {
    const shopOrders = await prisma.shop.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(shopOrders);
  } catch (error) {
    console.error('Error fetching shop orders:', error);
    res.status(500).json({ error: 'Failed to fetch shop orders' });
  }
};

// File a complaint
const fileComplaint = async (req, res) => {
  try {
    const { fullName, mobileNumber, productName, productCost, transactionId, complaint, orderTime } = req.body;

    // Validate required fields
    if (!fullName || !mobileNumber || !productName || !productCost || !transactionId || !complaint || !orderTime) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if transaction exists in Shop table
    const shopOrder = await prisma.shop.findFirst({
      where: { reference: transactionId }
    });

    if (!shopOrder) {
      return res.status(400).json({ error: 'No order found with this transaction ID. Please verify your transaction ID.' });
    }

    // Create complaint
    const newComplaint = await prisma.complaint.create({
      data: {
        fullName,
        mobileNumber,
        productName,
        productCost: parseFloat(productCost),
        transactionId,
        complaint,
        orderTime: new Date(orderTime),
        status: 'Pending'
      }
    });

    res.status(201).json({ 
      success: true, 
      message: 'Complaint filed successfully',
      complaint: newComplaint
    });

  } catch (error) {
    console.error('Error filing complaint:', error);
    res.status(500).json({ error: 'Failed to file complaint' });
  }
};

// Get all complaints (for admin)
const getAllComplaints = async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(complaints);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
};

// Get pending complaints count
const getPendingComplaintsCount = async (req, res) => {
  try {
    const count = await prisma.complaint.count({
      where: {
        status: 'Pending'
      }
    });

    res.status(200).json({ count });
  } catch (error) {
    console.error('Error fetching complaints count:', error);
    res.status(500).json({ error: 'Failed to fetch complaints count' });
  }
};

// Update complaint status
const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updatedComplaint = await prisma.complaint.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    res.status(200).json({ 
      success: true,
      message: 'Complaint status updated',
      complaint: updatedComplaint
    });

  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ error: 'Failed to update complaint status' });
  }
};

// Delete complaint
const deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.complaint.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({ 
      success: true,
      message: 'Complaint deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({ error: 'Failed to delete complaint' });
  }
};

module.exports = {
  placeShopOrder,
  getAllShopOrders,
  fileComplaint,
  getAllComplaints,
  getPendingComplaintsCount,
  updateComplaintStatus,
  deleteComplaint,
  setIoInstance
};
