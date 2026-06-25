const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  productId:   String,
  productName: String,
  quantity:    { type: Number, required: true },
  unitCost:    { type: Number, required: true },
  lineTotal:   { type: Number, required: true },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  returnNumber:   { type: String, required: true },
  purchaseOrderId:{ type: String, required: true },
  vendorId:       String,
  vendorName:     String,
  returnDate:     { type: String, required: true },
  reason:         String,
  status:         { type: String, enum: ['posted', 'cancelled'], default: 'posted' },
  totalAmount:    { type: Number, default: 0 },
  items:          [itemSchema],
  isDeleted:      { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ tenantId: 1, returnNumber: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseReturn', schema);
