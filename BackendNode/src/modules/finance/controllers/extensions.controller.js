const { ExchangeRate, FiscalPeriod, TaxPeriod, RecurringInvoice, PaymentVoucher, ReceiptVoucher, FinanceCustomer, AccountType } = require('../models/FinanceExtensions');
const { tenantFilter } = require('../../../middleware/auth');

const tf  = req => tenantFilter(req);
const tid = req => req.user.tenant_id;
const nf  = name => ({ code: `${name}.NotFound`, description: `${name} not found.` });

/* ─── Exchange Rates ─── */
exports.listRates = async (req, res, next) => {
  try { res.json(await ExchangeRate.find({ ...tf(req) }).sort({ effectiveDate: -1 })); } catch (err) { next(err); }
};
exports.createRate = async (req, res, next) => {
  try { res.status(201).json(await ExchangeRate.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.convertCurrency = async (req, res, next) => {
  try {
    const { from, to, amount } = req.query;
    if (from === to) return res.json({ amount: parseFloat(amount || 0), rate: 1 });
    const rate = await ExchangeRate.findOne({ ...tf(req), fromCurrency: from, toCurrency: to, isActive: true }).sort({ effectiveDate: -1 });
    if (!rate) return res.status(404).json({ code: 'ExchangeRate.NotFound', description: `No rate found for ${from} → ${to}.` });
    res.json({ amount: parseFloat(amount || 0) * rate.rate, rate: rate.rate, effectiveDate: rate.effectiveDate });
  } catch (err) { next(err); }
};

/* ─── Fiscal Periods ─── */
exports.listFiscalPeriods = async (req, res, next) => {
  try { res.json(await FiscalPeriod.find({ ...tf(req) }).sort({ startDate: -1 })); } catch (err) { next(err); }
};
exports.createFiscalPeriod = async (req, res, next) => {
  try { res.status(201).json(await FiscalPeriod.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.closeFiscalPeriod = async (req, res, next) => {
  try {
    const p = await FiscalPeriod.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'open' }, { status: 'closed', closedAt: new Date(), closedBy: req.user.name || req.user.email }, { new: true });
    if (!p) return res.status(404).json(nf('FiscalPeriod'));
    res.json(p);
  } catch (err) { next(err); }
};
exports.reopenFiscalPeriod = async (req, res, next) => {
  try {
    const p = await FiscalPeriod.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'closed' }, { status: 'open', closedAt: null, closedBy: null }, { new: true });
    if (!p) return res.status(404).json(nf('FiscalPeriod'));
    res.json(p);
  } catch (err) { next(err); }
};

/* ─── Tax Periods ─── */
exports.listTaxPeriods = async (req, res, next) => {
  try { res.json(await TaxPeriod.find({ ...tf(req) }).sort({ period: -1 })); } catch (err) { next(err); }
};
exports.createTaxPeriod = async (req, res, next) => {
  try { res.status(201).json(await TaxPeriod.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.fileTaxPeriod = async (req, res, next) => {
  try {
    const p = await TaxPeriod.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'open' }, { status: 'filed', filedAt: new Date(), notes: req.body.notes }, { new: true });
    if (!p) return res.status(404).json(nf('TaxPeriod'));
    res.json(p);
  } catch (err) { next(err); }
};
exports.payTaxPeriod = async (req, res, next) => {
  try {
    const p = await TaxPeriod.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'filed' }, { status: 'paid', paidAt: new Date() }, { new: true });
    if (!p) return res.status(404).json(nf('TaxPeriod'));
    res.json(p);
  } catch (err) { next(err); }
};

/* ─── Recurring Invoices ─── */
exports.listRecurring = async (req, res, next) => {
  try { res.json(await RecurringInvoice.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 })); } catch (err) { next(err); }
};
exports.getRecurringById = async (req, res, next) => {
  try {
    const r = await RecurringInvoice.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!r) return res.status(404).json(nf('RecurringInvoice'));
    res.json(r);
  } catch (err) { next(err); }
};
exports.createRecurring = async (req, res, next) => {
  try { res.status(201).json(await RecurringInvoice.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.pauseRecurring = async (req, res, next) => {
  try {
    const r = await RecurringInvoice.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'active' }, { status: 'paused', updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf('RecurringInvoice'));
    res.json(r);
  } catch (err) { next(err); }
};
exports.resumeRecurring = async (req, res, next) => {
  try {
    const r = await RecurringInvoice.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'paused' }, { status: 'active', updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf('RecurringInvoice'));
    res.json(r);
  } catch (err) { next(err); }
};
exports.deleteRecurring = async (req, res, next) => {
  try {
    await RecurringInvoice.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

const mkVoucherCtrl = (Model, prefix, name) => ({
  list: async (req, res, next) => {
    try { res.json(await Model.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 })); } catch (err) { next(err); }
  },
  getById: async (req, res, next) => {
    try {
      const v = await Model.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
      if (!v) return res.status(404).json(nf(name));
      res.json(v);
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      const count = await Model.countDocuments({ tenantId: tid(req) });
      const voucherNumber = `${prefix}-${String(count + 1).padStart(5, '0')}`;
      res.status(201).json(await Model.create({ ...req.body, voucherNumber, tenantId: tid(req) }));
    } catch (err) { next(err); }
  },
  post: async (req, res, next) => {
    try {
      const v = await Model.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'draft' }, { status: 'posted', updatedAt: new Date() }, { new: true });
      if (!v) return res.status(404).json(nf(name));
      res.json(v);
    } catch (err) { next(err); }
  },
  void: async (req, res, next) => {
    try {
      const v = await Model.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'posted' }, { status: 'voided', updatedAt: new Date() }, { new: true });
      if (!v) return res.status(404).json(nf(name));
      res.json(v);
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      await Model.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
      res.status(204).send();
    } catch (err) { next(err); }
  },
});

