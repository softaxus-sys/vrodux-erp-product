const PurchaseBill = require('../models/PurchaseBill');
const Supplier = require('../models/Supplier');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

const dto = b => ({
  id: b._id, billNumber: b.billNumber, supplierId: b.supplierId, supplierName: b.supplierName,
  billDate: b.billDate, dueDate: b.dueDate, taxRate: b.taxRate, currencyCode: b.currencyCode,
  subtotal: b.subtotal, taxAmount: b.taxAmount, totalAmount: b.totalAmount,
  paidAmount: b.paidAmount, dueAmount: b.dueAmount, reference: b.reference,
  notes: b.notes, status: b.status, items: b.items, createdAt: b.createdAt,
});

const summary = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req), isDeleted: false };
    const all = await PurchaseBill.find(f);
    const total = all.length;
    const draft = all.filter(b => b.status === 'draft').length;
    const approved = all.filter(b => b.status === 'approved').length;
    const totalAmount = all.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const paid = all.filter(b => b.status === 'paid').reduce((s, b) => s + (b.paidAmount || 0), 0);
    const due = all.filter(b => b.status !== 'paid' && b.status !== 'cancelled').reduce((s, b) => s + (b.dueAmount || 0), 0);
    res.json({ total, draft, approved, totalAmount, paid, due });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.search) f.supplierName = { $regex: req.query.search, $options: 'i' };
    const [items, total] = await Promise.all([
      PurchaseBill.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      PurchaseBill.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const b = await PurchaseBill.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'PurchaseBill.NotFound', description: 'Purchase bill not found.' });
    res.json(dto(b));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { items = [], taxRate = 0, currencyCode = 'AED', ...rest } = req.body;
    const subtotal = items.reduce((s, it) => s + (it.lineTotal || it.quantity * it.unitPrice), 0);
    const taxAmount = Math.round(subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;
    const count = await PurchaseBill.countDocuments({ tenantId: req.user.tenant_id });
    const billNumber = `BILL-${String(count + 1).padStart(5, '0')}`;
    const b = await PurchaseBill.create({
      ...rest, items, taxRate, currencyCode, subtotal, taxAmount, totalAmount,
      dueAmount: totalAmount, paidAmount: 0, billNumber, tenantId: req.user.tenant_id,
    });
    res.status(201).json(dto(b));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const b = await PurchaseBill.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'PurchaseBill.NotFound', description: 'Purchase bill not found.' });
    if (b.status !== 'draft') return res.status(400).json({ code: 'PurchaseBill.NotEditable', description: 'Only draft bills can be edited.' });
    Object.assign(b, req.body, { updatedAt: new Date() });
    await b.save();
    res.json(dto(b));
  } catch (err) { next(err); }
};

const approve = async (req, res, next) => {
  try {
    const b = await PurchaseBill.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'PurchaseBill.NotFound', description: 'Purchase bill not found.' });
    if (b.status !== 'draft') return res.status(400).json({ code: 'PurchaseBill.InvalidStatus', description: 'Only draft bills can be approved.' });
    b.status = 'approved'; b.updatedAt = new Date();
    await b.save();
    res.json(dto(b));
  } catch (err) { next(err); }
};

const cancel = async (req, res, next) => {
  try {
    const b = await PurchaseBill.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'PurchaseBill.NotFound', description: 'Purchase bill not found.' });
    if (b.status === 'paid') return res.status(400).json({ code: 'PurchaseBill.CannotCancel', description: 'Paid bills cannot be cancelled.' });
    b.status = 'cancelled'; b.updatedAt = new Date();
    await b.save();
    res.json(dto(b));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await PurchaseBill.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

const getSuppliers = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req), isDeleted: false, isActive: true };
    if (req.query.search) f.name = { $regex: req.query.search, $options: 'i' };
    const items = await Supplier.find(f).sort({ name: 1 });
    res.json(items.map(s => ({ id: s._id, name: s.name, email: s.email, phone: s.phone })));
  } catch (err) { next(err); }
};

module.exports = { summary, list, getById, create, update, approve, cancel, remove, getSuppliers };
