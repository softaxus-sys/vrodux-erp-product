const { REProperty, REUnit, RETenant, REContract, REBroker, RESiteVisit, REReservation, REBooking } = require('../models');
const { tenantFilter } = require('../../../middleware/auth');

const tf  = req => tenantFilter(req);
const tid = req => req.user.tenant_id;
const nf  = name => ({ code: `${name}.NotFound`, description: `${name} not found.` });

/* ─── Properties ─── */
exports.propertiesSummary = async (req, res, next) => {
  try {
    const all = await REProperty.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, available: all.filter(p => p.status === 'available').length, partiallySold: all.filter(p => p.status === 'partially_sold').length, soldOut: all.filter(p => p.status === 'sold_out').length, totalValue: all.reduce((s, p) => s + (p.marketValue || 0), 0) });
  } catch (err) { next(err); }
};
exports.listProperties = async (req, res, next) => {
  try { res.json(await REProperty.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 })); } catch (err) { next(err); }
};
exports.getPropertyById = async (req, res, next) => {
  try {
    const p = await REProperty.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!p) return res.status(404).json(nf('REProperty'));
    res.json(p);
  } catch (err) { next(err); }
};
exports.createProperty = async (req, res, next) => {
  try { res.status(201).json(await REProperty.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.updateProperty = async (req, res, next) => {
  try {
    const p = await REProperty.findOneAndUpdate({ _id: req.params.id, ...tf(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!p) return res.status(404).json(nf('REProperty'));
    res.json(p);
  } catch (err) { next(err); }
};
exports.deleteProperty = async (req, res, next) => {
  try {
    await REProperty.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Units ─── */
exports.unitsSummary = async (req, res, next) => {
  try {
    const all = await REUnit.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, available: all.filter(u => u.status === 'available').length, reserved: all.filter(u => u.status === 'reserved').length, sold: all.filter(u => u.status === 'sold').length, rented: all.filter(u => u.status === 'rented').length });
  } catch (err) { next(err); }
};
exports.listUnits = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.propertyId) f.propertyId = req.query.propertyId;
    res.json(await REUnit.find(f).sort({ unitNumber: 1 }));
  } catch (err) { next(err); }
};
exports.createUnit = async (req, res, next) => {
  try { res.status(201).json(await REUnit.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.deleteUnit = async (req, res, next) => {
  try { await REUnit.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true }); res.status(204).send(); } catch (err) { next(err); }
};

/* ─── Tenants (RE) ─── */
exports.reTenantsSummary = async (req, res, next) => {
  try {
    const all = await RETenant.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, active: all.filter(t => t.status === 'active').length });
  } catch (err) { next(err); }
};
exports.listReTenants = async (req, res, next) => {
  try { res.json(await RETenant.find({ ...tf(req), isDeleted: false }).sort({ fullName: 1 })); } catch (err) { next(err); }
};
exports.createReTenant = async (req, res, next) => {
  try { res.json(await RETenant.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.deleteReTenant = async (req, res, next) => {
  try {
    await RETenant.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Contracts (RE) ─── */
exports.contractsSummary = async (req, res, next) => {
  try {
    const all = await REContract.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, active: all.filter(c => c.status === 'active').length, expired: all.filter(c => c.status === 'expired').length, totalValue: all.reduce((s, c) => s + (c.amount || 0), 0) });
  } catch (err) { next(err); }
};
exports.listContracts = async (req, res, next) => {
  try { res.json(await REContract.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 })); } catch (err) { next(err); }
};
exports.createContract = async (req, res, next) => {
  try { res.status(201).json(await REContract.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.deleteContract = async (req, res, next) => {
  try { await REContract.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true }); res.status(204).send(); } catch (err) { next(err); }
};

/* ─── Brokers ─── */
exports.brokersSummary = async (req, res, next) => {
  try {
    const all = await REBroker.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, active: all.filter(b => b.status === 'active').length, totalSales: all.reduce((s, b) => s + (b.totalSales || 0), 0) });
  } catch (err) { next(err); }
};
exports.listBrokers = async (req, res, next) => {
  try { res.json(await REBroker.find({ ...tf(req), isDeleted: false }).sort({ name: 1 })); } catch (err) { next(err); }
};
exports.createBroker = async (req, res, next) => {
  try { res.status(201).json(await REBroker.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.deleteBroker = async (req, res, next) => {
  try { await REBroker.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true }); res.status(204).send(); } catch (err) { next(err); }
};

/* ─── Sales (Site Visits, Reservations, Bookings) ─── */
exports.salesSummary = async (req, res, next) => {
  try {
    const [visits, reservations, bookings] = await Promise.all([
      RESiteVisit.countDocuments({ ...tf(req), isDeleted: false }),
      REReservation.countDocuments({ ...tf(req), isDeleted: false }),
      REBooking.countDocuments({ ...tf(req), isDeleted: false }),
    ]);
    res.json({ siteVisits: visits, reservations, bookings });
  } catch (err) { next(err); }
};

// Site Visits
exports.listSiteVisits = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.leadId) f.leadId = req.query.leadId;
    res.json(await RESiteVisit.find(f).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};
exports.createSiteVisit = async (req, res, next) => {
  try { res.json(await RESiteVisit.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.completeSiteVisit = async (req, res, next) => {
  try {
    const v = await RESiteVisit.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { status: 'completed', feedback: req.body.feedback, updatedAt: new Date() }, { new: true });
    if (!v) return res.status(404).json(nf('RESiteVisit'));
    res.json(v);
  } catch (err) { next(err); }
};
exports.deleteSiteVisit = async (req, res, next) => {
  try {
    await RESiteVisit.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

// Reservations
exports.listReservations = async (req, res, next) => {
  try { res.json(await REReservation.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 })); } catch (err) { next(err); }
};
exports.createReservation = async (req, res, next) => {
  try { res.json(await REReservation.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.patchReservationStatus = async (req, res, next) => {
  try {
    const r = await REReservation.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { status: req.body.status, updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf('REReservation'));
    res.json(r);
  } catch (err) { next(err); }
};
exports.deleteReservation = async (req, res, next) => {
  try {
    await REReservation.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

// Bookings
exports.listBookings = async (req, res, next) => {
  try { res.json(await REBooking.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 })); } catch (err) { next(err); }
};
exports.createBooking = async (req, res, next) => {
  try { res.json(await REBooking.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.addBookingPayment = async (req, res, next) => {
  try {
    const b = await REBooking.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!b) return res.status(404).json(nf('REBooking'));
    b.paidAmount += req.body.amount || 0;
    if (b.paidAmount >= b.amount) b.status = 'completed';
    b.updatedAt = new Date();
    await b.save();
    res.json(b);
  } catch (err) { next(err); }
};
exports.patchBookingStatus = async (req, res, next) => {
  try {
    const b = await REBooking.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { status: req.body.status, updatedAt: new Date() }, { new: true });
    if (!b) return res.status(404).json(nf('REBooking'));
    res.json(b);
  } catch (err) { next(err); }
};
exports.deleteBooking = async (req, res, next) => {
  try {
    await REBooking.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};
