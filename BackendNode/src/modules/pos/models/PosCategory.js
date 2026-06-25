const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  description: String,
  color:       String,
  sortOrder:   { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });
module.exports = mongoose.model('PosCategory', schema);
