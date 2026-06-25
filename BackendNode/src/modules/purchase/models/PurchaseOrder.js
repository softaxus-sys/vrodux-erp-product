const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  productId:       String,
  productName:     { type: String, required: true },
  description:     String,
  orderedQuantity: { type: Number, required: true },
  unitCost:        { type: Number, required: true },
  lineTotal:       { type: Number, required: true },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  orderNumber:  { type: String, required: true },
  vendorId:     String,
  vendorName:   { type: String, required: true },
  orderDate:    { type: String, required: true },
  expectedDate: String,
  status:       { type: String, enum: ['draft', 'sent', 'partial', 'received', 'cancelled'], default: 'draft' },
  subtotal:     { type: Number, default: 0 },
  taxAmount:    { type: Number, default: 0 },
  totalAmount:  { type: Number, default: 0 },
  notes:        String,
  items:        [itemSchema],
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

schema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseOrder', schema);
