const Expense = require('../models/Expense');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

// Frontend expects: expenseNumber, paidBy (not submittedBy), notes (not description)
const dto = e => ({
  id:             e._id,
  expenseNumber:  e.expenseNumber || `EXP-${String(e._id).slice(-6).toUpperCase()}`,
  title:          e.title,
  category:       e.category,
  paidBy:         e.paidBy || e.submittedBy || '',
  expenseDate:    e.expenseDate,
  status:         e.status,
  amount:         e.amount || 0,
  currency:       e.currency || 'AED',
  approvedBy:     e.approvedBy || null,
  approvedAt:     e.approvedAt || null,
  paidAt:         e.paidAt || null,
  paymentMethod:  e.paymentMethod || null,
  notes:          e.notes || e.description || null,
  reference:      e.reference || null,
  receiptUrl:     e.receiptUrl || null,
  hasReceipt:     !!(e.receiptUrl),
  receiptFileName:e.receiptFileName || null,
  accountId:      e.accountId || null,
  accountName:    e.accountName || null,
  createdAt:      e.createdAt,
});

exports.summary = async (req, res, next) => {
  try {
    const f    = { ...tenantFilter(req), isDeleted: false };
    const all  = await Expense.find(f);
    const total       = all.length;
    const draft       = all.filter(e => e.status === 'draft').length;
    const pending     = all.filter(e => e.status === 'pending').length;
    const approved    = all.filter(e => e.status === 'approved').length;
    const rejected    = all.filter(e => e.status === 'rejected').length;
    const paid        = all.filter(e => e.status === 'paid').length;
    const totalAmount = all.reduce((s, e) => s + (e.amount || 0), 0);
    const totalPaid   = all.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0);
    res.json({ total, draft, pending, approved, rejected, paid, totalAmount, totalPaid, pendingApproval: pending });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.search) f.title = { $regex: req.query.search, $options: 'i' };
    const [items, total] = await Promise.all([
      Expense.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      Expense.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const e = await Expense.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!e) return res.status(404).json({ code: 'Expense.NotFound', description: 'Expense not found.' });
    res.json(dto(e));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const tid   = req.user.tenant_id;
    const count = await Expense.countDocuments({ tenantId: tid });
    const expenseNumber = `EXP-${String(count + 1).padStart(5, '0')}`;
    const paidBy = req.body.paidBy || req.user.name || req.user.email;
    const notes  = req.body.notes || req.body.description;
    const e = await Expense.create({
      ...req.body, paidBy, notes, expenseNumber, submittedBy: paidBy, tenantId: tid,
    });
    res.status(201).json(dto(e));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const e = await Expense.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false, status: 'pending' },
      { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!e) return res.status(404).json({ code: 'Expense.NotFound', description: 'Expense not found or not editable.' });
    res.json(dto(e));
  } catch (err) { next(err); }
};

exports.approve = async (req, res, next) => {
  try {
    const e = await Expense.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!e) return res.status(404).json({ code: 'Expense.NotFound', description: 'Expense not found.' });
    if (e.status !== 'pending') return res.status(400).json({ code: 'Expense.InvalidStatus', description: 'Only pending expenses can be approved.' });
    e.status = 'approved'; e.approvedBy = req.user.name || req.user.email; e.approvedAt = new Date(); e.updatedAt = new Date();
    await e.save();
    res.json(dto(e));
  } catch (err) { next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    const e = await Expense.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!e) return res.status(404).json({ code: 'Expense.NotFound', description: 'Expense not found.' });
    if (e.status !== 'pending') return res.status(400).json({ code: 'Expense.InvalidStatus', description: 'Only pending expenses can be rejected.' });
    e.status = 'rejected'; e.updatedAt = new Date();
    await e.save();
    res.json(dto(e));
  } catch (err) { next(err); }
};

exports.pay = async (req, res, next) => {
  try {
    const e = await Expense.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!e) return res.status(404).json({ code: 'Expense.NotFound', description: 'Expense not found.' });
    if (e.status !== 'approved') return res.status(400).json({ code: 'Expense.InvalidStatus', description: 'Only approved expenses can be paid.' });
    e.status = 'paid'; e.paidAt = new Date(); e.updatedAt = new Date();
    await e.save();
    res.json(dto(e));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Expense.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};
