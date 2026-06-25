const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  userName:  { type: String, required: true },
  userEmail: String,
  role:      { type: String, enum: ['owner', 'member', 'viewer'], default: 'member' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  key:         String,
  description: String,
  status:      { type: String, enum: ['active', 'archived', 'completed'], default: 'active' },
  leadId:      String,
  leadName:    String,
  startDate:   String,
  endDate:     String,
  members:     [memberSchema],
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

module.exports = mongoose.model('Project', schema);
