const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  date:        { type: String, required: true },
  description: String,
  reference:   String,
  debit:       { type: Number, default: 0 },
  credit:      { type: Number, default: 0 },
  balance:     { type: Number, default: 0 },
  type:        String,
  isReconciled:{ type: Boolean, default: false },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  accountName:   { type: String, required: true },
  accountNumber: { type: String, required: true },
  bankName:      { type: String, required: true },
  currency:      { type: String, default: 'AED' },
  balance:       { type: Number, default: 0 },
  isActive:      { type: Boolean, default: true },
  isDefault:     { type: Boolean, default: false },
  isDeleted:     { type: Boolean, default: false },
  transactions:  [transactionSchema],
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     Date,
}, { versionKey: false });

module.exports = mongoose.model('BankAccount', schema);
