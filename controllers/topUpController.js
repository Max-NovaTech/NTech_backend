const TopUpService = require("../services/topUpService");
const { verifyAndAutoTopUp } = require("../services/topUpService");

// Add this new function to your existing topUpController.js
const autoVerifyTopUp = async (req, res) => {
  try {
    const { userId, referenceId } = req.body;

    if (!userId || !referenceId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Reference ID are required",
      });
    }

    const result = await verifyAndAutoTopUp(userId, referenceId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in auto top-up:", error);

    const statusCode =
      error.message.includes("Invalid") ||
      error.message.includes("not found") ||
      error.message.includes("already exists") ||
      error.message.includes("already used")
        ? 400
        : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

// Controller to create a new top-up request
const createTopUp = async (req, res) => {
  const { userId, referenceId, amount, submittedBy } = req.body;

  try {
    const newTopUp = await TopUpService.createTopUp(
      userId,
      referenceId,
      amount,
      submittedBy
    );
    res.status(201).json(newTopUp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Controller for Admin to approve or reject top-up
const updateTopUpStatus = async (req, res) => {
  const { topUpId, status } = req.body;

  try {
    const updatedTopUp = await TopUpService.updateTopUpStatus(topUpId, status);
    res.status(200).json(updatedTopUp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Controller to fetch top-ups with optional filters
const getTopUps = async (req, res) => {
  const { startDate, endDate, status } = req.query; // Status filter (Pending, Approved, Rejected)

  try {
    const topUps = await TopUpService.getTopUps(startDate, endDate, status);
    res.status(200).json(topUps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const fetchTopUps = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Fetch all top-ups (filtered if dates are provided)
    const topUps = await TopUpService.getAllTopUps(startDate, endDate);

    res.status(200).json({ success: true, data: topUps });
  } catch (error) {
    console.error("Error fetching top-ups:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  createTopUp,
  updateTopUpStatus,
  getTopUps,
  fetchTopUps,
  autoVerifyTopUp,
};
