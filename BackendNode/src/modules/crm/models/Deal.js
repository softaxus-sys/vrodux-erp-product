const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:   { type: String, required: true, index: true },
  title:      { type: String, required: true },
  customerId: String,
  customerName: String,
  contactId:  String,
  value:      { type: Number, default: 0 },
  currency:   { type: String, default: 'AED' },
  stage:      { type: String, enum: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'], default: 'prospecting' },
  probability:{ type: Number, default: 0 },
  expectedClose: String,
  assignedTo: String,
  notes:      String,
  isDeleted:  { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  Date,
}, { versionKey: false });
module.exports = mongoose.model('Deal', schema);
