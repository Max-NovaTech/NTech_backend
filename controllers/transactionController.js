const { getUserTransactions, getAllTransactions, getTransactionStatistics } = require('../services/transactionService');
const prisma = require('../config/db');

// Get transactions for a specific user (accessible by user and admin)
const getUserTransactionHistory = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { startDate, endDate, type } = req.query;
    
    const transactions = await getUserTransactions(userId, startDate, endDate, type);
    
    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error("Error in getUserTransactionHistory:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to retrieve transaction history" 
    });
  }
};

// Get all transactions (admin only)
const getAllTransactionHistory = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      type, 
      page = 1, 
      limit = 100, 
      search, 
      amountFilter 
    } = req.query;
    
    const result = await getAllTransactions(
      startDate, 
      endDate, 
      type, 
      null, // userId
      parseInt(page), 
      parseInt(limit), 
      search, 
      amountFilter
    );
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error("Error in getAllTransactionHistory:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to retrieve all transactions" 
    });
  }
};

// Helper function to calculate total amount by transaction type
const calculateTotalByType = async (userId, type) => {
  try {
    const transactions = await getUserTransactions(userId, null, null, type);
    return transactions.reduce((total, transaction) => total + transaction.amount, 0);
  } catch (error) {
    console.error(`Error calculating total for ${type}:`, error);
    return 0;
  }
};

// Get user balance summary
const getUserBalanceSummary = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Get latest transaction to find current balance
    const latestTransaction = await getUserTransactions(userId, null, null, null);
    
    // Get transaction stats
    const topupAmount = await calculateTotalByType(userId, 'TOPUP_APPROVED');
    const orderAmount = await calculateTotalByType(userId, 'ORDER');
    const loanRepayment = await calculateTotalByType(userId, 'LOAN_REPAYMENT');
    const loanDeduction = await calculateTotalByType(userId, 'LOAN_DEDUCTION');
    
    res.status(200).json({
      success: true,
      data: {
        currentBalance: latestTransaction.length > 0 ? latestTransaction[0].balance : 0,
        statistics: {
          totalTopups: topupAmount,
          totalOrders: Math.abs(orderAmount), // Convert to positive for display
          totalLoanRepayments: loanRepayment,
          totalLoanDeductions: Math.abs(loanDeduction), // Convert to positive for display
          totalLoanBalance: loanDeduction + loanRepayment // Remaining loan balance
        },
        transactionCount: latestTransaction.length
      }
    });
  } catch (error) {
    console.error("Error in getUserBalanceSummary:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to retrieve balance summary" 
    });
  }
};

// Get audit log (filtered transactions for admin audit)
const getAuditLog = async (req, res) => {
  try {
    const { userId, start, end, type } = req.query;
    // getAllTransactions should accept (start, end, type, userId)
    const transactions = await getAllTransactions(start, end, type, userId);
    res.status(200).json(transactions);
  } catch (error) {
    console.error("Error in getAuditLog:", error);
    res.status(500).json({ message: error.message || "Failed to retrieve audit log" });
  }
};

// Get transaction statistics (admin only)
const getTransactionStats = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      type, 
      search, 
      amountFilter 
    } = req.query;
    
    const stats = await getTransactionStatistics(
      startDate, 
      endDate, 
      type, 
      null, // userId
      search, 
      amountFilter
    );
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error in getTransactionStats:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to retrieve transaction statistics" 
    });
  }
};

// Get admin balance sheet data
const getAdminBalanceSheetData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter for transactions and topups
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // 1. Total Revenue (Sales) - Sum of all completed orders
    const completedOrders = await prisma.orderItem.findMany({
      where: {
        status: 'Completed',
        ...(startDate && endDate ? {
          order: {
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          }
        } : {})
      },
      include: {
        product: true,
        order: true
      }
    });

    const totalRevenue = completedOrders.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    // 2. Total Top-ups - Sum of all approved topups
    const approvedTopups = await prisma.topUp.findMany({
      where: {
        status: 'Approved',
        ...dateFilter
      }
    });

    const totalTopups = approvedTopups.reduce((sum, topup) => sum + topup.amount, 0);

    // 3. Total Refunds - Sum of all refund transactions
    const refundTransactions = await prisma.transaction.findMany({
      where: {
        type: 'REFUND',
        ...dateFilter
      }
    });

    const totalRefunds = refundTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    // 4. Previous Balance - Sum of all users' loan balances at end of yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    // Get the latest transaction for each user before midnight yesterday
    const usersWithBalances = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        loanBalance: true
      }
    });

    let previousBalance = 0;
    for (const user of usersWithBalances) {
      const lastTransaction = await prisma.transaction.findFirst({
        where: {
          userId: user.id,
          createdAt: {
            lte: yesterday
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (lastTransaction) {
        previousBalance += lastTransaction.balance;
      }
    }

    // Additional metrics for completeness
    const orderCount = completedOrders.length;
    const topupCount = approvedTopups.length;
    const refundCount = refundTransactions.length;
    const totalTopupsAndRefunds = totalTopups + totalRefunds;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalTopups,
        totalRefunds,
        totalTopupsAndRefunds,
        previousBalance,
        orderCount,
        topupCount,
        refundCount,
        // Additional metrics
        activeUsers: usersWithBalances.length,
        netCashFlow: totalTopups + totalRefunds - totalRevenue
      }
    });

  } catch (error) {
    console.error("Error in getAdminBalanceSheetData:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to retrieve admin balance sheet data" 
    });
  }
};

module.exports = {
  getUserTransactionHistory,
  getAllTransactionHistory,
  getUserBalanceSummary,
  getAuditLog,
  getTransactionStats,
  getAdminBalanceSheetData
};