exports.paymentVouchers = mkVoucherCtrl(PaymentVoucher, 'PV', 'PaymentVoucher');
exports.receiptVouchers  = mkVoucherCtrl(ReceiptVoucher, 'RV', 'ReceiptVoucher');

/* ─── Finance Customers ─── */
exports.listCustomers = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.search) { const re = new RegExp(req.query.search, 'i'); f.$or = [{ name: re }, { email: re }]; }
    if (req.query.isActive !== undefined) f.isActive = req.query.isActive === 'true';
    res.json(await FinanceCustomer.find(f).sort({ name: 1 }));
  } catch (err) { next(err); }
};
exports.getCustomerById = async (req, res, next) => {
  try {
    const c = await FinanceCustomer.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!c) return res.status(404).json(nf('FinanceCustomer'));
    res.json(c);
  } catch (err) { next(err); }
};
exports.createCustomer = async (req, res, next) => {
  try { res.status(201).json(await FinanceCustomer.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.updateCustomer = async (req, res, next) => {
  try {
    const c = await FinanceCustomer.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, req.body, { new: true });
    if (!c) return res.status(404).json(nf('FinanceCustomer'));
    res.json(c);
  } catch (err) { next(err); }
};
exports.deleteCustomer = async (req, res, next) => {
  try {
    await FinanceCustomer.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Account Types CRUD ─── */
const atDto = t => ({ id: t._id, code: t.code || '', name: t.name, normalBalance: t.normalBalance || 'debit', parentId: t.parentId || null, sortOrder: t.sortOrder || 0, isActive: t.isActive !== false });

exports.getAccountTypes = async (req, res, next) => {
  try {
    const types = await AccountType.find({ ...tf(req), isDeleted: false }).sort({ sortOrder: 1, name: 1 });
    if (!types.length) {
      return res.json([
        { id: 'asset',     code: 'asset',     name: 'Asset',     normalBalance: 'debit',  parentId: null, sortOrder: 1, isActive: true },
        { id: 'liability', code: 'liability', name: 'Liability', normalBalance: 'credit', parentId: null, sortOrder: 2, isActive: true },
        { id: 'equity',    code: 'equity',    name: 'Equity',    normalBalance: 'credit', parentId: null, sortOrder: 3, isActive: true },
        { id: 'revenue',   code: 'revenue',   name: 'Revenue',   normalBalance: 'credit', parentId: null, sortOrder: 4, isActive: true },
        { id: 'expense',   code: 'expense',   name: 'Expense',   normalBalance: 'debit',  parentId: null, sortOrder: 5, isActive: true },
      ]);
    }
    res.json(types.map(atDto));
  } catch (err) { next(err); }
};
exports.createAccountType = async (req, res, next) => {
  try {
    const count = await AccountType.countDocuments({ tenantId: tid(req) });
    const code = req.body.code || req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const t = await AccountType.create({ ...req.body, code, tenantId: tid(req), sortOrder: count + 1 });
    res.status(201).json(atDto(t));
  } catch (err) { next(err); }
};
exports.updateAccountType = async (req, res, next) => {
  try {
    const t = await AccountType.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!t) return res.status(404).json(nf('AccountType'));
    res.json(atDto(t));
  } catch (err) { next(err); }
};
exports.deleteAccountType = async (req, res, next) => {
  try {
    await AccountType.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};
exports.reorderAccountTypes = async (req, res, next) => {
  try {
    const { items = [] } = req.body;
    await Promise.all(items.map(item => AccountType.findOneAndUpdate({ _id: item.id, ...tf(req) }, { sortOrder: item.sortOrder })));
    res.json((await AccountType.find({ ...tf(req), isDeleted: false }).sort({ sortOrder: 1 })).map(atDto));
  } catch (err) { next(err); }
};

/* ─── Tax Summary & Transactions ─── */
exports.taxSummary = async (req, res, next) => {
  try {
    const Invoice = require('../models/Invoice');
    const invoices = await Invoice.find({ ...tf(req), isDeleted: false, taxAmount: { $gt: 0 } });
    const taxCollected  = invoices.reduce((s, i) => s + (i.taxAmount || 0), 0);
    const taxableAmount = invoices.reduce((s, i) => s + (i.subtotal || 0), 0);
    const PurchaseBill  = require('../models/PurchaseBill');
    const bills = await PurchaseBill.find({ ...tf(req), isDeleted: false });
    const taxPaid = bills.reduce((s, b) => s + ((b.totalAmount || 0) * (b.taxRate || 0) / 100), 0);
    res.json({ taxCollected, taxPaid, netTaxLiability: taxCollected - taxPaid, taxableAmount, taxableTransactions: invoices.length });
  } catch (err) { next(err); }
};
exports.listTaxTransactions = async (req, res, next) => {
  try {
    const Invoice = require('../models/Invoice');
    const invoices = await Invoice.find({ ...tf(req), isDeleted: false, taxAmount: { $gt: 0 } }).sort({ createdAt: -1 }).limit(200);
    res.json(invoices.map(i => ({
      id: i._id, type: 'sales', date: i.invoiceDate || i.createdAt,
      reference: i.invoiceNumber, description: `Invoice to ${i.customerName || ''}`,
      taxableAmount: i.subtotal || 0, taxRate: i.taxRate || 0, taxAmount: i.taxAmount || 0,
    })));
  } catch (err) { next(err); }
};

/* ─── Recurring Invoice extras ─── */
exports.recurringInvoicesSummary = async (req, res, next) => {
  try {
    const all    = await RecurringInvoice.find({ ...tf(req), isDeleted: false });
    const active = all.filter(r => r.status === 'active');
    res.json({ total: all.length, active: active.length, paused: all.filter(r => r.status === 'paused').length, completed: all.filter(r => r.status === 'completed').length, totalMonthly: active.reduce((s, r) => s + (r.amount || 0), 0) });
  } catch (err) { next(err); }
};
exports.generateRecurring = async (req, res, next) => {
  try {
    const r = await RecurringInvoice.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!r) return res.status(404).json(nf('RecurringInvoice'));
    // Generate a one-off invoice from this recurring template
    const Invoice = require('../models/Invoice');
    const count   = await Invoice.countDocuments({ tenantId: tid(req) });
    const inv = await Invoice.create({ tenantId: tid(req), invoiceNumber: `INV-${String(count + 1).padStart(5, '0')}`, customerId: r.customerId, customerName: r.customerName, status: 'draft', invoiceDate: new Date().toISOString().split('T')[0], items: r.items || [], subtotal: r.amount || 0, taxRate: r.taxRate || 0, taxAmount: (r.amount || 0) * (r.taxRate || 0) / 100, totalAmount: r.amount || 0, notes: `Generated from recurring ${r._id}` });
    await RecurringInvoice.findByIdAndUpdate(r._id, { lastGenerated: new Date(), updatedAt: new Date() });
    res.status(201).json(inv);
  } catch (err) { next(err); }
};
exports.runDueRecurring = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const due   = await RecurringInvoice.find({ ...tf(req), isDeleted: false, status: 'active', nextDate: { $lte: today } });
    res.json({ processed: due.length, message: `${due.length} recurring invoices due.` });
  } catch (err) { next(err); }
};
exports.updateRecurring = async (req, res, next) => {
  try {
    const r = await RecurringInvoice.findOneAndUpdate({ _id: req.params.id, ...tf(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf('RecurringInvoice'));
    res.json(r);
  } catch (err) { next(err); }
};

/* ─── AR / AP Aging ─── */
exports.arAging = async (req, res, next) => {
  try {
    const Invoice = require('../models/Invoice');
    const invoices = await Invoice.find({ ...tf(req), isDeleted: false, status: { $in: ['sent', 'partial'] } });
    const today = new Date();
    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0 };
    invoices.forEach(inv => {
      const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.invoiceDate);
      const days = Math.floor((today - due) / 86400000);
      const balance = inv.totalAmount - (inv.paidAmount || 0);
      if (days <= 0) buckets.current += balance;
      else if (days <= 30) buckets.days1_30 += balance;
      else if (days <= 60) buckets.days31_60 += balance;
      else if (days <= 90) buckets.days61_90 += balance;
      else buckets.over90 += balance;
    });
    res.json(buckets);
  } catch (err) { next(err); }
};
exports.apAging = async (req, res, next) => {
  try {
    const PurchaseBill = require('../models/PurchaseBill');
    const bills = await PurchaseBill.find({ ...tf(req), isDeleted: false, status: { $in: ['approved', 'partial'] } });
    const today = new Date();
    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0 };
    bills.forEach(b => {
      const due = b.dueDate ? new Date(b.dueDate) : new Date(b.billDate || b.createdAt);
      const days = Math.floor((today - due) / 86400000);
      const balance = b.totalAmount - (b.paidAmount || 0);
      if (days <= 0) buckets.current += balance;
      else if (days <= 30) buckets.days1_30 += balance;
      else if (days <= 60) buckets.days31_60 += balance;
      else if (days <= 90) buckets.days61_90 += balance;
      else buckets.over90 += balance;
    });
    res.json(buckets);
  } catch (err) { next(err); }
};
