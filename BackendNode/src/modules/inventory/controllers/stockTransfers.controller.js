const StockTransfer = require('../models/StockTransfer');
const { tenantFilter } = require('../../../middleware/auth');
const { docNumber, paged, parsePaging } = require('../../../utils/helpers');

const dto = t => ({
  id: t._id, transferNumber: t.transferNumber, fromWarehouseId: t.fromWarehouseId,
  fromWarehouseName: t.fromWarehouseName, toWarehouseId: t.toWarehouseId,
  toWarehouseName: t.toWarehouseName, status: t.status, transferDate: t.transferDate,
  notes: t.notes, items: t.items, createdAt: t.createdAt,
});

const summary = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req), isDeleted: false };
    const all = await StockTransfer.find(f);
    const statuses = ['draft', 'submitted', 'approved', 'received'];
    const result = { total: all.length };
    statuses.forEach(s => { result[s] = all.filter(t => t.status === s).length; });
    res.json(result);
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    const [items, total] = await Promise.all([
      StockTransfer.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      StockTransfer.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const t = await StockTransfer.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!t) return res.status(404).json({ code: 'StockTransfer.NotFound', description: 'Transfer not found.' });
    res.json(dto(t));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const t = await StockTransfer.create({ ...req.body, transferNumber: docNumber('TRF'), tenantId: req.user.tenant_id });
    res.status(201).json(dto(t));
  } catch (err) { next(err); }
};

const transition = (from, to) => async (req, res, next) => {
  try {
    const t = await StockTransfer.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!t) return res.status(404).json({ code: 'StockTransfer.NotFound', description: 'Transfer not found.' });
    if (t.status !== from) return res.status(400).json({ code: 'StockTransfer.InvalidStatus', description: `Only ${from} transfers can be ${to}.` });
    t.status = to; t.updatedAt = new Date();
    await t.save();
    res.json(dto(t));
  } catch (err) { next(err); }
};

module.exports = { summary, list, getById, create, submit: transition('draft', 'submitted'), approve: transition('submitted', 'approved'), receive: transition('approved', 'received') };
