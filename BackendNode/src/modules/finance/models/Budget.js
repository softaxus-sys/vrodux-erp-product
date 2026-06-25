const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema({
  accountId:   String,
  accountName: String,
  budgeted:    { type: Number, default: 0 },
  actual:      { type: Number, default: 0 },
  variance:    { type: Number, default: 0 },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  period:      { type: String, required: true },
  startDate:   String,
  endDate:     String,
  status:      { type: String, enum: ['draft', 'active', 'closed'], default: 'draft' },
  totalBudget: { type: Number, default: 0 },
  totalActual: { type: Number, default: 0 },
  notes:       String,
  lines:       [lineSchema],
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

module.exports = mongoose.model('Budget', schema);
