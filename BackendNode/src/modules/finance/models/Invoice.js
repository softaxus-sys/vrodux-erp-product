const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemName:    { type: String, required: true },
  description: String,
  quantity:    { type: Number, required: true },
  unitPrice:   { type: Number, required: true },
  taxRate:     { type: Number, default: 0 },
  lineTotal:   { type: Number, required: true },
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  invoiceNumber: { type: String, required: true },
  customerName:  { type: String, required: true },
  customerEmail: String,
  invoiceDate:   { type: String, required: true },
  dueDate:       { type: String, required: true },
  taxRate:       { type: Number, default: 0 },
  subtotal:      { type: Number, default: 0 },
  taxAmount:     { type: Number, default: 0 },
  totalAmount:   { type: Number, default: 0 },
  paidAmount:    { type: Number, default: 0 },
  dueAmount:     { type: Number, default: 0 },
  notes:         String,
  status:        { type: String, enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], default: 'draft' },
  items:         [itemSchema],
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     Date,
}, { versionKey: false });

invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
