const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema({
  productId:       String,
  description:     { type: String, required: true },
  quantity:        { type: Number, required: true },
  unitPrice:       { type: Number, required: true },
  discountPercent: { type: Number, default: 0 },
  taxRate:         { type: Number, default: 0 },
  lineTotal:       { type: Number, required: true },
}, { _id: true });

const paymentSchema = new mongoose.Schema({
  method:    { type: String, required: true },
  amount:    { type: Number, required: true },
  reference: String,
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  sessionId:      String,
  cashierId:      String,
  cashierName:    String,
  customerId:     String,
  customerName:   String,
  type:           { type: String, enum: ['sale', 'refund', 'hold'], default: 'sale' },
  status:         { type: String, enum: ['completed', 'voided', 'held', 'refunded'], default: 'completed' },
  subtotal:       { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxAmount:      { type: Number, default: 0 },
  totalAmount:    { type: Number, default: 0 },
  amountPaid:     { type: Number, default: 0 },
  change:         { type: Number, default: 0 },
  voidReason:     String,
  refundReason:   String,
  originalTransactionId: String,
  lineItems:      [lineSchema],
  payments:       [paymentSchema],
  notes:          String,
  receiptNumber:  String,
  isDeleted:      { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ tenantId: 1, sessionId: 1 });

module.exports = mongoose.model('PosTransaction', schema);
