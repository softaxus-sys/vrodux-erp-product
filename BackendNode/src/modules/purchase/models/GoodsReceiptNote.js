const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  purchaseOrderItemId: String,
  productId:           String,
  description:         { type: String, required: true },
  orderedQuantity:     { type: Number, required: true },
  receivedQuantity:    { type: Number, required: true },
  unitCost:            { type: Number, required: true },
  lineTotal:           { type: Number, required: true },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  grnNumber:      { type: String, required: true },
  purchaseOrderId:{ type: String, required: true },
  vendorId:       String,
  grnDate:        { type: String, required: true },
  notes:          String,
  status:         { type: String, enum: ['posted', 'cancelled'], default: 'posted' },
  items:          [itemSchema],
  isDeleted:      { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ tenantId: 1, grnNumber: 1 }, { unique: true });

module.exports = mongoose.model('GoodsReceiptNote', schema);
