const StockMovement = require('../models/StockMovement');
const ProductStock = require('../models/ProductStock');
const { tenantFilter } = require('../../../middleware/auth');

const dto = m => ({
  id: m._id, productId: m.productId, productName: m.productName, warehouseId: m.warehouseId,
  warehouseName: m.warehouseName, type: m.type, quantity: m.quantity, unitCost: m.unitCost,
  reference: m.reference, notes: m.notes, createdAt: m.createdAt,
});

const create = async (req, res, next) => {
  try {
    const m = await StockMovement.create({ ...req.body, tenantId: req.user.tenant_id });
    const delta = ['receipt', 'adjustment', 'transfer-in', 'count-correction'].includes(req.body.type)
      ? req.body.quantity : -Math.abs(req.body.quantity);
    await ProductStock.findOneAndUpdate(
      { productId: req.body.productId, tenantId: req.user.tenant_id },
      { $inc: { totalQty: delta }, updatedAt: new Date() },
      { upsert: true }
    );
    res.status(201).json(dto(m));
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req) };
    if (req.query.productId) f.productId = req.query.productId;
    if (req.query.warehouseId) f.warehouseId = req.query.warehouseId;
    const items = await StockMovement.find(f).sort({ createdAt: -1 }).limit(200);
    res.json(items.map(dto));
  } catch (err) { next(err); }
};

module.exports = { create, list };
