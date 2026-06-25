const Invoice = require('../models/Invoice');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

// Frontend expects: subTotal (not subtotal), total (not totalAmount), itemCount, paidAt
const dto = i => ({
  id:            i._id,
  invoiceNumber: i.invoiceNumber,
  customerName:  i.customerName,
  customerEmail: i.customerEmail || null,
  invoiceDate:   i.invoiceDate,
  dueDate:       i.dueDate,
  taxRate:       i.taxRate || 0,
  subTotal:      i.subtotal || 0,
  taxAmount:     i.taxAmount || 0,
  total:         i.totalAmount || 0,
  status:        i.status,
  itemCount:     Array.isArray(i.items) ? i.items.length : 0,
  paidAt:        i.paidAt || null,
  notes:         i.notes || null,
  createdAt:     i.createdAt,
  updatedAt:     i.updatedAt || null,
});

const detailDto = i => ({
  ...dto(i),
  items: (i.items || []).map(it => ({
    id:          it._id,
    description: it.itemName || it.description || '',
    quantity:    it.quantity || 1,
    unitPrice:   it.unitPrice || 0,
    lineTotal:   it.lineTotal || 0,
  })),
});

exports.summary = async (req, res, next) => {
  try {
    const f    = { ...tenantFilter(req), isDeleted: false };
    const all  = await Invoice.find(f);
    const now  = new Date().toISOString().split('T')[0];
    const totalInvoices   = all.length;
    const totalAmount     = all.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const totalPaid       = all.filter(i => i.status === 'paid').reduce((s, i) => s + (i.totalAmount || 0), 0);
    const totalOverdue    = all.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.dueDate < now).reduce((s, i) => s + ((i.totalAmount || 0) - (i.paidAmount || 0)), 0);
    const totalOutstanding= all.filter(i => !['paid','cancelled'].includes(i.status)).reduce((s, i) => s + ((i.totalAmount || 0) - (i.paidAmount || 0)), 0);
    const draftCount      = all.filter(i => i.status === 'draft').length;
    res.json({ totalInvoices, totalAmount, totalPaid, totalOverdue, totalOutstanding, draftCount });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.search) f.customerName = { $regex: req.query.search, $options: 'i' };
    const [items, total] = await Promise.all([
      Invoice.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      Invoice.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const i = await Invoice.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!i) return res.status(404).json({ code: 'Invoice.NotFound', description: 'Invoice not found.' });
    res.json(detailDto(i));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { items = [], taxRate = 0, ...rest } = req.body;
    const subtotal    = items.reduce((s, it) => s + (it.lineTotal || it.quantity * it.unitPrice || 0), 0);
    const taxAmount   = Math.round(subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;
    const count       = await Invoice.countDocuments({ tenantId: req.user.tenant_id });
    const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;
    const i = await Invoice.create({
      ...rest, items, taxRate, subtotal, taxAmount, totalAmount,
      dueAmount: totalAmount, paidAmount: 0,
      invoiceNumber, tenantId: req.user.tenant_id,
    });
    res.status(201).json(detailDto(i));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const i = await Invoice.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!i) return res.status(404).json({ code: 'Invoice.NotFound', description: 'Invoice not found.' });
    Object.assign(i, req.body, { updatedAt: new Date() });
    await i.save();
    res.json(detailDto(i));
  } catch (err) { next(err); }
};

exports.send = async (req, res, next) => {
  try {
    const i = await Invoice.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!i) return res.status(404).json({ code: 'Invoice.NotFound', description: 'Invoice not found.' });
    i.status = 'sent'; i.updatedAt = new Date(); await i.save();
    res.json(detailDto(i));
  } catch (err) { next(err); }
};

exports.pay = async (req, res, next) => {
  try {
    const i = await Invoice.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!i) return res.status(404).json({ code: 'Invoice.NotFound', description: 'Invoice not found.' });
    i.status = 'paid'; i.paidAmount = i.totalAmount; i.dueAmount = 0;
    i.paidAt = new Date(); i.updatedAt = new Date(); await i.save();
    res.json(detailDto(i));
  } catch (err) { next(err); }
};

exports.cancel = async (req, res, next) => {
  try {
    const i = await Invoice.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!i) return res.status(404).json({ code: 'Invoice.NotFound', description: 'Invoice not found.' });
    if (i.status === 'paid') return res.status(400).json({ code: 'Invoice.CannotCancel', description: 'Paid invoices cannot be cancelled.' });
    i.status = 'cancelled'; i.updatedAt = new Date(); await i.save();
    res.json(detailDto(i));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Invoice.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};
