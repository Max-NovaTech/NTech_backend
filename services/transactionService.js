const prisma = require("../config/db");

/**
 * Creates a transaction record
 * @param {Number} userId - User ID
 * @param {Number} amount - Transaction amount (positive for credits, negative for debits)
 * @param {String} type - Transaction type (TOPUP, ORDER, CART_ADD, LOAN_REPAYMENT, LOAN_DEDUCTION)
 * @param {String} description - Transaction description
 * @param {String} reference - Reference ID (optional)
 * @returns {Promise<Object>} Created transaction
 */

const createTransaction = async (userId, amount, type, description, reference = null, prismaOverride = null) => {
  try {
    const prismaTx = prismaOverride || prisma;
    // If using a transaction, don't nest another $transaction
    if (prismaOverride) {
      // Atomically increment the balance and get the updated value
      const updatedUser = await prismaTx.user.update({
        where: { id: userId },
        data: { loanBalance: { increment: amount } },
        select: { loanBalance: true }
      });

      // Calculate previous balance by subtracting the amount from the new balance
      const newBalance = updatedUser.loanBalance;
      const previousBalance = newBalance - amount;

      // Create transaction record with previousBalance
      const transaction = await prismaTx.transaction.create({
        data: {
          userId,
          amount,
          balance: newBalance,
          previousBalance,
          type,
          description,
          reference
        }
      });

      return transaction;
    } else {
      // Use a transaction for atomicity
      return await prisma.$transaction(async (prismaTxInner) => {
        // Atomically increment the balance and get the updated value
        const updatedUser = await prismaTxInner.user.update({
          where: { id: userId },
          data: { loanBalance: { increment: amount } },
          select: { loanBalance: true }
        });

        // Calculate previous balance by subtracting the amount from the new balance
        const newBalance = updatedUser.loanBalance;
        const previousBalance = newBalance - amount;

        // Create transaction record with previousBalance
        const transaction = await prismaTxInner.transaction.create({
          data: {
            userId,
            amount,
            balance: newBalance,
            previousBalance,
            type,
            description,
            reference
          }
        });

        return transaction;
      });
    }
  } catch (error) {
    console.error("Error creating transaction:", error);
    throw new Error(`Failed to record transaction: ${error.message}`);
  }
};

/**
 * Get user transaction history
 * @param {Number} userId - User ID
 * @param {Date} startDate - Start date filter (optional)
 * @param {Date} endDate - End date filter (optional)
 * @param {String} type - Transaction type filter (optional)
 * @returns {Promise<Array>} Transaction history
 */

const getUserTransactions = async (userId, startDate = null, endDate = null, type = null) => {
  try {
    const whereClause = { userId };
    
    // Add date filters if provided
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    // Add type filter if provided
    if (type) {
      whereClause.type = type;
    }
    
    return await prisma.transaction.findMany({
      where: whereClause,
      select: {
        id: true,
        amount: true,
        balance: true,
        previousBalance: true,
        type: true,
        description: true,
        reference: true,
        createdAt: true,
        user: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    console.error("Error fetching user transactions:", error);
    throw new Error(`Failed to retrieve transaction history: ${error.message}`);
  }
};


/**
 * Get all transactions
 * @param {Date} startDate - Start date filter (optional)
 * @param {Date} endDate - End date filter (optional)
 * @param {String} type - Transaction type filter (optional)
 * @param {Number} userId - User ID filter (optional)
 * @returns {Promise<Array>} All transactions
 */

const getAllTransactions = async (startDate = null, endDate = null, type = null, userId = null) => {
  try {
    const whereClause = {};
    
    // Add date filters if provided
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    // Add type filter if provided
    if (type) {
      whereClause.type = type;
    }

    // Add user ID filter if provided
    if (userId) {
      whereClause.userId = parseInt(userId, 10);
    }
    
    return await prisma.transaction.findMany({
      where: whereClause,
      select: {
        id: true,
        amount: true,
        balance: true,
        previousBalance: true, // 👈 ADD THIS FIELD
        type: true,
        description: true,
        reference: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    console.error("Error fetching all transactions:", error);
    throw new Error(`Failed to retrieve transactions: ${error.message}`);
  }
};

module.exports = {
  createTransaction,
  getUserTransactions,
  getAllTransactions
};
