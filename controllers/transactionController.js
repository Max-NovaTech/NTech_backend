const { getUserTransactions, getAllTransactions } = require('../services/transactionService');

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
    const { startDate, endDate, type } = req.query;
    
    const transactions = await getAllTransactions(startDate, endDate, type);
    
    res.status(200).json({
      success: true,
      data: transactions
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

module.exports = {
  getUserTransactionHistory,
  getAllTransactionHistory,
  getUserBalanceSummary,
  getAuditLog
};