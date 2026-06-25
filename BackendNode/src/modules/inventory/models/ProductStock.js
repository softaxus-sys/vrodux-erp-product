const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchNumber:   String,
  warehouseId:   String,
  warehouseName: String,
  quantity:      { type: Number, default: 0 },
  expiryDate:    String,
  receivedAt:    Date,
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  productId:   { type: String, required: true },
  productName: String,
  totalQty:    { type: Number, default: 0 },
  batches:     [batchSchema],
  updatedAt:   Date,
}, { versionKey: false });

schema.index({ tenantId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('ProductStock', schema);
