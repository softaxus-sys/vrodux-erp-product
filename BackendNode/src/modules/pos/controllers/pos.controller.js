const PosProduct     = require('../models/PosProduct');
const PosCategory    = require('../models/PosCategory');
const PosSession     = require('../models/PosSession');
const PosTransaction = require('../models/PosTransaction');
const PosCustomer    = require('../models/PosCustomer');
const PosVendor      = require('../models/PosVendor');
const PosPO          = require('../models/PosPurchaseOrder');
const PosSO          = require('../models/PosSalesOrder');
const PosSQ          = require('../models/PosSalesQuotation');
const { TaxRate, Currency, PaymentMethod, PaymentTerm, CustomerGroup, Voucher } = require('../models/PosSetting');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

/* ─── helpers ─── */
const tid = req => req.user.tenant_id;
const notFound = (name) => ({ code: `${name}.NotFound`, description: `${name} not found.` });

/* ════════════════════════════════════════════════
   CATEGORIES
════════════════════════════════════════════════ */
exports.listCategories = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.isActive !== undefined) f.isActive = req.query.isActive !== 'false';
    if (req.query.search) f.name = { $regex: req.query.search, $options: 'i' };
    const [items, total] = await Promise.all([
      PosCategory.find(f).sort({ sortOrder: 1, name: 1 }).skip(skip).limit(pageSize),
      PosCategory.countDocuments(f),
    ]);
    res.json(paged(items.map(c => ({ id: c._id, name: c.name, description: c.description, color: c.color, sortOrder: c.sortOrder, isActive: c.isActive, createdAt: c.createdAt })), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.createCategory = async (req, res, next) => {
  try {
    const c = await PosCategory.create({ ...req.body, tenantId: tid(req) });
    res.status(201).json({ id: c._id, name: c.name, description: c.description, color: c.color, sortOrder: c.sortOrder, isActive: c.isActive });
  } catch (err) { next(err); }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const c = await PosCategory.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, req.body, { new: true });
    if (!c) return res.status(404).json(notFound('PosCategory'));
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    await PosCategory.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   PRODUCTS
════════════════════════════════════════════════ */
const prodDto = p => ({
  id: p._id, name: p.name, sku: p.sku, barcode: p.barcode, description: p.description,
  categoryId: p.categoryId, categoryName: p.categoryName, costPrice: p.costPrice,
  sellingPrice: p.sellingPrice, taxRate: p.taxRate, stockQty: p.stockQty,
  reorderLevel: p.reorderLevel, isActive: p.isActive, imageUrl: p.imageUrl, createdAt: p.createdAt,
});

exports.listProducts = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.isActive !== undefined) f.isActive = req.query.isActive !== 'false';
    if (req.query.categoryId) f.categoryId = req.query.categoryId;
    if (req.query.lowStock === 'true') f.$expr = { $lte: ['$stockQty', '$reorderLevel'] };
    if (req.query.search) f.$or = [{ name: { $regex: req.query.search, $options: 'i' } }, { sku: { $regex: req.query.search, $options: 'i' } }];
    const sort = {};
    if (req.query.sortBy) sort[req.query.sortBy] = req.query.sortDesc === 'true' ? -1 : 1;
    else sort.name = 1;
    const [items, total] = await Promise.all([
      PosProduct.find(f).sort(sort).skip(skip).limit(pageSize),
      PosProduct.countDocuments(f),
    ]);
    res.json(paged(items.map(prodDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getProductById = async (req, res, next) => {
  try {
    const p = await PosProduct.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!p) return res.status(404).json(notFound('PosProduct'));
    res.json(prodDto(p));
  } catch (err) { next(err); }
};

exports.getProductByBarcode = async (req, res, next) => {
  try {
    const p = await PosProduct.findOne({ barcode: req.params.barcode, ...tenantFilter(req), isDeleted: false });
    if (!p) return res.status(404).json(notFound('PosProduct'));
    res.json(prodDto(p));
  } catch (err) { next(err); }
};

exports.createProduct = async (req, res, next) => {
  try {
    const p = await PosProduct.create({ ...req.body, tenantId: tid(req) });
    res.status(201).json(prodDto(p));
  } catch (err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const p = await PosProduct.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!p) return res.status(404).json(notFound('PosProduct'));
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    await PosProduct.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.adjustStock = async (req, res, next) => {
  try {
    const { quantity, adjustmentType, reference, notes } = req.body;
    const p = await PosProduct.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!p) return res.status(404).json(notFound('PosProduct'));
    const delta = adjustmentType === 'remove' ? -Math.abs(quantity) : Math.abs(quantity);
    p.stockQty = Math.max(0, p.stockQty + delta);
    p.updatedAt = new Date();
    await p.save();
    res.status(201).json({ productId: p._id, newStockQty: p.stockQty, adjustmentType, quantity: delta, reference, notes });
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   CUSTOMERS
════════════════════════════════════════════════ */
const custDto = c => ({ id: c._id, name: c.name, email: c.email, phone: c.phone, address: c.address, groupId: c.groupId, groupName: c.groupName, loyaltyPoints: c.loyaltyPoints, isActive: c.isActive, createdAt: c.createdAt });

exports.listCustomers = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.search) f.name = { $regex: req.query.search, $options: 'i' };
    const [items, total] = await Promise.all([PosCustomer.find(f).sort({ name: 1 }).skip(skip).limit(pageSize), PosCustomer.countDocuments(f)]);
    res.json(paged(items.map(custDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getCustomerById = async (req, res, next) => {
  try {
    const c = await PosCustomer.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!c) return res.status(404).json(notFound('PosCustomer'));
    res.json(custDto(c));
  } catch (err) { next(err); }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const c = await PosCustomer.create({ ...req.body, tenantId: tid(req) });
    res.status(201).json(custDto(c));
  } catch (err) { next(err); }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const c = await PosCustomer.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!c) return res.status(404).json(notFound('PosCustomer'));
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const c = await PosCustomer.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, { isDeleted: true }, { new: true });
    if (!c) return res.status(404).json(notFound('PosCustomer'));
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   VENDORS
════════════════════════════════════════════════ */
const vendDto = v => ({ id: v._id, name: v.name, code: v.code, category: v.category, contactPerson: v.contactPerson, email: v.email, phone: v.phone, address: v.address, taxNumber: v.taxNumber, paymentTerms: v.paymentTerms, currency: v.currency, notes: v.notes, status: v.status, rating: v.rating, createdAt: v.createdAt, updatedAt: v.updatedAt });

exports.listVendors = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.category) f.category = req.query.category;
    if (req.query.search) f.name = { $regex: req.query.search, $options: 'i' };
    const [items, total] = await Promise.all([PosVendor.find(f).sort({ name: 1 }).skip(skip).limit(pageSize), PosVendor.countDocuments(f)]);
    res.json(paged(items.map(vendDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getVendorById = async (req, res, next) => {
  try {
    const v = await PosVendor.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!v) return res.status(404).json(notFound('PosVendor'));
    res.json(vendDto(v));
  } catch (err) { next(err); }
};

exports.createVendor = async (req, res, next) => {
  try {
    const v = await PosVendor.create({ ...req.body, tenantId: tid(req) });
    res.status(201).json(vendDto(v));
  } catch (err) { next(err); }
};

exports.updateVendor = async (req, res, next) => {
  try {
    const v = await PosVendor.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!v) return res.status(404).json(notFound('PosVendor'));
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.deleteVendor = async (req, res, next) => {
  try {
    await PosVendor.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   SESSIONS
════════════════════════════════════════════════ */
const sessionDto = s => ({ id: s._id, cashierId: s.cashierId, cashierName: s.cashierName, status: s.status, openingCash: s.openingCash, closingCash: s.closingCash, totalSales: s.totalSales, totalRefunds: s.totalRefunds, transactionCount: s.transactionCount, openedAt: s.openedAt, closedAt: s.closedAt, suspendedAt: s.suspendedAt, notes: s.notes });

exports.getActiveSessions = async (req, res, next) => {
  try {
    const items = await PosSession.find({ ...tenantFilter(req), status: { $in: ['open', 'suspended'] }, isDeleted: false });
    res.json(items.map(sessionDto));
  } catch (err) { next(err); }
};

exports.getSessionById = async (req, res, next) => {
  try {
    const s = await PosSession.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!s) return res.status(404).json(notFound('PosSession'));
    res.json(sessionDto(s));
  } catch (err) { next(err); }
};

exports.openSession = async (req, res, next) => {
  try {
    const s = await PosSession.create({ ...req.body, cashierId: req.user.sub || req.user.id, cashierName: req.user.name || req.user.email, tenantId: tid(req) });
    res.status(201).json(sessionDto(s));
  } catch (err) { next(err); }
};

exports.closeSession = async (req, res, next) => {
  try {
    const s = await PosSession.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!s) return res.status(404).json(notFound('PosSession'));
    s.status = 'closed'; s.closingCash = req.body.closingCash || 0; s.closedAt = new Date();
    if (req.body.notes) s.notes = req.body.notes;
    await s.save();
    res.json(sessionDto(s));
  } catch (err) { next(err); }
};

exports.suspendSession = async (req, res, next) => {
  try {
    const s = await PosSession.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), status: 'open' }, { status: 'suspended', suspendedAt: new Date(), notes: req.body.notes }, { new: true });
    if (!s) return res.status(404).json(notFound('PosSession'));
    res.json(sessionDto(s));
  } catch (err) { next(err); }
};

exports.getSessionTransactions = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { sessionId: req.params.id, ...tenantFilter(req), isDeleted: false };
    const [items, total] = await Promise.all([PosTransaction.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize), PosTransaction.countDocuments(f)]);
    res.json(paged(items.map(txDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.addCashMovement = async (req, res, next) => {
  try {
    const s = await PosSession.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!s) return res.status(404).json(notFound('PosSession'));
    const mv = { type: req.body.type, amount: req.body.amount, reason: req.body.reason };
    s.cashMovements.push(mv);
    await s.save();
    res.status(201).json(s.cashMovements[s.cashMovements.length - 1]);
  } catch (err) { next(err); }
};

exports.getCashMovements = async (req, res, next) => {
  try {
    const s = await PosSession.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!s) return res.status(404).json(notFound('PosSession'));
    res.json(s.cashMovements);
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   TRANSACTIONS
════════════════════════════════════════════════ */
const txDto = t => ({
  id: t._id, sessionId: t.sessionId, cashierId: t.cashierId, cashierName: t.cashierName,
  customerId: t.customerId, customerName: t.customerName, type: t.type, status: t.status,
  subtotal: t.subtotal, discountAmount: t.discountAmount, taxAmount: t.taxAmount,
  totalAmount: t.totalAmount, amountPaid: t.amountPaid, change: t.change,
  voidReason: t.voidReason, refundReason: t.refundReason, originalTransactionId: t.originalTransactionId,
  lineItems: t.lineItems, payments: t.payments, notes: t.notes, receiptNumber: t.receiptNumber, createdAt: t.createdAt,
});

exports.listTransactions = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.sessionId) f.sessionId = req.query.sessionId;
    if (req.query.cashierId) f.cashierId = req.query.cashierId;
    if (req.query.customerId) f.customerId = req.query.customerId;
    if (req.query.type) f.type = req.query.type;
    if (req.query.status) f.status = req.query.status;
    if (req.query.from || req.query.to) {
      f.createdAt = {};
      if (req.query.from) f.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) f.createdAt.$lte = new Date(req.query.to);
    }
    if (req.query.search) f.receiptNumber = { $regex: req.query.search, $options: 'i' };
    const [items, total] = await Promise.all([PosTransaction.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize), PosTransaction.countDocuments(f)]);
    res.json(paged(items.map(txDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getTransactionById = async (req, res, next) => {
  try {
    const t = await PosTransaction.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!t) return res.status(404).json(notFound('PosTransaction'));
    res.json(txDto(t));
  } catch (err) { next(err); }
};

exports.createSale = async (req, res, next) => {
  try {
    const { lineItems = [], payments = [], ...rest } = req.body;
    const subtotal = lineItems.reduce((s, l) => s + (l.lineTotal || l.quantity * l.unitPrice * (1 - (l.discountPercent || 0) / 100)), 0);
    const taxAmount = lineItems.reduce((s, l) => s + (l.lineTotal * (l.taxRate || 0) / 100), 0);
    const discountAmount = lineItems.reduce((s, l) => s + (l.quantity * l.unitPrice * (l.discountPercent || 0) / 100), 0);
    const totalAmount = subtotal + taxAmount;
    const amountPaid = payments.reduce((s, p) => s + p.amount, 0);
    const count = await PosTransaction.countDocuments({ tenantId: tid(req) });
    const t = await PosTransaction.create({
      ...rest, lineItems, payments, subtotal, taxAmount, discountAmount, totalAmount,
      amountPaid, change: Math.max(0, amountPaid - totalAmount),
      type: 'sale', status: 'completed', receiptNumber: `REC-${String(count + 1).padStart(6, '0')}`,
      cashierId: req.user.sub || req.user.id, cashierName: req.user.name || req.user.email,
      tenantId: tid(req),
    });
    // Update session totals
    if (rest.sessionId) {
      await PosSession.findByIdAndUpdate(rest.sessionId, { $inc: { totalSales: totalAmount, transactionCount: 1 } });
    }
    // Deduct stock
    for (const item of lineItems) {
      if (item.productId) await PosProduct.findByIdAndUpdate(item.productId, { $inc: { stockQty: -item.quantity } });
    }
    res.status(201).json(txDto(t));
  } catch (err) { next(err); }
};

exports.voidTransaction = async (req, res, next) => {
  try {
    const t = await PosTransaction.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!t) return res.status(404).json(notFound('PosTransaction'));
    if (t.status !== 'completed') return res.status(400).json({ code: 'Transaction.CannotVoid', description: 'Only completed transactions can be voided.' });
    t.status = 'voided'; t.voidReason = req.body.reason;
    await t.save();
    // Restore stock
    for (const item of t.lineItems) {
      if (item.productId) await PosProduct.findByIdAndUpdate(item.productId, { $inc: { stockQty: item.quantity } });
    }
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.refundTransaction = async (req, res, next) => {
  try {
    const original = await PosTransaction.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!original) return res.status(404).json(notFound('PosTransaction'));
    const { sessionId, lineItems = [], payments = [], reason } = req.body;
    const subtotal = lineItems.reduce((s, l) => s + l.lineTotal, 0);
    const totalAmount = subtotal;
    const count = await PosTransaction.countDocuments({ tenantId: tid(req) });
    const t = await PosTransaction.create({
      sessionId, lineItems, payments, subtotal, taxAmount: 0, discountAmount: 0, totalAmount,
      amountPaid: totalAmount, change: 0, type: 'refund', status: 'completed',
      originalTransactionId: original._id, refundReason: reason,
      receiptNumber: `REF-${String(count + 1).padStart(6, '0')}`,
      cashierId: req.user.sub || req.user.id, cashierName: req.user.name || req.user.email,
      tenantId: tid(req),
    });
    original.status = 'refunded'; await original.save();
    // Restore stock
    for (const item of lineItems) {
      if (item.productId) await PosProduct.findByIdAndUpdate(item.productId, { $inc: { stockQty: item.quantity } });
    }
    res.status(201).json(txDto(t));
  } catch (err) { next(err); }
};

exports.holdTransaction = async (req, res, next) => {
  try {
    const { lineItems = [], ...rest } = req.body;
    const count = await PosTransaction.countDocuments({ tenantId: tid(req) });
    const t = await PosTransaction.create({
      ...rest, lineItems, payments: [], type: 'hold', status: 'held',
      receiptNumber: `HOLD-${String(count + 1).padStart(6, '0')}`,
      cashierId: req.user.sub || req.user.id, cashierName: req.user.name || req.user.email,
      tenantId: tid(req),
    });
    res.status(201).json(txDto(t));
  } catch (err) { next(err); }
};

exports.recallTransaction = async (req, res, next) => {
  try {
    const t = await PosTransaction.findOne({ _id: req.params.id, ...tenantFilter(req), status: 'held' });
    if (!t) return res.status(404).json(notFound('PosTransaction'));
    t.status = 'completed'; await t.save();
    res.json(txDto(t));
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   REPORTS
════════════════════════════════════════════════ */
exports.getDailySummary = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    const f = { ...tenantFilter(req), type: 'sale', status: 'completed', createdAt: { $gte: start, $lte: end } };
    if (req.query.cashierId) f.cashierId = req.query.cashierId;
    const txs = await PosTransaction.find(f);
    const totalSales = txs.reduce((s, t) => s + t.totalAmount, 0);
    const totalTransactions = txs.length;
    const avgSale = totalTransactions ? totalSales / totalTransactions : 0;
    const byPayment = {};
    txs.forEach(t => t.payments.forEach(p => { byPayment[p.method] = (byPayment[p.method] || 0) + p.amount; }));
    res.json({ date, totalSales, totalTransactions, avgSale, paymentBreakdown: byPayment });
  } catch (err) { next(err); }
};

exports.getReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { from, to } = req.query;
    const f = { ...tenantFilter(req), isDeleted: false };
    if (from || to) {
      f.createdAt = {};
      if (from) f.createdAt.$gte = new Date(from);
      if (to)   f.createdAt.$lte = new Date(to);
    }
    switch (reportId) {
      case 'sales-summary': {
        const txs = await PosTransaction.find({ ...f, type: 'sale', status: 'completed' });
        res.json({ reportId, totalSales: txs.reduce((s, t) => s + t.totalAmount, 0), count: txs.length });
        break;
      }
      case 'top-products': {
        const txs = await PosTransaction.find({ ...f, type: 'sale', status: 'completed' });
        const map = {};
        txs.forEach(t => t.lineItems.forEach(l => {
          if (!map[l.description]) map[l.description] = { name: l.description, qty: 0, revenue: 0 };
          map[l.description].qty += l.quantity;
          map[l.description].revenue += l.lineTotal;
        }));
        res.json({ reportId, data: Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 20) });
        break;
      }
      case 'inventory-valuation': {
        const prods = await PosProduct.find(f);
        const data = prods.map(p => ({ id: p._id, name: p.name, stockQty: p.stockQty, costPrice: p.costPrice, value: p.stockQty * p.costPrice }));
        res.json({ reportId, data, totalValue: data.reduce((s, p) => s + p.value, 0) });
        break;
      }
      default:
        res.json({ reportId, message: `Report '${reportId}' not yet implemented.`, data: [] });
    }
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   PURCHASE ORDERS (POS)
════════════════════════════════════════════════ */
const poDto = o => ({ id: o._id, orderNumber: o.orderNumber, vendorId: o.vendorId, vendorName: o.vendorName, status: o.status, notes: o.notes, expectedDate: o.expectedDate, subTotal: o.subTotal, taxAmount: o.taxAmount, total: o.total, items: o.items, createdAt: o.createdAt, updatedAt: o.updatedAt });

exports.listPurchaseOrders = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.vendorId) f.vendorId = req.query.vendorId;
    if (req.query.search) f.vendorName = { $regex: req.query.search, $options: 'i' };
    const [items, total] = await Promise.all([PosPO.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize), PosPO.countDocuments(f)]);
    res.json(paged(items.map(poDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getPurchaseOrderById = async (req, res, next) => {
  try {
    const o = await PosPO.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!o) return res.status(404).json(notFound('PosPurchaseOrder'));
    res.json(poDto(o));
  } catch (err) { next(err); }
};

exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const { items = [], ...rest } = req.body;
    const subTotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const taxAmount = items.reduce((s, i) => s + i.lineTotal * (i.taxRate || 0) / 100, 0);
    const count = await PosPO.countDocuments({ tenantId: tid(req) });
    const o = await PosPO.create({ ...rest, items, subTotal, taxAmount, total: subTotal + taxAmount, orderNumber: `PO-${String(count + 1).padStart(5, '0')}`, tenantId: tid(req) });
    res.status(201).json(poDto(o));
  } catch (err) { next(err); }
};

exports.updatePurchaseOrder = async (req, res, next) => {
  try {
    const o = await PosPO.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!o) return res.status(404).json(notFound('PosPurchaseOrder'));
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.patchPurchaseOrderStatus = async (req, res, next) => {
  try {
    await PosPO.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { status: req.body.status || req.body, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.deletePurchaseOrder = async (req, res, next) => {
  try {
    await PosPO.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   SALES ORDERS (POS)
════════════════════════════════════════════════ */
const soDto = o => ({ id: o._id, orderNumber: o.orderNumber, customerId: o.customerId, customerName: o.customerName, status: o.status, notes: o.notes, expectedDate: o.expectedDate, subTotal: o.subTotal, taxAmount: o.taxAmount, total: o.total, items: o.items, createdAt: o.createdAt, updatedAt: o.updatedAt });

exports.listSalesOrders = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.customerId) f.customerId = req.query.customerId;
    if (req.query.search) f.$or = [{ orderNumber: { $regex: req.query.search, $options: 'i' } }, { customerName: { $regex: req.query.search, $options: 'i' } }];
    const [items, total] = await Promise.all([PosSO.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize), PosSO.countDocuments(f)]);
    res.json(paged(items.map(soDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getSalesOrderById = async (req, res, next) => {
  try {
    const o = await PosSO.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!o) return res.status(404).json(notFound('PosSalesOrder'));
    res.json(soDto(o));
  } catch (err) { next(err); }
};

exports.createSalesOrder = async (req, res, next) => {
  try {
    const { items = [], ...rest } = req.body;
    const subTotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const taxAmount = items.reduce((s, i) => s + i.lineTotal * (i.taxRate || 0) / 100, 0);
    const count = await PosSO.countDocuments({ tenantId: tid(req) });
    const o = await PosSO.create({ ...rest, items, subTotal, taxAmount, total: subTotal + taxAmount, orderNumber: `SO-${String(count + 1).padStart(5, '0')}`, tenantId: tid(req) });
    res.status(201).json(soDto(o));
  } catch (err) { next(err); }
};

exports.updateSalesOrder = async (req, res, next) => {
  try {
    const o = await PosSO.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!o) return res.status(404).json(notFound('PosSalesOrder'));
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.deleteSalesOrder = async (req, res, next) => {
  try {
    await PosSO.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   SALES QUOTATIONS (POS)
════════════════════════════════════════════════ */
const sqDto = q => ({ id: q._id, quotationNumber: q.quotationNumber, customerId: q.customerId, customerName: q.customerName, status: q.status, notes: q.notes, validUntil: q.validUntil, discountPercent: q.discountPercent, subTotal: q.subTotal, taxAmount: q.taxAmount, total: q.total, convertedOrderId: q.convertedOrderId, items: q.items, createdAt: q.createdAt, updatedAt: q.updatedAt });

exports.listSalesQuotations = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.customerId) f.customerId = req.query.customerId;
    const [items, total] = await Promise.all([PosSQ.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize), PosSQ.countDocuments(f)]);
    res.json(paged(items.map(sqDto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getSalesQuotationById = async (req, res, next) => {
  try {
    const q = await PosSQ.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!q) return res.status(404).json(notFound('PosSalesQuotation'));
    res.json(sqDto(q));
  } catch (err) { next(err); }
};

exports.createSalesQuotation = async (req, res, next) => {
  try {
    const { items = [], discountPercent = 0, ...rest } = req.body;
    const subTotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const discAmt = subTotal * discountPercent / 100;
    const taxAmount = items.reduce((s, i) => s + i.lineTotal * (i.taxRate || 0) / 100, 0);
    const count = await PosSQ.countDocuments({ tenantId: tid(req) });
    const q = await PosSQ.create({ ...rest, items, discountPercent, subTotal: subTotal - discAmt, taxAmount, total: subTotal - discAmt + taxAmount, quotationNumber: `QT-${String(count + 1).padStart(5, '0')}`, tenantId: tid(req) });
    res.status(201).json(sqDto(q));
  } catch (err) { next(err); }
};

exports.updateSalesQuotation = async (req, res, next) => {
  try {
    const q = await PosSQ.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!q) return res.status(404).json(notFound('PosSalesQuotation'));
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.convertQuotation = async (req, res, next) => {
  try {
    const q = await PosSQ.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!q) return res.status(404).json(notFound('PosSalesQuotation'));
    if (q.status !== 'approved') return res.status(400).json({ code: 'Quotation.CannotConvert', description: 'Only approved quotations can be converted.' });
    const count = await PosSO.countDocuments({ tenantId: tid(req) });
    const order = await PosSO.create({ customerId: q.customerId, customerName: q.customerName, items: q.items, subTotal: q.subTotal, taxAmount: q.taxAmount, total: q.total, orderNumber: `SO-${String(count + 1).padStart(5, '0')}`, tenantId: tid(req) });
    q.status = 'converted'; q.convertedOrderId = String(order._id); await q.save();
    res.json(soDto(order));
  } catch (err) { next(err); }
};

exports.deleteSalesQuotation = async (req, res, next) => {
  try {
    await PosSQ.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════
   LOOKUP TABLES (Tax Rates, Currencies, etc.)
════════════════════════════════════════════════ */
const mkLookupCtrl = (Model, name, dtoFn) => ({
  list: async (req, res, next) => {
    try {
      const items = await Model.find({ ...tenantFilter(req), isDeleted: false });
      res.json(items.map(dtoFn));
    } catch (err) { next(err); }
  },
  upsert: async (req, res, next) => {
    try {
      const { id, ...rest } = req.body;
      let item;
      if (id) {
        item = await Model.findOneAndUpdate({ _id: id, ...tenantFilter(req) }, rest, { new: true });
        if (!item) return res.status(404).json(notFound(name));
      } else {
        item = await Model.create({ ...rest, tenantId: tid(req) });
      }
      res.json(dtoFn(item));
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      await Model.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
      res.status(204).send();
    } catch (err) { next(err); }
  },
});

exports.taxRates     = mkLookupCtrl(TaxRate,       'TaxRate',       r => ({ id: r._id, name: r.name, rate: r.rate }));
exports.currencies   = mkLookupCtrl(Currency,      'Currency',      c => ({ id: c._id, code: c.code, name: c.name, symbol: c.symbol, rate: c.rate }));
exports.payMethods   = mkLookupCtrl(PaymentMethod, 'PaymentMethod', m => ({ id: m._id, name: m.name, type: m.type, isActive: m.isActive }));
exports.payTerms     = mkLookupCtrl(PaymentTerm,   'PaymentTerm',   t => ({ id: t._id, name: t.name, dueDays: t.dueDays, discountPercent: t.discountPercent }));
exports.custGroups   = mkLookupCtrl(CustomerGroup, 'CustomerGroup', g => ({ id: g._id, name: g.name, discountPercent: g.discountPercent }));

/* ════════════════════════════════════════════════
   VOUCHERS
════════════════════════════════════════════════ */
const vouchDto = v => ({ id: v._id, code: v.code, type: v.type, value: v.value, minSubtotal: v.minSubtotal, maxUses: v.maxUses, usedCount: v.usedCount, expiresAt: v.expiresAt, isActive: v.isActive });

exports.vouchers = {
  list: async (req, res, next) => {
    try {
      const items = await Voucher.find({ ...tenantFilter(req), isDeleted: false });
      res.json(items.map(vouchDto));
    } catch (err) { next(err); }
  },
  upsert: async (req, res, next) => {
    try {
      const { id, ...rest } = req.body;
      let v = id
        ? await Voucher.findOneAndUpdate({ _id: id, ...tenantFilter(req) }, rest, { new: true })
        : await Voucher.create({ ...rest, tenantId: tid(req) });
      if (!v) return res.status(404).json(notFound('Voucher'));
      res.json(vouchDto(v));
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      await Voucher.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
      res.status(204).send();
    } catch (err) { next(err); }
  },
  validate: async (req, res, next) => {
    try {
      const { code, subtotal } = req.body;
      const v = await Voucher.findOne({ code, ...tenantFilter(req), isActive: true, isDeleted: false });
      if (!v) return res.status(404).json({ code: 'Voucher.NotFound', description: 'Voucher not found.' });
      if (v.expiresAt && new Date(v.expiresAt) < new Date()) return res.status(400).json({ code: 'Voucher.Expired', description: 'Voucher has expired.' });
      if (v.maxUses && v.usedCount >= v.maxUses) return res.status(400).json({ code: 'Voucher.MaxUsesReached', description: 'Voucher usage limit reached.' });
      if (subtotal < v.minSubtotal) return res.status(400).json({ code: 'Voucher.MinSubtotal', description: `Minimum subtotal is ${v.minSubtotal}.` });
      const discount = v.type === 'percent' ? subtotal * v.value / 100 : Math.min(v.value, subtotal);
      res.json({ valid: true, discount, ...vouchDto(v) });
    } catch (err) { next(err); }
  },
  redeem: async (req, res, next) => {
    try {
      const { code, subtotal } = req.body;
      const v = await Voucher.findOne({ code, ...tenantFilter(req), isActive: true, isDeleted: false });
      if (!v) return res.status(404).json({ code: 'Voucher.NotFound', description: 'Voucher not found.' });
      const discount = v.type === 'percent' ? subtotal * v.value / 100 : Math.min(v.value, subtotal);
      v.usedCount += 1;
      await v.save();
      res.json({ valid: true, discount, ...vouchDto(v) });
    } catch (err) { next(err); }
  },
};

/* ════════════════════════════════════════════════
   PRINT
════════════════════════════════════════════════ */
exports.printStatus = async (req, res) => {
  res.json({ reachable: false, mode: 'network', printer: null, ip: null, port: 9100, message: 'Print service not configured in Node backend.' });
};

exports.printRaw = async (req, res) => {
  res.json({ success: false, message: 'Print service not configured in Node backend.' });
};
