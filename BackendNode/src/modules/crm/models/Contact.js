const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:   { type: String, required: true, index: true },
  firstName:  { type: String, required: true },
  lastName:   String,
  email:      String,
  phone:      String,
  company:    String,
  jobTitle:   String,
  customerId: String,
  isDeleted:  { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
}, { versionKey: false });
module.exports = mongoose.model('Contact', schema);
