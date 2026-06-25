const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:   { type: String, required: true, index: true },
  type:       { type: String, enum: ['call', 'email', 'meeting', 'task', 'note'], required: true },
  subject:    { type: String, required: true },
  description:String,
  relatedType:{ type: String, enum: ['lead', 'contact', 'deal', 'customer'] },
  relatedId:  String,
  dueDate:    String,
  status:     { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  assignedTo: String,
  isDeleted:  { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
}, { versionKey: false });
module.exports = mongoose.model('Activity', schema);
