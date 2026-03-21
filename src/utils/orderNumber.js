/**
 * Generate unique order number
 * Format: ORD-YYYYMMDD-XXXX
 */

const generateOrderNumber = async () => {
  const Order = require('../models/order.model');
  
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  // Find today's orders count
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  const count = await Order.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `ORD-${dateStr}-${sequence}`;
};

module.exports = { generateOrderNumber };
