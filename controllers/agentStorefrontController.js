const agentStorefrontService = require('../services/agentStorefrontService');

const getStorefront = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const storefront = await agentStorefrontService.getStorefrontByAgentId(agentId);
    res.json(storefront || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createOrUpdateStorefront = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const storefront = await agentStorefrontService.createOrUpdateStorefront(agentId, req.body);
    res.json(storefront);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getAvailableProducts = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const products = await agentStorefrontService.getAvailableProductsForAgent(agentId);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addProduct = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { productId, customPrice } = req.body;
    const product = await agentStorefrontService.addProductToStorefront(agentId, productId, customPrice);
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateProductPrice = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { storefrontProductId, customPrice } = req.body;
    const product = await agentStorefrontService.updateProductPrice(agentId, storefrontProductId, customPrice);
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const removeProduct = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { storefrontProductId } = req.params;
    await agentStorefrontService.removeProductFromStorefront(agentId, storefrontProductId);
    res.json({ success: true, message: 'Product removed from storefront' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getStorefrontProducts = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const products = await agentStorefrontService.getStorefrontProducts(agentId);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPublicStore = async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const store = await agentStorefrontService.getPublicStoreProducts(storeSlug);
    res.json(store);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

const createOrder = async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const order = await agentStorefrontService.createAgentStoreOrder(storeSlug, req.body);
    res.json({ success: true, message: 'Order placed successfully', order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { status } = req.query;
    const orders = await agentStorefrontService.getAgentStoreOrders(agentId, status);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const approveOrder = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { orderId } = req.params;
    const order = await agentStorefrontService.approveAgentStoreOrder(agentId, orderId);
    res.json({ success: true, message: 'Order approved', order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const rejectOrder = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { orderId } = req.params;
    const order = await agentStorefrontService.rejectAgentStoreOrder(agentId, orderId);
    res.json({ success: true, message: 'Order rejected', order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getProfitStats = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const stats = await agentStorefrontService.getAgentProfitStats(agentId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addMultipleProducts = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products array is required' });
    }
    const result = await agentStorefrontService.addMultipleProductsToStorefront(agentId, products);
    res.json({ success: true, message: `${result.length} products added to storefront`, products: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getApprovedOrdersInCart = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const orders = await agentStorefrontService.getApprovedOrdersInCart(agentId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markOrdersAsSubmitted = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { orderIds } = req.body;
    if (!orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ error: 'Order IDs array is required' });
    }
    await agentStorefrontService.markOrdersAsSubmitted(agentId, orderIds);
    res.json({ success: true, message: 'Orders marked as submitted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const regenerateLink = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const storefront = await agentStorefrontService.regenerateStoreLink(agentId);
    res.json({ success: true, storeSlug: storefront.storeSlug });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getStorefront,
  createOrUpdateStorefront,
  getAvailableProducts,
  addProduct,
  updateProductPrice,
  removeProduct,
  getStorefrontProducts,
  getPublicStore,
  createOrder,
  getOrders,
  approveOrder,
  rejectOrder,
  getProfitStats,
  addMultipleProducts,
  getApprovedOrdersInCart,
  markOrdersAsSubmitted,
  regenerateLink
};
