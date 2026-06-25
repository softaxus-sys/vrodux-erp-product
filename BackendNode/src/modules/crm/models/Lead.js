const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  email:       String,
  phone:       String,
  company:     String,
  source:      String,
  status:      { type: String, enum: ['new', 'contacted', 'qualified', 'converted', 'lost'], default: 'new' },
  assignedTo:  String,
  notes:       String,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });
module.exports = mongoose.model('Lead', schema);
