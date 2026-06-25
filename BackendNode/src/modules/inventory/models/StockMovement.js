const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  productId:   { type: String, required: true },
  productName: String,
  warehouseId: String,
  warehouseName:String,
  type:        { type: String, enum: ['receipt', 'write-off', 'adjustment', 'count-correction', 'transfer-in', 'transfer-out'], required: true },
  quantity:    { type: Number, required: true },
  unitCost:    { type: Number, default: 0 },
  reference:   String,
  notes:       String,
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ tenantId: 1, productId: 1 });

module.exports = mongoose.model('StockMovement', schema);
