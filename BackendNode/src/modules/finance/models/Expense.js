const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  title:       { type: String, required: true },
  category:    String,
  accountId:   String,
  accountName: String,
  amount:      { type: Number, required: true },
  currency:    { type: String, default: 'AED' },
  expenseDate: { type: String, required: true },
  reference:   String,
  description: String,
  receiptUrl:  String,
  status:      { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
  submittedBy: String,
  approvedBy:  String,
  approvedAt:  Date,
  paidAt:      Date,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

module.exports = mongoose.model('Expense', schema);
