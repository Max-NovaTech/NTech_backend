const prisma = require("../config/db");

const addPackage = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can add packages" });
    }

    const { name, price } = req.body;
    const dataPackage = await prisma.dataPackage.create({
      data: { name, price, adminId: req.user.id },
    });

    res.status(201).json({ message: "Package added", dataPackage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resetDatabase = async (req, res) => {
  try {
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.topUp.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.complaint.deleteMany({});
    await prisma.announcement.deleteMany({});
    await prisma.shop.deleteMany({});
    await prisma.purchase.deleteMany({});
    await prisma.upload.deleteMany({});
    await prisma.smsMessage.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    
    res.status(200).json({ 
      message: "Database reset successfully. User and Product tables preserved.",
      success: true 
    });
  } catch (error) {
    console.error("Error resetting database:", error);
    res.status(500).json({ 
      message: "Failed to reset database", 
      error: error.message 
    });
  }
};

module.exports = { addPackage, resetDatabase };
