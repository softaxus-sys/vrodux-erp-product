const router = require('express').Router();
const po     = require('../controllers/purchaseOrders.controller');
const grn    = require('../controllers/grn.controller');
const ret    = require('../controllers/purchaseReturns.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

// Purchase Orders
router.get('/orders/summary',        po.summary);
router.get('/orders',                po.list);
router.get('/orders/:id',            po.getById);
router.post('/orders',               po.create);
router.put('/orders/:id',            po.update);
router.patch('/orders/:id/status',   po.updateStatus);
router.delete('/orders/:id',         po.remove);

// Goods Receipt Notes
router.get('/grn',                   grn.list);
router.get('/grn/:id',               grn.getById);
router.post('/grn',                  grn.create);

// Purchase Returns
router.get('/returns',               ret.list);
router.get('/returns/:id',           ret.getById);
router.post('/returns',              ret.create);

// Purchase Bills (AP) — alias for /api/finance/purchase-bills
const pb = require('../../finance/controllers/purchaseBills.controller');
router.get('/bills/summary',         pb.summary);
router.get('/bills',                 pb.list);
router.get('/bills/:id',             pb.getById);
router.post('/bills',                pb.create);
router.put('/bills/:id',             pb.update);
router.post('/bills/:id/approve',    pb.approve);
router.post('/bills/:id/cancel',     pb.cancel);
router.delete('/bills/:id',          pb.remove);

// Vendors
const { Vendor, Approval } = require('../models/PurchaseExtensions');
const { tenantFilter } = require('../../../middleware/auth');
const tf = req => tenantFilter(req);
const tid = req => req.user.tenant_id;

router.get('/vendors', async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.search) { const re = new RegExp(req.query.search, 'i'); f.$or = [{ name: re }, { email: re }]; }
    if (req.query.isActive !== undefined) f.isActive = req.query.isActive === 'true';
    if (req.query.category) f.category = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const [items, total] = await Promise.all([
      Vendor.find(f).sort({ name: 1 }).skip((page - 1) * pageSize).limit(pageSize),
      Vendor.countDocuments(f),
    ]);
    res.json({ items, page, pageSize, totalCount: total, totalPages: Math.ceil(total / pageSize) });
  } catch (err) { next(err); }
});
router.get('/vendors/:id', async (req, res, next) => {
  try {
    const v = await Vendor.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!v) return res.status(404).json({ code: 'Vendor.NotFound', description: 'Vendor not found.' });
    res.json(v);
  } catch (err) { next(err); }
});
router.post('/vendors', async (req, res, next) => {
  try { res.status(201).json(await Vendor.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
});
router.put('/vendors/:id', async (req, res, next) => {
  try {
    const v = await Vendor.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, req.body, { new: true });
    if (!v) return res.status(404).json({ code: 'Vendor.NotFound', description: 'Vendor not found.' });
    res.json(v);
  } catch (err) { next(err); }
});
router.delete('/vendors/:id', async (req, res, next) => {
  try {
    await Vendor.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
});

// Approvals
router.get('/approvals/summary', async (req, res, next) => {
  try {
    const all = await Approval.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, pending: all.filter(a => a.status === 'pending').length, approved: all.filter(a => a.status === 'approved').length, rejected: all.filter(a => a.status === 'rejected').length });
  } catch (err) { next(err); }
});
router.get('/approvals', async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.resourceType) f.resourceType = req.query.resourceType;
    res.json(await Approval.find(f).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});
router.get('/approvals/:id', async (req, res, next) => {
  try {
    const a = await Approval.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!a) return res.status(404).json({ code: 'Approval.NotFound', description: 'Approval not found.' });
    res.json(a);
  } catch (err) { next(err); }
});
router.post('/approvals', async (req, res, next) => {
  try {
    res.status(201).json(await Approval.create({ ...req.body, requestedBy: req.user.sub, requestedByName: req.user.name || req.user.email, tenantId: tid(req) }));
  } catch (err) { next(err); }
});
router.post('/approvals/:id/approve', async (req, res, next) => {
  try {
    const a = await Approval.findOneAndUpdate(
      { _id: req.params.id, ...tf(req), status: 'pending' },
      { status: 'approved', approvedBy: req.user.sub, approvedByName: req.user.name || req.user.email, approvedAt: new Date() },
      { new: true }
    );
    if (!a) return res.status(404).json({ code: 'Approval.NotFound', description: 'Approval not found.' });
    res.json(a);
  } catch (err) { next(err); }
});
router.post('/approvals/:id/reject', async (req, res, next) => {
  try {
    const a = await Approval.findOneAndUpdate(
      { _id: req.params.id, ...tf(req), status: 'pending' },
      { status: 'rejected', rejectedBy: req.user.sub, rejectedByName: req.user.name || req.user.email, rejectedAt: new Date(), rejectionReason: req.body.reason },
      { new: true }
    );
    if (!a) return res.status(404).json({ code: 'Approval.NotFound', description: 'Approval not found.' });
    res.json(a);
  } catch (err) { next(err); }
});

module.exports = router;
