const { RestTable, RestMenuCategory, RestMenuItem, RestOrder, RestReservation, KitchenTicket } = require('../models');
const { tenantFilter } = require('../../../middleware/auth');

const tf  = req => tenantFilter(req);
const tid = req => req.user.tenant_id;
const nf  = name => ({ code: `${name}.NotFound`, description: `${name} not found.` });

/* ─── Summary ─── */
exports.summary = async (req, res, next) => {
  try {
    const [tables, orders, reservations] = await Promise.all([
      RestTable.find({ ...tf(req), isDeleted: false }),
      RestOrder.find({ ...tf(req), isDeleted: false, status: { $ne: 'cancelled' } }),
      RestReservation.countDocuments({ ...tf(req), isDeleted: false, status: { $in: ['pending', 'confirmed'] } }),
    ]);
    res.json({
      tables: { total: tables.length, available: tables.filter(t => t.status === 'available').length, occupied: tables.filter(t => t.status === 'occupied').length, reserved: tables.filter(t => t.status === 'reserved').length },
      orders: { open: orders.filter(o => o.status === 'open').length, inKitchen: orders.filter(o => o.status === 'sent_to_kitchen').length, today: orders.filter(o => o.status === 'closed').length, todayRevenue: orders.filter(o => o.status === 'closed').reduce((s, o) => s + o.totalAmount, 0) },
      activeReservations: reservations,
    });
  } catch (err) { next(err); }
};

