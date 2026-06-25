const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  code:        String,
  address:     String,
  city:        String,
  country:     String,
  contactName: String,
  contactPhone:String,
  isDefault:   { type: Boolean, default: false },
  isActive:    { type: Boolean, default: true },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

module.exports = mongoose.model('Warehouse', schema);
