const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  description: String,
  managerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = mongoose.model('Department', schema);
