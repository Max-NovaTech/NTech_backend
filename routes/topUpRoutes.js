const express = require('express');
const router = express.Router();
const TopUpController = require('../controllers/topUpController');
const { autoVerifyTopUp } = require('../controllers/topUpController');

// Route to create a new top-up request
router.post('/topups', TopUpController.createTopUp);

// Route for Admin to approve/reject a top-up
router.patch('/topups/approve', TopUpController.updateTopUpStatus);

router.post('/verify-sms', autoVerifyTopUp);


// Route to get all top-ups (filtered by date/status)
router.get('/topups', TopUpController.getTopUps);

module.exports = router;
