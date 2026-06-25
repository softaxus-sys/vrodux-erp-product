const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, required: true },
  leaveType:    { type: String, required: true },
  startDate:    { type: String, required: true },
  endDate:      { type: String, required: true },
  days:         { type: Number, required: true },
  reason:       String,
  status:       { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  rejectionReason: String,
  approvedBy:   String,
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

module.exports = mongoose.model('Leave', schema);
