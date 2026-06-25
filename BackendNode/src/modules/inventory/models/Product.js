const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  name:         { type: String, required: true },
  sku:          { type: String, required: true },
  barcode:      String,
  description:  String,
  categoryId:   String,
  categoryName: String,
  brandId:      String,
  brandName:    String,
  uomId:        String,
  uomName:      String,
  costPrice:    { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  taxRate:      { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
  isDeleted:    { type: Boolean, default: false },
  imageUrl:     String,
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

schema.index({ tenantId: 1, sku: 1 }, { unique: true });
schema.index({ tenantId: 1, barcode: 1 }, { sparse: true });

module.exports = mongoose.model('Product', schema);
