const DeliveryChallan = require('../models/DeliveryChallan');
const SalesOrder = require('../models/SalesOrder');
const { tenantFilter } = require('../../../middleware/auth');
const { docNumber, paged, parsePaging } = require('../../../utils/helpers');

const dto = c => ({
  id: c._id, challanNumber: c.challanNumber, salesOrderId: c.salesOrderId, customerId: c.customerId,
  challanDate: c.challanDate, driverName: c.driverName, notes: c.notes, status: c.status,
  items: c.items, createdAt: c.createdAt,
});

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.salesOrderId) f.salesOrderId = req.query.salesOrderId;
    if (req.query.customerId) f.customerId = req.query.customerId;
    const [items, total] = await Promise.all([
      DeliveryChallan.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      DeliveryChallan.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const c = await DeliveryChallan.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!c) return res.status(404).json({ code: 'DeliveryChallan.NotFound', description: 'Delivery challan not found.' });
    res.json(dto(c));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const order = await SalesOrder.findOne({ _id: req.body.salesOrderId, ...tenantFilter(req), isDeleted: false });
    if (!order) return res.status(404).json({ code: 'SalesOrder.NotFound', description: 'Sales order not found.' });
    if (order.status === 'cancelled') return res.status(409).json({ code: 'DeliveryChallan.Conflict', description: 'Cannot create challan for a cancelled order.' });
    const c = await DeliveryChallan.create({ ...req.body, challanNumber: docNumber('DC'), customerId: order.customerId, tenantId: req.user.tenant_id });
    const allChallans = await DeliveryChallan.find({ salesOrderId: order._id, status: 'posted', isDeleted: false });
    const delivered = {};
    allChallans.forEach(ch => ch.items.forEach(it => { delivered[it.salesOrderItemId] = (delivered[it.salesOrderItemId] || 0) + it.deliveredQuantity; }));
    const allDone = order.items.every(oi => (delivered[String(oi._id)] || 0) >= oi.orderedQuantity);
    const anyDone = order.items.some(oi => (delivered[String(oi._id)] || 0) > 0);
    order.status = allDone ? 'delivered' : anyDone ? 'shipped' : order.status;
    order.updatedAt = new Date();
    await order.save();
    res.status(201).json(dto(c));
  } catch (err) { next(err); }
};

module.exports = { list, getById, create };
