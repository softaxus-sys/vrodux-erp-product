const PurchaseReturn = require('../models/PurchaseReturn');
const PurchaseOrder  = require('../models/PurchaseOrder');
const { tenantFilter } = require('../../../middleware/auth');
const { docNumber, paged, parsePaging } = require('../../../utils/helpers');

const dto = r => ({
  id: r._id, returnNumber: r.returnNumber, purchaseOrderId: r.purchaseOrderId,
  vendorId: r.vendorId, vendorName: r.vendorName, returnDate: r.returnDate,
  reason: r.reason, status: r.status, totalAmount: r.totalAmount, items: r.items, createdAt: r.createdAt,
});

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.purchaseOrderId) f.purchaseOrderId = req.query.purchaseOrderId;
    if (req.query.vendorId) f.vendorId = req.query.vendorId;
    const [items, total] = await Promise.all([
      PurchaseReturn.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      PurchaseReturn.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const r = await PurchaseReturn.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!r) return res.status(404).json({ code: 'PurchaseReturn.NotFound', description: 'Purchase return not found.' });
    res.json(dto(r));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findOne({ _id: req.body.purchaseOrderId, ...tenantFilter(req), isDeleted: false });
    if (!order) return res.status(404).json({ code: 'PurchaseOrder.NotFound', description: 'Purchase order not found.' });
    if (order.status === 'cancelled') return res.status(409).json({ code: 'PurchaseReturn.Conflict', description: 'Cannot return a cancelled order.' });
    const { items = [], ...rest } = req.body;
    const totalAmount = items.reduce((s, it) => s + (it.lineTotal || it.quantity * it.unitCost), 0);
    const r = await PurchaseReturn.create({
      ...rest, items, totalAmount, returnNumber: docNumber('PRET'),
      vendorId: order.vendorId, vendorName: order.vendorName, tenantId: req.user.tenant_id,
    });
    res.status(201).json(dto(r));
  } catch (err) { next(err); }
};

module.exports = { list, getById, create };
