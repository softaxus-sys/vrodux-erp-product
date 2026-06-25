const mongoose = require('mongoose');

const cashMovementSchema = new mongoose.Schema({
  type:      { type: String, enum: ['cash-in', 'cash-out'], required: true },
  amount:    { type: Number, required: true },
  reason:    String,
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const schema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  cashierId:     String,
  cashierName:   String,
  status:        { type: String, enum: ['open', 'suspended', 'closed'], default: 'open' },
  openingCash:   { type: Number, default: 0 },
  closingCash:   { type: Number, default: 0 },
  totalSales:    { type: Number, default: 0 },
  totalRefunds:  { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 },
  openedAt:      { type: Date, default: Date.now },
  closedAt:      Date,
  suspendedAt:   Date,
  notes:         String,
  cashMovements: [cashMovementSchema],
  isDeleted:     { type: Boolean, default: false },
}, { versionKey: false });

module.exports = mongoose.model('PosSession', schema);
