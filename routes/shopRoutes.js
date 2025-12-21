const express = require('express');
const shopController = require('../controllers/shopController');

const router = express.Router();

// Place shop order (guest users)
router.post('/order', shopController.placeShopOrder);

// Get all shop orders (for admin)
router.get('/orders', shopController.getAllShopOrders);

// File a complaint
router.post('/complaint', shopController.fileComplaint);

// Get all complaints (for admin)
router.get('/complaints', shopController.getAllComplaints);

// Get pending complaints count (for admin notification)
router.get('/complaints/count', shopController.getPendingComplaintsCount);

// Update complaint status
router.put('/complaints/:id/status', shopController.updateComplaintStatus);

// Delete complaint
router.delete('/complaints/:id', shopController.deleteComplaint);

module.exports = router;
