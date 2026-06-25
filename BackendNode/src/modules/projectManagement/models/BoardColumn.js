const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  projectId: { type: String, required: true },
  name:      { type: String, required: true },
  order:     { type: Number, default: 0 },
  color:     String,
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
schema.index({ tenantId: 1, projectId: 1 });
module.exports = mongoose.model('BoardColumn', schema);
