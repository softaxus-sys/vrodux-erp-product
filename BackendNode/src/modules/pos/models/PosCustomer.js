const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  email:       String,
  phone:       String,
  address:     String,
  groupId:     String,
  groupName:   String,
  loyaltyPoints: { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });
module.exports = mongoose.model('PosCustomer', schema);
