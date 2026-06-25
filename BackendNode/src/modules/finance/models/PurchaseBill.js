const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity:    { type: Number, required: true },
  unitPrice:   { type: Number, required: true },
  lineTotal:   { type: Number, required: true },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  billNumber:     { type: String, required: true },
  supplierId:     String,
  supplierName:   { type: String, required: true },
  billDate:       { type: String, required: true },
  dueDate:        { type: String, required: true },
  taxRate:        { type: Number, default: 0 },
  currencyCode:   { type: String, default: 'AED' },
  subtotal:       { type: Number, default: 0 },
  taxAmount:      { type: Number, default: 0 },
  totalAmount:    { type: Number, default: 0 },
  paidAmount:     { type: Number, default: 0 },
  dueAmount:      { type: Number, default: 0 },
  reference:      String,
  notes:          String,
  status:         { type: String, enum: ['draft', 'approved', 'paid', 'cancelled'], default: 'draft' },
  items:          [itemSchema],
  isDeleted:      { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      Date,
}, { versionKey: false });

schema.index({ tenantId: 1, billNumber: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseBill', schema);
