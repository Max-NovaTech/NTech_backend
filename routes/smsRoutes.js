const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');

// Route for SMS Forwarder app to send messages
router.post('/', (req, res) => smsController.receiveSms(req, res));

// Route to get unprocessed SMS (admin use)
router.get('/unprocessed', (req, res) => smsController.getUnprocessedSms(req, res));

router.put('/:id/mark-processed', smsController.markAsProcessed);

router.get('/payment-received', smsController.getPaymentReceivedMessages);

// Route to verify transaction amount for shop orders
router.post('/verify/amount', (req, res) => smsController.verifyTransactionAmount(req, res));

module.exports = router;