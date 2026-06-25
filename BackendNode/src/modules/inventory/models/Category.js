const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  name:      { type: String, required: true },
  parentId:  String,
  description: String,
  isActive:  { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
module.exports = mongoose.model('ProductCategory', schema);
