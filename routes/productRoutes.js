// routes/productRoutes.js
const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

// Admin: Add product
router.post('/add', productController.addProduct);

// Get all products
router.get('/', productController.getAllProducts);

// Get products for shop (showOnShop = true) - must be before /:id
router.get('/shop', productController.getShopProducts);

// Get a single product
router.get('/:id', productController.getProductById);

// Admin: Update product
router.put('/update/:id', productController.updateProduct);

// Set product stock to zero
router.put('/zero-stock/:id', productController.setProductStockToZero);

router.patch('/reset-all-stock-to-zero', productController.resetAllProductStock);


// Admin: Delete product
router.delete('/delete/:id', productController.deleteProduct);

// Toggle showOnShop for a product
router.put('/toggle-shop/:id', productController.toggleShowOnShop);

module.exports = router;
