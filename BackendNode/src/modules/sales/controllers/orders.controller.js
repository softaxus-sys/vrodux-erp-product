const SalesOrder = require('../models/SalesOrder');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

// Frontend expects: subTotal (not subtotal), total (not totalAmount), itemCount for list
const dto = o => ({
  id:           o._id,
  orderNumber:  o.orderNumber,
  customerId:   o.customerId,
  customerName: o.customerName,
  orderDate:    o.orderDate,
  deliveryDate: o.deliveryDate || null,
  status:       o.status,
  subTotal:     o.subtotal || 0,
  taxAmount:    o.taxAmount || 0,
  total:        o.totalAmount || 0,
  totalAmount:  o.totalAmount || 0,
  itemCount:    Array.isArray(o.items) ? o.items.length : 0,
  notes:        o.notes || null,
  items:        o.items || [],
  createdAt:    o.createdAt,
  updatedAt:    o.updatedAt || null,
});

const summary = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req), isDeleted: false };
    const all = await SalesOrder.find(f);
    const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    const result = { total: all.length, totalRevenue: 0 };
    statuses.forEach(s => { result[s] = all.filter(o => o.status === s).length; });
    result.totalRevenue = all.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.totalAmount || 0), 0);
    res.json(result);
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.search) f.customerName = { $regex: req.query.search, $options: 'i' };
    const [items, total] = await Promise.all([
      SalesOrder.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      SalesOrder.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const o = await SalesOrder.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!o) return res.status(404).json({ code: 'SalesOrder.NotFound', description: 'Sales order not found.' });
    res.json(dto(o));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { items = [], ...rest } = req.body;
    const normItems = items.map(it => ({ ...it, orderedQuantity: it.orderedQuantity ?? it.quantity ?? 0 }));
    const subtotal = normItems.reduce((s, it) => s + (it.lineTotal || it.orderedQuantity * (it.unitPrice || 0)), 0);
    const taxAmount = items.reduce((s, it) => s + (it.lineTotal * (it.taxRate || 0) / 100), 0);
    const count = await SalesOrder.countDocuments({ tenantId: req.user.tenant_id });
    const orderNumber = `SO-${String(count + 1).padStart(5, '0')}`;
    const o = await SalesOrder.create({ ...rest, items: normItems, subtotal, taxAmount, totalAmount: subtotal + taxAmount, orderNumber, tenantId: req.user.tenant_id });
    res.status(201).json(dto(o));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const o = await SalesOrder.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!o) return res.status(404).json({ code: 'SalesOrder.NotFound', description: 'Sales order not found.' });
    res.json(dto(o));
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const o = await SalesOrder.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { status, updatedAt: new Date() }, { new: true }
    );
    if (!o) return res.status(404).json({ code: 'SalesOrder.NotFound', description: 'Sales order not found.' });
    res.json(dto(o));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await SalesOrder.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { summary, list, getById, create, update, updateStatus, remove };
