const express = require('express');
const router = express.Router();
const { pasteAndProcessOrders } = require('../controllers/pasteController');

// Route for pasting orders from text area
router.post('/paste-orders', pasteAndProcessOrders);

module.exports = router;
