const Leave = require('../models/Leave');
const { paged, parsePaging } = require('../../../utils/helpers');
const { tenantFilter } = require('../../../middleware/auth');

const dto = l => ({
  id:              l._id,
  employeeId:      l.employeeId,
  employeeName:    l.employeeName,
  department:      l.department || '',
  designation:     l.designation || '',
  leaveType:       l.leaveType,
  fromDate:        l.startDate || l.fromDate || null,   // frontend expects fromDate
  toDate:          l.endDate   || l.toDate   || null,   // frontend expects toDate
  startDate:       l.startDate || null,
  endDate:         l.endDate   || null,
  days:            l.days || l.totalDays || 0,
  reason:          l.reason || '',
  status:          l.status,
  appliedOn:       l.createdAt || null,                 // frontend expects appliedOn
  approvedBy:      l.approvedBy || null,
  approvedOn:      l.approvedAt || null,
  rejectionReason: l.rejectionReason || null,
  coveringEmployee:l.coveringEmployee || null,
  createdAt:       l.createdAt,
});

exports.summary = async (req, res, next) => {
  try {
    const base  = { ...tenantFilter(req), isDeleted: false };
    const today = new Date().toISOString().split('T')[0];

    const [totalRequests, pending, approved, rejected, onLeaveToday] = await Promise.all([
      Leave.countDocuments(base),
      Leave.countDocuments({ ...base, status: 'pending' }),
      Leave.countDocuments({ ...base, status: 'approved' }),
      Leave.countDocuments({ ...base, status: 'rejected' }),
      Leave.countDocuments({ ...base, status: 'approved', startDate: { $lte: today }, endDate: { $gte: today } }),
    ]);

    const approvedLeaves = await Leave.find({ ...base, status: 'approved' }).select('days');
    const avgLeaveDays   = approvedLeaves.length
      ? Math.round(approvedLeaves.reduce((s, l) => s + (l.days || 0), 0) / approvedLeaves.length * 10) / 10
      : 0;

    return res.json({ totalRequests, pending, approved, rejected, onLeaveToday, avgLeaveDays });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const filter = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ employeeName: re }, { leaveType: re }];
    }
    const [items, total] = await Promise.all([
      Leave.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Leave.countDocuments(filter),
    ]);
    return res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const l = await Leave.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!l) return res.status(404).json({ code: 'Leave.NotFound', description: 'Leave request not found.' });
    return res.json(dto(l));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const days = req.body.days ?? req.body.totalDays ?? 0;
    const leave = await Leave.create({ ...req.body, days, tenantId: req.user.tenant_id });
    return res.status(201).json(dto(leave));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const l = await Leave.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req) },
      { isDeleted: true, updatedAt: new Date() }
    );
    if (!l) return res.status(404).json({ code: 'Leave.NotFound', description: 'Leave request not found.' });
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.approve = async (req, res, next) => {
  try {
    const name = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username;
    const l = await Leave.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), status: 'pending' },
      { status: 'approved', approvedBy: name, approvedAt: new Date(), updatedAt: new Date() }
    );
    if (!l) return res.status(404).json({ code: 'Leave.NotFound', description: 'Leave not found or not pending.' });
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    const l = await Leave.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), status: 'pending' },
      { status: 'rejected', rejectionReason: req.body.reason || null, updatedAt: new Date() }
    );
    if (!l) return res.status(404).json({ code: 'Leave.NotFound', description: 'Leave not found or not pending.' });
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.cancel = async (req, res, next) => {
  try {
    const l = await Leave.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), status: { $in: ['pending', 'approved'] } },
      { status: 'cancelled', updatedAt: new Date() }
    );
    if (!l) return res.status(404).json({ code: 'Leave.NotFound', description: 'Leave not found.' });
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.balances = async (req, res, next) => {
  try { return res.json([]); } catch (err) { next(err); }
};
