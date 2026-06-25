const mongoose = require('mongoose');

const quotationLineSchema = new mongoose.Schema({
  productId:   String,
  description: String,
  quantity:    { type: Number, default: 1 },
  unitPrice:   { type: Number, default: 0 },
  discount:    { type: Number, default: 0 },
  lineTotal:   { type: Number, default: 0 },
}, { _id: true });

const salesQuotationSchema = new mongoose.Schema({
  tenantId:         { type: String, required: true, index: true },
  quotationNumber:  { type: String, required: true },
  customerId:       String,
  customerName:     String,
  quotationDate:    String,
  validUntil:       String,
  items:            [quotationLineSchema],
  subtotal:         { type: Number, default: 0 },
  taxRate:          { type: Number, default: 0 },
  taxAmount:        { type: Number, default: 0 },
  discountAmount:   { type: Number, default: 0 },
  totalAmount:      { type: Number, default: 0 },
  notes:            String,
  terms:            String,
  status:           { type: String, enum: ['draft', 'sent', 'approved', 'rejected', 'converted', 'expired'], default: 'draft' },
  convertedOrderId: String,
  isDeleted:        { type: Boolean, default: false },
  createdAt:        { type: Date, default: Date.now },
  updatedAt:        Date,
}, { versionKey: false });

module.exports = mongoose.model('SalesQuotation', salesQuotationSchema);
