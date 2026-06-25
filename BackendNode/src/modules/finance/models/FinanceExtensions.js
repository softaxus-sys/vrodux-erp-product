const mongoose = require('mongoose');

const exchangeRateSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  fromCurrency: { type: String, required: true },
  toCurrency:   { type: String, required: true },
  rate:         { type: Number, required: true },
  effectiveDate:{ type: String, required: true },
  isActive:     { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now },
}, { versionKey: false });

const fiscalPeriodSchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  name:      { type: String, required: true },
  startDate: { type: String, required: true },
  endDate:   { type: String, required: true },
  status:    { type: String, enum: ['open', 'closed'], default: 'open' },
  closedAt:  Date,
  closedBy:  String,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const taxPeriodSchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  period:    { type: String, required: true },
  startDate: String,
  endDate:   String,
  totalTax:  { type: Number, default: 0 },
  status:    { type: String, enum: ['open', 'filed', 'paid'], default: 'open' },
  filedAt:   Date,
  paidAt:    Date,
  notes:     String,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const recurringInvoiceSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  customerId:   String,
  customerName: String,
  frequency:    { type: String, enum: ['weekly', 'monthly', 'quarterly', 'annually'], default: 'monthly' },
  nextRunDate:  String,
  lastRunDate:  String,
  status:       { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active' },
  subtotal:     { type: Number, default: 0 },
  taxRate:      { type: Number, default: 0 },
  taxAmount:    { type: Number, default: 0 },
  totalAmount:  { type: Number, default: 0 },
  notes:        String,
  items:        [{ description: String, quantity: Number, unitPrice: Number, lineTotal: Number }],
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

const voucherLineSchema = new mongoose.Schema({
  accountId:   String,
  accountCode: String,
  accountName: String,
  description: String,
  debit:       { type: Number, default: 0 },
  credit:      { type: Number, default: 0 },
}, { _id: true });

const paymentVoucherSchema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  voucherNumber: String,
  payeeId:       String,
  payeeName:     String,
  paymentDate:   String,
  amount:        { type: Number, default: 0 },
  paymentMethod: String,
  reference:     String,
  description:   String,
  lines:         [voucherLineSchema],
  status:        { type: String, enum: ['draft', 'posted', 'voided'], default: 'draft' },
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     Date,
}, { versionKey: false });

const receiptVoucherSchema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  voucherNumber: String,
  payerId:       String,
  payerName:     String,
  receiptDate:   String,
  amount:        { type: Number, default: 0 },
  paymentMethod: String,
  reference:     String,
  description:   String,
  lines:         [voucherLineSchema],
  status:        { type: String, enum: ['draft', 'posted', 'voided'], default: 'draft' },
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     Date,
}, { versionKey: false });

const financeCustomerSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  email:       String,
  phone:       String,
  address:     String,
  taxNumber:   String,
  creditLimit: { type: Number, default: 0 },
  balance:     { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

const accountTypeSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  code:         { type: String, required: true },
  name:         { type: String, required: true },
  normalBalance:{ type: String, enum: ['debit', 'credit'], default: 'debit' },
  parentId:     { type: String, default: null },
  sortOrder:    { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = {
  ExchangeRate:       mongoose.model('ExchangeRate', exchangeRateSchema),
  FiscalPeriod:       mongoose.model('FiscalPeriod', fiscalPeriodSchema),
  TaxPeriod:          mongoose.model('TaxPeriod', taxPeriodSchema),
  RecurringInvoice:   mongoose.model('RecurringInvoice', recurringInvoiceSchema),
  PaymentVoucher:     mongoose.model('PaymentVoucher', paymentVoucherSchema),
  ReceiptVoucher:     mongoose.model('ReceiptVoucher', receiptVoucherSchema),
  FinanceCustomer:    mongoose.model('FinanceCustomer', financeCustomerSchema),
  AccountType:        mongoose.model('AccountType', accountTypeSchema),
};
