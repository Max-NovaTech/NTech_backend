// routes/salesRoutes.js
const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// Get daily sales for authenticated user
router.get('/daily', (req, res) => {
  //console.log('Daily route hit');
  salesController.getDailySales(req, res);
});

// Get sales summary for a date range
router.get('/summary', (req, res) => {
  // console.log('Summary route hit');
  salesController.getSalesSummary(req, res);
});

module.exports = router;