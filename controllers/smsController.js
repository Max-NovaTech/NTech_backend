const smsService = require("../services/smsService");

class SmsController {
  // Receive SMS from forwarder app
  async receiveSms(req, res) {
    try {
      const { from, message, timestamp } = req.body;

      if (!from || !message) {
        return res.status(400).json({
          success: false,
          message: "Phone number and message are required",
        });
      }

      //console.log("Received SMS:", { from, message, timestamp });

      // Save SMS using service
      const smsRecord = await smsService.saveSmsMessage(from, message);

      //console.log("SMS saved:", smsRecord);

      res.status(200).json({
        success: true,
        message: "SMS received and processed successfully",
        data: {
          id: smsRecord.id,
          reference: smsRecord.reference,
          amount: smsRecord.amount,
        },
      });
    } catch (error) {
      console.error("Error processing SMS:", error);
      res.status(500).json({
        success: false,
        message: "Error processing SMS",
        error: error.message,
      });
    }
  }

  // Get unprocessed SMS messages (admin)
  async getUnprocessedSms(req, res) {
    try {
      const unprocessedSms = await smsService.getUnprocessedSms();

      res.status(200).json({
        success: true,
        data: unprocessedSms,
        count: unprocessedSms.length,
      });
    } catch (error) {
      console.error("Error fetching SMS:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching SMS messages",
        error: error.message,
      });
    }
  }

  async markAsProcessed(req, res) {
    const { id } = req.params;

    try {
      const updatedSms = await smsService.markSmsAsProcessed(parseInt(id));
      res.status(200).json({
        success: true,
        message: "SMS marked as processed",
        data: updatedSms,
      });
    } catch (error) {
      console.error("Controller error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to mark SMS as processed",
        error: error.message,
      });
    }
  }

  async getPaymentReceivedMessages(req, res) {
    try {
      const messages = await smsService.getPaymentReceivedMessages();
      res.status(200).json({ success: true, data: messages });
    } catch (error) {
      console.error("Controller Error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Verify transaction amount for shop orders
  async verifyTransactionAmount(req, res) {
    try {
      const { transactionId, productPrice } = req.body;

      if (!transactionId || productPrice === undefined) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID and product price are required"
        });
      }

      // Find the SMS message with this transaction ID
      const smsRecord = await smsService.findSmsByReference(transactionId);

      if (!smsRecord) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID not found in our system. Please verify your transaction ID."
        });
      }

      const transactionAmount = smsRecord.amount;

      // Check if transaction amount is sufficient
      if (transactionAmount < productPrice) {
        return res.status(400).json({
          success: false,
          message: `Insufficient payment. Transaction amount (GHS ${transactionAmount.toFixed(2)}) is less than product price (GHS ${productPrice.toFixed(2)}). Please select a product that costs GHS ${transactionAmount.toFixed(2)} or less.`,
          transactionAmount: transactionAmount,
          productPrice: productPrice
        });
      }

      // Transaction is valid
      res.status(200).json({
        success: true,
        message: "Transaction verified successfully",
        transactionAmount: transactionAmount,
        productPrice: productPrice
      });
    } catch (error) {
      console.error("Error verifying transaction:", error);
      res.status(500).json({
        success: false,
        message: "Error verifying transaction",
        error: error.message
      });
    }
  }
}

module.exports = new SmsController();