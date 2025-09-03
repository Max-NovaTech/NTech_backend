// const { PrismaClient } = require('@prisma/client');
const { createTransaction } = require('./transactionService');
const smsService = require('./smsService');

const prisma = require("../config/db");

const verifyAndAutoTopUp = async (userId, referenceId, retries = 3) => {
  try {
    // Find SMS message with this reference
    const smsMessage = await smsService.findSmsByReference(referenceId);

    if (!smsMessage) {
      throw new Error("Invalid or already used reference number");
    }

    if (!smsMessage.amount) {
      throw new Error("Amount not found in SMS. Please contact support.");
    }

    // Check if reference already exists in TopUp table
    const existingTopUp = await prisma.topUp.findUnique({
      where: { referenceId },
    });

    if (existingTopUp) {
      throw new Error(`Reference ID ${referenceId} already exists.`);
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { id: true, name: true, loanBalance: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // --- Start Atomic Transaction ---
    const result = await prisma.$transaction(async (prismaTx) => {
      // 1. Create TopUp record with Approved status
      const topUp = await prismaTx.topUp.create({
        data: {
          userId: parseInt(userId),
          referenceId: referenceId,
          amount: smsMessage.amount,
          status: "Approved", // Auto-approved via SMS
          submittedBy: "AUTO_SMS_VERIFICATION",
        },
      });

      // 2. Update user balance and create a transaction record
      const transaction = await createTransaction(
        parseInt(userId),
        smsMessage.amount,
        "TOPUP_APPROVED",
        `Auto top-up via SMS verification - Ref: ${referenceId} for GHS ${smsMessage.amount}`,
        `topup:${topUp.id}`,
        prismaTx // Pass the transaction client
      );

      // 3. Mark the SMS as processed
      await smsService.markSmsAsProcessed(smsMessage.id, prismaTx);

      return {
        success: true,
        amount: smsMessage.amount,
        newBalance: transaction.balance,
        reference: referenceId,
        topUpId: topUp.id,
        message: "Top-up successful!",
      };
    });
    // --- End Atomic Transaction ---

    return result;

  } catch (error) {
    console.error(`Error in auto top-up (attempt ${4 - retries}):`, error);
    if (retries > 0) {
      // Exponential backoff: wait for 100ms, 200ms, 400ms
      await new Promise((res) => setTimeout(res, (4 - retries) * 100));
      return verifyAndAutoTopUp(userId, referenceId, retries - 1);
    }
    throw new Error(error.message);
  }
};

const createTopUp = async (userId, referenceId, amount, submittedBy) => {
  try {
    // First check if reference ID exists
    const existingTopUp = await prisma.topUp.findUnique({
      where: { referenceId },
    });
    
    if (existingTopUp) {
      throw new Error(`Reference ID ${referenceId} already exists.`);
    }
    
    // Wrap both operations in a transaction to ensure atomicity
    return await prisma.$transaction(async (prismaTransaction) => {
      // Create the top-up record
      const newTopUp = await prismaTransaction.topUp.create({
        data: {
          userId,
          referenceId,
          amount,
          submittedBy,
          status: "Pending" // Default status
        }
      });
      
      // Get current user balance
      const user = await prismaTransaction.user.findUnique({
        where: { id: userId },
        select: { loanBalance: true, name: true }
      });
      
      if (!user) {
        throw new Error("User not found");
      }
      
      const currentBalance = user.loanBalance;
      const newBalance = currentBalance; // No balance change yet since it's pending
      
      // Create transaction record using the same prisma transaction
      const transaction = await prismaTransaction.transaction.create({
        data: {
          userId,
          // amount: 0, // No balance change yet since it's pending
          amount: amount, // No balance change yet since it's pending
          balance: newBalance,
          type: "TOPUP_REQUEST",
          // description: `Top-up request created: ${referenceId} for ${amount}`,
          description: `${user.name} with transaction id ${referenceId} has requested a Top-up`,
          reference: `topup:${newTopUp.id}`
        }
      });
      
      return {
        topup: newTopUp,
        transaction: transaction
      };
    });
    
  } catch (error) {
    console.error("Error creating top-up:", error);
    throw new Error(`Could not process top-up request: ${error.message}`);
  }
};

const updateTopUpStatus = async (topUpId, status, retries = 3) => {
  try {
    // Ensure status is either "Approved" or "Rejected"
    if (!["Approved", "Rejected"].includes(status)) {
      throw new Error("Invalid status. Must be 'Approved' or 'Rejected'.");
    }

    // Get the top-up details
    const topUp = await prisma.topUp.findUnique({
      where: { id: topUpId }
    });

    if (!topUp) throw new Error("Top-up request not found.");

    // If approved, update the user's loanBalance
    if (status === "Approved") {
      // Record the successful top-up transaction
      await createTransaction(
        topUp.userId,
        topUp.amount, // Positive amount for balance increase
        "TOPUP_APPROVED",
        `Top-up amount of GHS ${topUp.amount} has been approved successfully with transaction ID ${topUp.referenceId}`,
        `topup:${topUp.id}`
      );
    } else {
      // Record the rejected top-up
      await createTransaction(
        topUp.userId,
        0, // No balance change
        "TOPUP_REJECTED",
        `Top-up amount of GHS ${topUp.amount} has been rejected with transaction ID ${topUp.referenceId}`,
        `topup:${topUp.id}`
      );
    }

    // Update the top-up status
    const updatedTopUp = await prisma.topUp.update({
      where: { id: topUpId },
      data: { status }
    });

    return updatedTopUp;
  } catch (error) {
    console.error(`Error updating top-up status (attempt ${4 - retries}):`, error);
    if (retries > 0) {
      // Exponential backoff: wait for 100ms, 200ms, 400ms
      await new Promise(res => setTimeout(res, (4 - retries) * 100));
      return updateTopUpStatus(topUpId, status, retries - 1);
    }
    throw new Error("Could not update top-up status.");
  }
};

// Get all top-ups with filtering options (e.g., status, date range)
const getTopUps = async (startDate, endDate, status) => {
  try {
    const whereClause = {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    };

    if (status) whereClause.status = status; // Filter by status if provided

    const topUps = await prisma.topUp.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    return topUps;
  } catch (error) {
    console.error("Error fetching top-ups:", error);
    throw new Error("Could not retrieve top-up records");
  }
};


const getAllTopUps = async (startDate, endDate) => {
  const whereCondition = {};

  if (startDate && endDate) {
    whereCondition.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  return await prisma.topUp.findMany({
    where: whereCondition,
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

module.exports = {
  createTopUp,
  updateTopUpStatus,
  getTopUps,
  getAllTopUps,
  verifyAndAutoTopUp
};
