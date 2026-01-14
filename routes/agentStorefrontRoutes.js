const express = require('express');
const router = express.Router();
const agentStorefrontController = require('../controllers/agentStorefrontController');

router.get('/storefront/:agentId', agentStorefrontController.getStorefront);
router.post('/storefront/:agentId', agentStorefrontController.createOrUpdateStorefront);
router.get('/storefront/:agentId/available-products', agentStorefrontController.getAvailableProducts);
router.get('/storefront/:agentId/products', agentStorefrontController.getStorefrontProducts);
router.post('/storefront/:agentId/products', agentStorefrontController.addProduct);
router.put('/storefront/:agentId/products', agentStorefrontController.updateProductPrice);
router.delete('/storefront/:agentId/products/:storefrontProductId', agentStorefrontController.removeProduct);
router.post('/storefront/:agentId/regenerate-link', agentStorefrontController.regenerateLink);

router.get('/storefront/:agentId/orders', agentStorefrontController.getOrders);
router.post('/storefront/:agentId/orders/:orderId/approve', agentStorefrontController.approveOrder);
router.post('/storefront/:agentId/orders/:orderId/reject', agentStorefrontController.rejectOrder);
router.get('/storefront/:agentId/profit-stats', agentStorefrontController.getProfitStats);
router.post('/storefront/:agentId/products/bulk', agentStorefrontController.addMultipleProducts);
router.get('/storefront/:agentId/orders-in-cart', agentStorefrontController.getApprovedOrdersInCart);
router.post('/storefront/:agentId/mark-orders-submitted', agentStorefrontController.markOrdersAsSubmitted);

router.get('/store/:storeSlug', agentStorefrontController.getPublicStore);
router.post('/store/:storeSlug/order', agentStorefrontController.createOrder);

module.exports = router;
