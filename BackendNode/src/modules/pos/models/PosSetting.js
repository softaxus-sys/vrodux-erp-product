const mongoose = require('mongoose');

// Generic key-value store for POS lookup tables
const taxRateSchema = new mongoose.Schema({ tenantId: String, name: String, rate: Number, isDeleted: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } }, { versionKey: false });
const currencySchema = new mongoose.Schema({ tenantId: String, code: String, name: String, symbol: String, rate: { type: Number, default: 1 }, isDeleted: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } }, { versionKey: false });
const paymentMethodSchema = new mongoose.Schema({ tenantId: String, name: String, type: String, isActive: { type: Boolean, default: true }, isDeleted: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } }, { versionKey: false });
const paymentTermSchema = new mongoose.Schema({ tenantId: String, name: String, dueDays: { type: Number, default: 0 }, discountPercent: { type: Number, default: 0 }, isDeleted: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } }, { versionKey: false });
const customerGroupSchema = new mongoose.Schema({ tenantId: String, name: String, discountPercent: { type: Number, default: 0 }, isDeleted: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } }, { versionKey: false });
const voucherSchema = new mongoose.Schema({ tenantId: String, code: String, type: { type: String, enum: ['percent', 'fixed'] }, value: Number, minSubtotal: { type: Number, default: 0 }, maxUses: Number, usedCount: { type: Number, default: 0 }, expiresAt: Date, isActive: { type: Boolean, default: true }, isDeleted: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } }, { versionKey: false });

module.exports = {
  TaxRate:       mongoose.model('PosTaxRate', taxRateSchema),
  Currency:      mongoose.model('PosCurrency', currencySchema),
  PaymentMethod: mongoose.model('PosPaymentMethod', paymentMethodSchema),
  PaymentTerm:   mongoose.model('PosPaymentTerm', paymentTermSchema),
  CustomerGroup: mongoose.model('PosCustomerGroup', customerGroupSchema),
  Voucher:       mongoose.model('PosVoucher', voucherSchema),
};
