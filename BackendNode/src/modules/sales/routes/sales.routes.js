const router = require('express').Router();
const ord    = require('../controllers/orders.controller');
const dc     = require('../controllers/deliveryChallans.controller');
const ret    = require('../controllers/salesReturns.controller');
const cust   = require('../controllers/customers.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

// Customers
router.get('/customers',                     cust.list);
router.get('/customers/:id',                 cust.getById);
router.post('/customers',                    cust.create);
router.put('/customers/:id',                 cust.update);
router.delete('/customers/:id',              cust.remove);

// Sales Orders
router.get('/orders/summary',                ord.summary);
router.get('/orders',                        ord.list);
router.get('/orders/:id',                    ord.getById);
router.post('/orders',                       ord.create);
router.put('/orders/:id',                    ord.update);
router.patch('/orders/:id/status',           ord.updateStatus);
router.delete('/orders/:id',                 ord.remove);

// Delivery Challans
router.get('/delivery-challans',             dc.list);
router.get('/delivery-challans/:id',         dc.getById);
router.post('/delivery-challans',            dc.create);

// Sales Returns (with approve/reject workflow)
router.get('/returns',                       ret.list);
router.get('/returns/:id',                   ret.getById);
router.post('/returns',                      ret.create);
router.post('/returns/:id/approve', async (req, res, next) => {
  try {
    const SalesReturn = require('../models/SalesReturn');
    const r = await SalesReturn.findOneAndUpdate(
      { _id: req.params.id, ...require('../../../middleware/auth').tenantFilter(req) },
      { status: 'approved', actionBy: req.user.sub, actionByName: req.user.name || req.user.email, actionAt: new Date() },
      { new: true }
    );
    if (!r) return res.status(404).json({ code: 'SalesReturn.NotFound', description: 'Return not found.' });
    res.json(r);
  } catch (err) { next(err); }
});
router.post('/returns/:id/reject', async (req, res, next) => {
  try {
    const SalesReturn = require('../models/SalesReturn');
    const r = await SalesReturn.findOneAndUpdate(
      { _id: req.params.id, ...require('../../../middleware/auth').tenantFilter(req) },
      { status: 'rejected', actionBy: req.user.sub, actionByName: req.user.name || req.user.email, actionAt: new Date(), rejectionReason: req.body.reason },
      { new: true }
    );
    if (!r) return res.status(404).json({ code: 'SalesReturn.NotFound', description: 'Return not found.' });
    res.json(r);
  } catch (err) { next(err); }
});

// Sales Quotations
const SalesQuotation = require('../models/SalesQuotation');
const SalesOrder = require('../models/SalesOrder');
const tf  = req => require('../../../middleware/auth').tenantFilter(req);
const tid = req => req.user.tenant_id;

router.get('/quotations', async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    res.json(await SalesQuotation.find(f).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});
router.get('/quotations/:id', async (req, res, next) => {
  try {
    const q = await SalesQuotation.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!q) return res.status(404).json({ code: 'SalesQuotation.NotFound', description: 'Quotation not found.' });
    res.json(q);
  } catch (err) { next(err); }
});
router.post('/quotations', async (req, res, next) => {
  try {
    const count = await SalesQuotation.countDocuments({ tenantId: tid(req) });
    const quotationNumber = `QT-${String(count + 1).padStart(5, '0')}`;
    const items = (req.body.items || []).map(i => ({ ...i, lineTotal: (i.quantity || 1) * (i.unitPrice || 0) - (i.discount || 0) }));
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const taxAmount = subtotal * (req.body.taxRate || 0) / 100;
    const discountAmount = req.body.discountAmount || 0;
    const totalAmount = subtotal + taxAmount - discountAmount;
    res.status(201).json(await SalesQuotation.create({ ...req.body, quotationNumber, items, subtotal, taxAmount, discountAmount, totalAmount, tenantId: tid(req) }));
  } catch (err) { next(err); }
});
router.put('/quotations/:id', async (req, res, next) => {
  try {
    const q = await SalesQuotation.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'draft', isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!q) return res.status(404).json({ code: 'SalesQuotation.NotFound', description: 'Quotation not found.' });
    res.json(q);
  } catch (err) { next(err); }
});
router.post('/quotations/:id/send', async (req, res, next) => {
  try {
    const q = await SalesQuotation.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'draft' }, { status: 'sent', updatedAt: new Date() }, { new: true });
    if (!q) return res.status(404).json({ code: 'SalesQuotation.NotFound', description: 'Quotation not found.' });
    res.json(q);
  } catch (err) { next(err); }
});
router.post('/quotations/:id/convert', async (req, res, next) => {
  try {
    const q = await SalesQuotation.findOne({ _id: req.params.id, ...tf(req), status: 'approved', isDeleted: false });
    if (!q) return res.status(404).json({ code: 'SalesQuotation.NotFound', description: 'Quotation not found or not approved.' });
    const count = await SalesOrder.countDocuments({ tenantId: tid(req) });
    const orderNumber = `SO-${String(count + 1).padStart(5, '0')}`;
    const order = await SalesOrder.create({
      tenantId: tid(req), orderNumber, customerId: q.customerId, customerName: q.customerName,
      orderDate: new Date().toISOString().split('T')[0], items: q.items,
      subtotal: q.subtotal, taxRate: q.taxRate, taxAmount: q.taxAmount,
      discountAmount: q.discountAmount, totalAmount: q.totalAmount, notes: q.notes,
    });
    q.status = 'converted';
    q.convertedOrderId = order._id.toString();
    q.updatedAt = new Date();
    await q.save();
    res.json({ quotation: q, order });
  } catch (err) { next(err); }
});
router.delete('/quotations/:id', async (req, res, next) => {
  try {
    await SalesQuotation.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
