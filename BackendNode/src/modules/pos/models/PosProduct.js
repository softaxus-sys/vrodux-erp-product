const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  name:         { type: String, required: true },
  sku:          String,
  barcode:      String,
  description:  String,
  categoryId:   String,
  categoryName: String,
  costPrice:    { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  taxRateId:    String,
  taxRate:      { type: Number, default: 0 },
  stockQty:     { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
  imageUrl:     String,
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

schema.index({ tenantId: 1, sku: 1 }, { sparse: true });
schema.index({ tenantId: 1, barcode: 1 }, { sparse: true });

module.exports = mongoose.model('PosProduct', schema);
