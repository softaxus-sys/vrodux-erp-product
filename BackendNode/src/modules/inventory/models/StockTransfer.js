const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  productId:   { type: String, required: true },
  productName: String,
  quantity:    { type: Number, required: true },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:         { type: String, required: true, index: true },
  transferNumber:   { type: String, required: true },
  fromWarehouseId:  { type: String, required: true },
  fromWarehouseName:String,
  toWarehouseId:    { type: String, required: true },
  toWarehouseName:  String,
  status:           { type: String, enum: ['draft', 'submitted', 'approved', 'received'], default: 'draft' },
  transferDate:     String,
  notes:            String,
  items:            [itemSchema],
  isDeleted:        { type: Boolean, default: false },
  createdAt:        { type: Date, default: Date.now },
  updatedAt:        Date,
}, { versionKey: false });

module.exports = mongoose.model('StockTransfer', schema);
