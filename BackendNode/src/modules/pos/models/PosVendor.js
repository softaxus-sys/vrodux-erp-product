const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  name:          { type: String, required: true },
  code:          String,
  category:      String,
  contactPerson: String,
  email:         String,
  phone:         String,
  address:       String,
  taxNumber:     String,
  paymentTerms:  String,
  currency:      { type: String, default: 'AED' },
  notes:         String,
  status:        { type: String, enum: ['active', 'inactive'], default: 'active' },
  rating:        { type: Number, default: 0 },
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     Date,
}, { versionKey: false });
module.exports = mongoose.model('PosVendor', schema);
