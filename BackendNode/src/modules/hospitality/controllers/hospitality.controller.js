const { HospRoom, HospBooking, HospHousekeeping, HospGuest } = require('../models');
const { tenantFilter } = require('../../../middleware/auth');
const { docNumber } = require('../../../utils/helpers');

const tf  = req => tenantFilter(req);
const tid = req => req.user.tenant_id;
const nf  = name => ({ code: `${name}.NotFound`, description: `${name} not found.` });

/* ─── Summary ─── */
exports.summary = async (req, res, next) => {
  try {
    const [rooms, bookings, tasks, guests] = await Promise.all([
      HospRoom.find({ ...tf(req), isDeleted: false }),
      HospBooking.find({ ...tf(req), isDeleted: false }),
      HospHousekeeping.find({ ...tf(req), isDeleted: false }),
      HospGuest.countDocuments({ ...tf(req), isDeleted: false }),
    ]);
    res.json({
      rooms: { total: rooms.length, available: rooms.filter(r => r.status === 'available').length, occupied: rooms.filter(r => r.status === 'occupied').length, maintenance: rooms.filter(r => r.status === 'maintenance').length },
      bookings: { total: bookings.length, reserved: bookings.filter(b => b.status === 'reserved').length, checkedIn: bookings.filter(b => b.status === 'checked_in').length, checkedOut: bookings.filter(b => b.status === 'checked_out').length, totalRevenue: bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + b.totalAmount, 0) },
      housekeeping: { pending: tasks.filter(t => t.status === 'pending').length, inProgress: tasks.filter(t => t.status === 'in_progress').length, completed: tasks.filter(t => t.status === 'completed').length },
      guests,
    });
  } catch (err) { next(err); }
};

/* ─── Rooms ─── */
exports.listRooms = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.type) f.type = req.query.type;
    res.json(await HospRoom.find(f).sort({ number: 1 }));
  } catch (err) { next(err); }
};
exports.getRoomById = async (req, res, next) => {
  try {
    const r = await HospRoom.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!r) return res.status(404).json(nf('HospRoom'));
    res.json(r);
  } catch (err) { next(err); }
};
exports.createRoom = async (req, res, next) => {
  try { res.status(201).json(await HospRoom.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.updateRoom = async (req, res, next) => {
  try {
    const r = await HospRoom.findOneAndUpdate({ _id: req.params.id, ...tf(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf('HospRoom'));
    res.json(r);
  } catch (err) { next(err); }
};
exports.patchRoomStatus = async (req, res, next) => {
  try {
    const r = await HospRoom.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { status: req.body.status, updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf('HospRoom'));
    res.json(r);
  } catch (err) { next(err); }
};
exports.deleteRoom = async (req, res, next) => {
  try {
    await HospRoom.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Bookings ─── */
exports.listBookings = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.roomId) f.roomId = req.query.roomId;
    res.json(await HospBooking.find(f).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};
exports.getBookingById = async (req, res, next) => {
  try {
    const b = await HospBooking.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!b) return res.status(404).json(nf('HospBooking'));
    res.json(b);
  } catch (err) { next(err); }
};
exports.createBooking = async (req, res, next) => {
  try {
    const count = await HospBooking.countDocuments({ tenantId: tid(req) });
    const bookingNumber = `BOOK-${String(count + 1).padStart(5, '0')}`;
    res.status(201).json(await HospBooking.create({ ...req.body, bookingNumber, tenantId: tid(req) }));
  } catch (err) { next(err); }
};
exports.checkIn = async (req, res, next) => {
  try {
    const b = await HospBooking.findOneAndUpdate(
      { _id: req.params.id, ...tf(req), status: 'reserved' },
      { status: 'checked_in', updatedAt: new Date() },
      { new: true }
    );
    if (!b) return res.status(404).json(nf('HospBooking'));
    await HospRoom.findOneAndUpdate({ _id: b.roomId }, { status: 'occupied' });
    res.json(b);
  } catch (err) { next(err); }
};
exports.checkOut = async (req, res, next) => {
  try {
    const b = await HospBooking.findOneAndUpdate(
      { _id: req.params.id, ...tf(req), status: 'checked_in' },
      { status: 'checked_out', updatedAt: new Date() },
      { new: true }
    );
    if (!b) return res.status(404).json(nf('HospBooking'));
    await HospRoom.findOneAndUpdate({ _id: b.roomId }, { status: 'available' });
    res.json(b);
  } catch (err) { next(err); }
};
exports.cancelBooking = async (req, res, next) => {
  try {
    const b = await HospBooking.findOneAndUpdate(
      { _id: req.params.id, ...tf(req), status: { $in: ['reserved'] } },
      { status: 'cancelled', updatedAt: new Date() },
      { new: true }
    );
    if (!b) return res.status(404).json(nf('HospBooking'));
    res.json(b);
  } catch (err) { next(err); }
};
exports.deleteBooking = async (req, res, next) => {
  try {
    await HospBooking.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Housekeeping ─── */
exports.listHousekeeping = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.roomId) f.roomId = req.query.roomId;
    res.json(await HospHousekeeping.find(f).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};
exports.createTask = async (req, res, next) => {
  try { res.status(201).json(await HospHousekeeping.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.patchTaskStatus = async (req, res, next) => {
  try {
    const upd = { status: req.body.status, updatedAt: new Date() };
    if (req.body.status === 'completed') { upd.completedAt = new Date(); }
    const t = await HospHousekeeping.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, upd, { new: true });
    if (!t) return res.status(404).json(nf('HospHousekeeping'));
    if (req.body.status === 'completed') {
      await HospRoom.findOneAndUpdate({ _id: t.roomId }, { status: 'available' });
    }
    res.json(t);
  } catch (err) { next(err); }
};
exports.deleteTask = async (req, res, next) => {
  try {
    await HospHousekeeping.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Guests ─── */
exports.listGuests = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.search) { const re = new RegExp(req.query.search, 'i'); f.$or = [{ fullName: re }, { email: re }, { phone: re }]; }
    res.json(await HospGuest.find(f).sort({ fullName: 1 }));
  } catch (err) { next(err); }
};
exports.createGuest = async (req, res, next) => {
  try { res.status(201).json(await HospGuest.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.updateGuest = async (req, res, next) => {
  try {
    const g = await HospGuest.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, req.body, { new: true });
    if (!g) return res.status(404).json(nf('HospGuest'));
    res.json(g);
  } catch (err) { next(err); }
};
exports.deleteGuest = async (req, res, next) => {
  try {
    await HospGuest.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};
