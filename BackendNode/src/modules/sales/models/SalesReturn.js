const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  productId:   String,
  productName: String,
  quantity:    { type: Number, required: true },
  unitPrice:   { type: Number, required: true },
  lineTotal:   { type: Number, required: true },
  reason:      String,
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  returnNumber: { type: String, required: true },
  salesOrderId: { type: String, required: true },
  customerId:   String,
  customerName: String,
  returnDate:   { type: String, required: true },
  reason:       String,
  status:       { type: String, enum: ['pending', 'approved', 'rejected', 'posted', 'cancelled'], default: 'pending' },
  actionBy:     String,
  actionByName: String,
  actionAt:     Date,
  rejectionReason:String,
  totalAmount:  { type: Number, default: 0 },
  items:        [itemSchema],
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ tenantId: 1, returnNumber: 1 }, { unique: true });

module.exports = mongoose.model('SalesReturn', schema);
