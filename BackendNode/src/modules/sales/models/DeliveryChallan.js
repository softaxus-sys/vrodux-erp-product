const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  salesOrderItemId:  String,
  productId:         String,
  description:       { type: String, required: true },
  orderedQuantity:   { type: Number, required: true },
  deliveredQuantity: { type: Number, required: true },
  unitPrice:         { type: Number, required: true },
  lineTotal:         { type: Number, required: true },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  challanNumber: { type: String, required: true },
  salesOrderId:  { type: String, required: true },
  customerId:    String,
  challanDate:   { type: String, required: true },
  driverName:    String,
  notes:         String,
  status:        { type: String, enum: ['posted', 'cancelled'], default: 'posted' },
  items:         [itemSchema],
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ tenantId: 1, challanNumber: 1 }, { unique: true });

module.exports = mongoose.model('DeliveryChallan', schema);
