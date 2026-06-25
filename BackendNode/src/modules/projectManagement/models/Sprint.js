const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  projectId: { type: String, required: true },
  name:      { type: String, required: true },
  goal:      String,
  startDate: String,
  endDate:   String,
  status:    { type: String, enum: ['planning', 'active', 'completed'], default: 'planning' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
}, { versionKey: false });
schema.index({ tenantId: 1, projectId: 1 });
module.exports = mongoose.model('Sprint', schema);