/* ─── Tables ─── */
exports.listTables = async (req, res, next) => {
  try { res.json(await RestTable.find({ ...tf(req), isDeleted: false }).sort({ number: 1 })); } catch (err) { next(err); }
};
exports.createTable = async (req, res, next) => {
  try { res.status(201).json(await RestTable.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.updateTable = async (req, res, next) => {
  try {
    const t = await RestTable.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, req.body, { new: true });
    if (!t) return res.status(404).json(nf('RestTable'));
    res.json(t);
  } catch (err) { next(err); }
};
exports.patchTableStatus = async (req, res, next) => {
  try {
    const t = await RestTable.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { status: req.body.status }, { new: true });
    if (!t) return res.status(404).json(nf('RestTable'));
    res.json(t);
  } catch (err) { next(err); }
};
exports.deleteTable = async (req, res, next) => {
  try {
    await RestTable.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Menu Categories ─── */
exports.listCategories = async (req, res, next) => {
  try { res.json(await RestMenuCategory.find({ ...tf(req), isDeleted: false }).sort({ order: 1, name: 1 })); } catch (err) { next(err); }
};
exports.createCategory = async (req, res, next) => {
  try { res.status(201).json(await RestMenuCategory.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.updateCategory = async (req, res, next) => {
  try {
    const c = await RestMenuCategory.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, req.body, { new: true });
    if (!c) return res.status(404).json(nf('RestMenuCategory'));
    res.json(c);
  } catch (err) { next(err); }
};
exports.deleteCategory = async (req, res, next) => {
  try {
    await RestMenuCategory.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Menu Items ─── */
exports.listMenuItems = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.categoryId) f.categoryId = req.query.categoryId;
    if (req.query.isAvailable !== undefined) f.isAvailable = req.query.isAvailable === 'true';
    res.json(await RestMenuItem.find(f).sort({ name: 1 }));
  } catch (err) { next(err); }
};
exports.getMenuItemById = async (req, res, next) => {
  try {
    const m = await RestMenuItem.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!m) return res.status(404).json(nf('RestMenuItem'));
    res.json(m);
  } catch (err) { next(err); }
};
exports.createMenuItem = async (req, res, next) => {
  try { res.status(201).json(await RestMenuItem.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.updateMenuItem = async (req, res, next) => {
  try {
    const m = await RestMenuItem.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!m) return res.status(404).json(nf('RestMenuItem'));
    res.json(m);
  } catch (err) { next(err); }
};
exports.toggleMenuItemAvailability = async (req, res, next) => {
  try {
    const m = await RestMenuItem.findOne({ _id: req.params.id, ...tf(req) });
    if (!m) return res.status(404).json(nf('RestMenuItem'));
    m.isAvailable = !m.isAvailable;
    await m.save();
    res.json(m);
  } catch (err) { next(err); }
};
exports.deleteMenuItem = async (req, res, next) => {
  try {
    await RestMenuItem.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Orders ─── */
exports.listOrders = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.tableId) f.tableId = req.query.tableId;
    res.json(await RestOrder.find(f).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};
exports.getOrderById = async (req, res, next) => {
  try {
    const o = await RestOrder.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!o) return res.status(404).json(nf('RestOrder'));
    res.json(o);
  } catch (err) { next(err); }
};
exports.createOrder = async (req, res, next) => {
  try {
    const count = await RestOrder.countDocuments({ tenantId: tid(req) });
    const orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;
    const items = (req.body.items || []).map(i => ({ ...i, lineTotal: (i.quantity || 1) * (i.unitPrice || 0) }));
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const taxAmount = subtotal * (req.body.taxRate || 0) / 100;
    const discountAmount = req.body.discountAmount || 0;
    const totalAmount = subtotal + taxAmount - discountAmount;
    const o = await RestOrder.create({ ...req.body, orderNumber, items, subtotal, taxAmount, discountAmount, totalAmount, tenantId: tid(req) });
    if (o.tableId) await RestTable.findOneAndUpdate({ _id: o.tableId }, { status: 'occupied' });
    res.status(201).json(o);
  } catch (err) { next(err); }
};
exports.addOrderItems = async (req, res, next) => {
  try {
    const o = await RestOrder.findOne({ _id: req.params.id, ...tf(req), status: 'open', isDeleted: false });
    if (!o) return res.status(404).json(nf('RestOrder'));
    const newItems = (req.body.items || []).map(i => ({ ...i, lineTotal: (i.quantity || 1) * (i.unitPrice || 0) }));
    o.items.push(...newItems);
    o.subtotal += newItems.reduce((s, i) => s + i.lineTotal, 0);
    o.totalAmount = o.subtotal + o.taxAmount - o.discountAmount;
    o.updatedAt = new Date();
    await o.save();
    res.json(o);
  } catch (err) { next(err); }
};
exports.sendToKitchen = async (req, res, next) => {
  try {
    const o = await RestOrder.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!o) return res.status(404).json(nf('RestOrder'));
    o.status = 'sent_to_kitchen';
    o.items.forEach(i => { if (i.status === 'pending') { i.status = 'preparing'; i.sentAt = new Date(); } });
    o.updatedAt = new Date();
    await o.save();
    const ticket = await KitchenTicket.create({
      tenantId: tid(req),
      orderId: o._id.toString(),
      orderNumber: o.orderNumber,
      tableNumber: o.tableNumber,
      items: o.items.map(i => ({ menuItemId: i.menuItemId, name: i.name, quantity: i.quantity, notes: i.notes })),
    });
    res.json({ order: o, ticket });
  } catch (err) { next(err); }
};
exports.closeOrder = async (req, res, next) => {
  try {
    const o = await RestOrder.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!o) return res.status(404).json(nf('RestOrder'));
    o.status = 'closed';
    o.paidAmount = req.body.paidAmount || o.totalAmount;
    o.paymentMethod = req.body.paymentMethod;
    o.closedAt = new Date();
    o.updatedAt = new Date();
    await o.save();
    if (o.tableId) await RestTable.findOneAndUpdate({ _id: o.tableId }, { status: 'cleaning' });
    res.json(o);
  } catch (err) { next(err); }
};
exports.cancelOrder = async (req, res, next) => {
  try {
    const o = await RestOrder.findOneAndUpdate(
      { _id: req.params.id, ...tf(req), status: { $in: ['open'] } },
      { status: 'cancelled', updatedAt: new Date() },
      { new: true }
    );
    if (!o) return res.status(404).json(nf('RestOrder'));
    if (o.tableId) await RestTable.findOneAndUpdate({ _id: o.tableId }, { status: 'available' });
    res.json(o);
  } catch (err) { next(err); }
};
exports.deleteOrder = async (req, res, next) => {
  try {
    await RestOrder.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Reservations ─── */
exports.listReservations = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.date) f.date = req.query.date;
    if (req.query.status) f.status = req.query.status;
    res.json(await RestReservation.find(f).sort({ date: 1, time: 1 }));
  } catch (err) { next(err); }
};
exports.createReservation = async (req, res, next) => {
  try { res.status(201).json(await RestReservation.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.patchReservationStatus = async (req, res, next) => {
  try {
    const r = await RestReservation.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { status: req.body.status, updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf('RestReservation'));
    res.json(r);
  } catch (err) { next(err); }
};
exports.deleteReservation = async (req, res, next) => {
  try {
    await RestReservation.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Kitchen ─── */
exports.listKitchenTickets = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    res.json(await KitchenTicket.find(f).sort({ createdAt: 1 }));
  } catch (err) { next(err); }
};
exports.patchTicketStatus = async (req, res, next) => {
  try {
    const upd = { status: req.body.status };
    if (req.body.status === 'completed') upd.completedAt = new Date();
    const t = await KitchenTicket.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, upd, { new: true });
    if (!t) return res.status(404).json(nf('KitchenTicket'));
    if (req.body.status === 'ready') {
      await RestOrder.findOneAndUpdate({ _id: t.orderId }, { status: 'ready', updatedAt: new Date() });
    }
    res.json(t);
  } catch (err) { next(err); }
};
