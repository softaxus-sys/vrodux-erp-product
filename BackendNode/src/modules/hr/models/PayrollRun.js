const mongoose = require('mongoose');

const slipSchema = new mongoose.Schema({
  employeeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName:  { type: String, required: true },
  jobTitle:      String,
  departmentName:String,
  basicSalary:   { type: Number, required: true },
  allowances:    { type: Number, default: 0 },
  deductions:    { type: Number, default: 0 },
  netSalary:     { type: Number, required: true },
  notes:         String,
  emailSentAt:   Date,
  emailSentTo:   String,
}, { versionKey: false, _id: true });

const payrollRunSchema = new mongoose.Schema({
  tenantId:        { type: String, required: true, index: true },
  period:          { type: String, required: true },
  notes:           String,
  status:          { type: String, enum: ['draft', 'processed', 'paid', 'rejected'], default: 'draft' },
  createdByUserId: String,
  createdByName:   String,
  rejectionReason: String,
  rejectedByName:  String,
  rejectedAt:      Date,
  processedAt:     Date,
  paidAt:          Date,
  slips:           [slipSchema],
  isDeleted:       { type: Boolean, default: false },
  createdAt:       { type: Date, default: Date.now },
  updatedAt:       Date,
}, { versionKey: false });

module.exports = mongoose.model('PayrollRun', payrollRunSchema);
