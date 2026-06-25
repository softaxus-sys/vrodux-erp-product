const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  projectId: { type: String, required: true },
  name:      { type: String, required: true },
  color:     { type: String, default: '#6B7280' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
module.exports = mongoose.model('Label', schema);
