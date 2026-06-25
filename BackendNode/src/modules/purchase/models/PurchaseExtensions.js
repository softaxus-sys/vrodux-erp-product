const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  name:          { type: String, required: true },
  email:         String,
  phone:         String,
  address:       String,
  taxNumber:     String,
  category:      String,
  paymentTerms:  String,
  currency:      { type: String, default: 'AED' },
  bankAccount:   String,
  iban:          String,
  isActive:      { type: Boolean, default: true },
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
}, { versionKey: false });

const approvalSchema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  resourceType:  { type: String, required: true },
  resourceId:    { type: String, required: true },
  requestedBy:   String,
  requestedByName:String,
  requestedAt:   { type: Date, default: Date.now },
  approvedBy:    String,
  approvedByName:String,
  approvedAt:    Date,
  rejectedBy:    String,
  rejectedByName:String,
  rejectedAt:    Date,
  rejectionReason:String,
  status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  amount:        Number,
  notes:         String,
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = {
  Vendor:   mongoose.model('Vendor', vendorSchema),
  Approval: mongoose.model('Approval', approvalSchema),
};
