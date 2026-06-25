const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  tenantId:    { type: String, index: true },
  name:        { type: String, required: true },
  description: String,
  isSystem:    { type: Boolean, default: false },
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

roleSchema.index({ tenantId: 1, name: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Role', roleSchema);
