const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema({
  accountId:   String,
  accountCode: String,
  accountName: String,
  description: String,
  debit:       { type: Number, default: 0 },
  credit:      { type: Number, default: 0 },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  journalNumber: { type: String, required: true },
  period:        String,
  reference:     String,
  description:   { type: String, required: true },
  entryDate:     { type: String, required: true },
  status:        { type: String, enum: ['draft', 'posted', 'voided'], default: 'draft' },
  totalDebit:    { type: Number, default: 0 },
  totalCredit:   { type: Number, default: 0 },
  lines:         [lineSchema],
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     Date,
}, { versionKey: false });

schema.index({ tenantId: 1, journalNumber: 1 }, { unique: true });

module.exports = mongoose.model('JournalEntry', schema);
