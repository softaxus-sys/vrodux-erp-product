const GoodsReceiptNote = require('../models/GoodsReceiptNote');
const PurchaseOrder    = require('../models/PurchaseOrder');
const { tenantFilter } = require('../../../middleware/auth');
const { docNumber, paged, parsePaging } = require('../../../utils/helpers');

const dto = g => ({
  id: g._id, grnNumber: g.grnNumber, purchaseOrderId: g.purchaseOrderId, vendorId: g.vendorId,
  grnDate: g.grnDate, notes: g.notes, status: g.status, items: g.items, createdAt: g.createdAt,
});

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.purchaseOrderId) f.purchaseOrderId = req.query.purchaseOrderId;
    if (req.query.vendorId) f.vendorId = req.query.vendorId;
    const [items, total] = await Promise.all([
      GoodsReceiptNote.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      GoodsReceiptNote.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const g = await GoodsReceiptNote.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!g) return res.status(404).json({ code: 'GoodsReceiptNote.NotFound', description: 'GRN not found.' });
    res.json(dto(g));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findOne({ _id: req.body.purchaseOrderId, ...tenantFilter(req), isDeleted: false });
    if (!order) return res.status(404).json({ code: 'PurchaseOrder.NotFound', description: 'Purchase order not found.' });
    if (order.status === 'cancelled') return res.status(409).json({ code: 'GoodsReceiptNote.Conflict', description: 'Cannot create GRN for a cancelled order.' });
    const g = await GoodsReceiptNote.create({ ...req.body, grnNumber: docNumber('GRN'), vendorId: order.vendorId, tenantId: req.user.tenant_id });
    const allGrns = await GoodsReceiptNote.find({ purchaseOrderId: order._id, status: 'posted', isDeleted: false });
    const received = {};
    allGrns.forEach(gr => gr.items.forEach(it => { received[it.purchaseOrderItemId] = (received[it.purchaseOrderItemId] || 0) + it.receivedQuantity; }));
    const allDone = order.items.every(oi => (received[String(oi._id)] || 0) >= oi.orderedQuantity);
    const anyDone = order.items.some(oi => (received[String(oi._id)] || 0) > 0);
    order.status = allDone ? 'received' : anyDone ? 'partial' : order.status;
    order.updatedAt = new Date();
    await order.save();
    res.status(201).json(dto(g));
  } catch (err) { next(err); }
};

module.exports = { list, getById, create };
