const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  code:        { type: String, required: true },
  name:        { type: String, required: true },
  type:        { type: String, enum: ['asset', 'liability', 'equity', 'revenue', 'expense'], required: true },
  subtype:     String,
  parentId:    String,
  description: String,
  isActive:    { type: Boolean, default: true },
  isDeleted:   { type: Boolean, default: false },
  balance:     { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

schema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Account', schema);
