const Attendance = require('../models/Attendance');
const Employee   = require('../models/Employee');
const { paged, parsePaging } = require('../../../utils/helpers');
const { tenantFilter } = require('../../../middleware/auth');

const dto = a => ({
  id:           a._id,
  employeeId:   a.employeeId,
  employeeName: a.employeeName,
  department:   a.department || '',
  date:         a.date,
  checkIn:      a.checkIn  || null,
  checkOut:     a.checkOut || null,
  hoursWorked:  a.workingHours || a.hoursWorked || null,  // frontend expects hoursWorked
  status:       a.status,
  note:         a.notes || a.note || null,                // frontend expects note
  createdAt:    a.createdAt,
});

exports.summary = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const base  = { ...tenantFilter(req), isDeleted: false };
    const todayBase = { ...base, date: today };

    const [presentToday, lateToday, absentToday, onLeaveToday, totalEmployees] = await Promise.all([
      Attendance.countDocuments({ ...todayBase, status: 'present' }),
      Attendance.countDocuments({ ...todayBase, status: { $in: ['late', 'half_day'] } }),
      Attendance.countDocuments({ ...todayBase, status: 'absent' }),
      Attendance.countDocuments({ ...todayBase, status: 'on_leave' }),
      Employee.countDocuments({ ...base, status: 'active' }),
    ]);

    // avg hours this month
    const monthStart = new Date().toISOString().slice(0, 7) + '-01';
    const monthRecs  = await Attendance.find({ ...base, date: { $gte: monthStart }, status: 'present' }).select('workingHours');
    const avgHours   = monthRecs.length ? monthRecs.reduce((s, r) => s + (r.workingHours || 8), 0) / monthRecs.length : 0;

    return res.json({
      presentToday,
      lateToday,
      absentToday,
      onLeaveToday,
      avgHoursThisMonth: Math.round(avgHours * 10) / 10,
      totalEmployees,
    });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const filter = { ...tenantFilter(req), isDeleted: false };
    if (req.query.date)       filter.date       = req.query.date;
    if (req.query.dateFrom)   filter.date       = { ...filter.date, $gte: req.query.dateFrom };
    if (req.query.dateTo)     filter.date       = { ...filter.date, $lte: req.query.dateTo };
    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    const [items, total] = await Promise.all([
      Attendance.find(filter).skip(skip).limit(pageSize).sort({ date: -1 }),
      Attendance.countDocuments(filter),
    ]);
    return res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const a = await Attendance.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!a) return res.status(404).json({ code: 'Attendance.NotFound', description: 'Record not found.' });
    return res.json(dto(a));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    // Accept both hoursWorked (frontend) and workingHours (internal)
    const body = { ...req.body, workingHours: req.body.workingHours ?? req.body.hoursWorked, notes: req.body.notes ?? req.body.note };
    const record = await Attendance.create({ ...body, tenantId: req.user.tenant_id });
    return res.status(201).json(dto(record));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const body = { ...req.body, workingHours: req.body.workingHours ?? req.body.hoursWorked, notes: req.body.notes ?? req.body.note };
    const a = await Attendance.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { ...body, updatedAt: new Date() }
    );
    if (!a) return res.status(404).json({ code: 'Attendance.NotFound', description: 'Record not found.' });
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const a = await Attendance.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req) },
      { isDeleted: true, updatedAt: new Date() }
    );
    if (!a) return res.status(404).json({ code: 'Attendance.NotFound', description: 'Record not found.' });
    return res.status(204).send();
  } catch (err) { next(err); }
};
