// Socket event emitter utility
// Import io from index.js when needed

const SOCKET_EVENTS = {
  NEW_ORDER: 'new-order',
  NEW_TOPUP: 'new-topup',
  ORDER_STATUS_UPDATE: 'order-status-update',
  NEW_SHOP_ORDER: 'new-shop-order',
  DATA_REFRESH: 'data-refresh',
  TRANSACTION_UPDATE: 'transaction-update',
};

// Emit event to all connected clients
const emitToAll = (io, event, data) => {
  if (io) {
    // console.log(`[Socket] Emitting ${event} to all clients`);
    io.emit(event, data);
  }
};

// Emit new order event
const emitNewOrder = (io, orderData) => {
  emitToAll(io, SOCKET_EVENTS.NEW_ORDER, {
    type: 'new-order',
    message: 'New order received',
    data: orderData,
    timestamp: new Date().toISOString()
  });
  // Also emit general data refresh
  emitToAll(io, SOCKET_EVENTS.DATA_REFRESH, {
    type: 'order',
    timestamp: new Date().toISOString()
  });
};

// Emit new topup event
const emitNewTopup = (io, topupData) => {
  emitToAll(io, SOCKET_EVENTS.NEW_TOPUP, {
    type: 'new-topup',
    message: 'New top-up received',
    data: topupData,
    timestamp: new Date().toISOString()
  });
  // Also emit general data refresh
  emitToAll(io, SOCKET_EVENTS.DATA_REFRESH, {
    type: 'topup',
    timestamp: new Date().toISOString()
  });
};

// Emit order status update event
const emitOrderStatusUpdate = (io, orderData) => {
  emitToAll(io, SOCKET_EVENTS.ORDER_STATUS_UPDATE, {
    type: 'order-status-update',
    message: 'Order status updated',
    data: orderData,
    timestamp: new Date().toISOString()
  });
  emitToAll(io, SOCKET_EVENTS.DATA_REFRESH, {
    type: 'order-status',
    timestamp: new Date().toISOString()
  });
};

// Emit new shop order event
const emitNewShopOrder = (io, shopOrderData) => {
  emitToAll(io, SOCKET_EVENTS.NEW_SHOP_ORDER, {
    type: 'new-shop-order',
    message: 'New shop order received',
    data: shopOrderData,
    timestamp: new Date().toISOString()
  });
  emitToAll(io, SOCKET_EVENTS.DATA_REFRESH, {
    type: 'shop-order',
    timestamp: new Date().toISOString()
  });
};

// Emit transaction update event
const emitTransactionUpdate = (io, transactionData) => {
  emitToAll(io, SOCKET_EVENTS.TRANSACTION_UPDATE, {
    type: 'transaction-update',
    message: 'Transaction recorded',
    data: transactionData,
    timestamp: new Date().toISOString()
  });
  emitToAll(io, SOCKET_EVENTS.DATA_REFRESH, {
    type: 'transaction',
    timestamp: new Date().toISOString()
  });
};

// Emit general data refresh
const emitDataRefresh = (io, dataType) => {
  emitToAll(io, SOCKET_EVENTS.DATA_REFRESH, {
    type: dataType,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  SOCKET_EVENTS,
  emitToAll,
  emitNewOrder,
  emitNewTopup,
  emitOrderStatusUpdate,
  emitNewShopOrder,
  emitTransactionUpdate,
  emitDataRefresh,
};
