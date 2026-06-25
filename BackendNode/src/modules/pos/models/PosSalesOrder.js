const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  productId:       String,
  description:     { type: String, required: true },
  quantity:        { type: Number, required: true },
  unitPrice:       { type: Number, required: true },
  discountPercent: { type: Number, default: 0 },
  taxRate:         { type: Number, default: 0 },
  lineTotal:       { type: Number, required: true },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  orderNumber:  String,
  customerId:   String,
  customerName: String,
  status:       { type: String, enum: ['draft', 'confirmed', 'delivered', 'cancelled'], default: 'draft' },
  notes:        String,
  expectedDate: String,
  subTotal:     { type: Number, default: 0 },
  taxAmount:    { type: Number, default: 0 },
  total:        { type: Number, default: 0 },
  items:        [itemSchema],
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

module.exports = mongoose.model('PosSalesOrder', schema);
