const Account = require('../models/Account');
const { tenantFilter } = require('../../../middleware/auth');
const { AccountType } = require('../models/FinanceExtensions');

// Frontend expects: accountNumber (not code), accountType (not type)
const dto = a => ({
  id:            a._id,
  accountNumber: a.code || a.accountNumber || '',
  name:          a.name,
  accountType:   a.type || a.accountType || '',
  accountTypeId: a.accountTypeId || null,
  description:   a.description || null,
  parentId:      a.parentId || null,
  isActive:      a.isActive !== false,
  balance:       a.balance || 0,
  createdAt:     a.createdAt,
  updatedAt:     a.updatedAt || null,
});

const summary = async (req, res, next) => {
  try {
    const accounts = await Account.find({ ...tenantFilter(req), isDeleted: false, isActive: true });
    const byType = (type) => accounts.filter(a => (a.type || '').toLowerCase() === type).reduce((s, a) => s + (a.balance || 0), 0);
    const totalAssets      = byType('asset');
    const totalLiabilities = byType('liability');
    const totalEquity      = byType('equity');
    const totalRevenue     = byType('revenue');
    const totalExpenses    = byType('expense');
    res.json({ totalAssets, totalLiabilities, totalEquity, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.type) f.type = req.query.type;
    if (req.query.isActive !== undefined) f.isActive = req.query.isActive !== 'false';
    if (req.query.search) f.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { code: { $regex: req.query.search, $options: 'i' } },
    ];
    const items = await Account.find(f).sort({ code: 1 });
    res.json(items.map(dto));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const a = await Account.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!a) return res.status(404).json({ code: 'Account.NotFound', description: 'Account not found.' });
    res.json(dto(a));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const code = req.body.code || req.body.accountNumber;
    const existing = await Account.findOne({ tenantId: req.user.tenant_id, code, isDeleted: false });
    if (existing) return res.status(409).json({ code: 'Account.Duplicate', description: 'Account code already exists.' });
    // Frontend sends accountTypeId (MongoDB ID) — resolve to type code string
    let type = req.body.type;
    if (!type && req.body.accountTypeId) {
      const at = await AccountType.findById(req.body.accountTypeId);
      type = at?.code || 'asset';
    }
    const a = await Account.create({ ...req.body, code, type, tenantId: req.user.tenant_id });
    res.status(201).json(dto(a));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    let type = req.body.type;
    if (!type && req.body.accountTypeId) {
      const at = await AccountType.findById(req.body.accountTypeId);
      type = at?.code || undefined;
    }
    const updates = { ...req.body, updatedAt: new Date() };
    if (type) updates.type = type;
    const a = await Account.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      updates, { new: true }
    );
    if (!a) return res.status(404).json({ code: 'Account.NotFound', description: 'Account not found.' });
    res.json(dto(a));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await Account.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { summary, list, getById, create, update, remove };
