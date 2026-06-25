const SalesReturn = require('../models/SalesReturn');
const SalesOrder  = require('../models/SalesOrder');
const { tenantFilter } = require('../../../middleware/auth');
const { docNumber, paged, parsePaging } = require('../../../utils/helpers');

const dto = r => ({
  id: r._id, returnNumber: r.returnNumber, salesOrderId: r.salesOrderId,
  customerId: r.customerId, customerName: r.customerName, returnDate: r.returnDate,
  reason: r.reason, status: r.status, totalAmount: r.totalAmount, items: r.items, createdAt: r.createdAt,
});

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.salesOrderId) f.salesOrderId = req.query.salesOrderId;
    if (req.query.customerId) f.customerId = req.query.customerId;
    const [items, total] = await Promise.all([
      SalesReturn.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      SalesReturn.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const r = await SalesReturn.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!r) return res.status(404).json({ code: 'SalesReturn.NotFound', description: 'Sales return not found.' });
    res.json(dto(r));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const order = await SalesOrder.findOne({ _id: req.body.salesOrderId, ...tenantFilter(req), isDeleted: false });
    if (!order) return res.status(404).json({ code: 'SalesOrder.NotFound', description: 'Sales order not found.' });
    if (order.status === 'cancelled') return res.status(409).json({ code: 'SalesReturn.Conflict', description: 'Cannot return a cancelled order.' });
    const { items = [], ...rest } = req.body;
    const totalAmount = items.reduce((s, it) => s + (it.lineTotal || it.quantity * it.unitPrice), 0);
    const r = await SalesReturn.create({
      ...rest, items, totalAmount, returnNumber: docNumber('SRET'),
      customerId: order.customerId, customerName: order.customerName, tenantId: req.user.tenant_id,
    });
    res.status(201).json(dto(r));
  } catch (err) { next(err); }
};

module.exports = { list, getById, create };
