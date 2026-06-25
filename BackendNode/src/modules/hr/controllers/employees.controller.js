const Employee   = require('../models/Employee');
const Department = require('../models/Department');
const { paged, parsePaging } = require('../../../utils/helpers');
const { tenantFilter } = require('../../../middleware/auth');

const dto = e => ({
  id:                 e._id,
  employeeId:         e.employeeNumber,
  employeeNumber:     e.employeeNumber,
  firstName:          e.firstName,
  lastName:           e.lastName,
  fullName:           `${e.firstName} ${e.lastName}`.trim(),
  avatar:             e.imageUrl || e.avatar || null,
  email:              e.email,
  phone:              e.phone || '',
  mobile:             e.mobile || e.phone || '',
  gender:             e.gender || 'male',
  nationality:        e.nationality || '',
  dateOfBirth:        e.dateOfBirth || null,
  department:         e.departmentName || '',
  departmentName:     e.departmentName || '',
  designation:        e.jobTitle || '',
  jobTitle:           e.jobTitle || '',
  reportingTo:        e.reportingTo || '',
  branch:             e.branch || '',
  contractType:       e.employmentType || 'full_time',
  employmentType:     e.employmentType || 'full_time',
  status:             e.status || 'active',
  joinDate:           e.joiningDate || null,
  joiningDate:        e.joiningDate || null,
  endDate:            e.terminationDate || null,
  terminationDate:    e.terminationDate || null,
  basicSalary:        e.basicSalary || 0,
  currency:           e.currency || 'AED',
  bankAccount:        e.bankAccount || null,
  iban:               e.iban || null,
  emiratesId:         e.emiratesId || null,
  passportNumber:     e.passportNumber || '',
  visaExpiry:         e.visaExpiry || null,
  medicalInsurance:   e.medicalInsurance || null,
  annualLeaveBalance: e.annualLeaveBalance || 0,
  sickLeaveBalance:   e.sickLeaveBalance || 0,
  skills:             e.skills || [],
  address:            e.address || '',
  emergencyContact:   e.emergencyContact || { name: '', relation: '', phone: '' },
  documents:          e.documents || [],
  notes:              e.notes || '',
  createdAt:          e.createdAt,
  updatedAt:          e.updatedAt,
});

exports.summary = async (req, res, next) => {
  try {
    const base = { ...tenantFilter(req), isDeleted: false };
    const now  = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const [total, active, onLeave, probation, deptCount, newThisMonth] = await Promise.all([
      Employee.countDocuments(base),
      Employee.countDocuments({ ...base, status: 'active' }),
      Employee.countDocuments({ ...base, status: 'on_leave' }),
      Employee.countDocuments({ ...base, status: 'probation' }),
      Department.countDocuments({ ...tenantFilter(req), isActive: true }),
      Employee.countDocuments({ ...base, joiningDate: { $gte: monthStart } }),
    ]);

    return res.json({
      total,
      active,
      onLeave,
      probation,
      newThisMonth,
      expiringDocuments: 0,   // placeholder — no doc-expiry logic yet
      departments: deptCount,
    });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const filter = { ...tenantFilter(req), isDeleted: false };
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { employeeNumber: re }];
    }
    if (req.query.status)         filter.status         = req.query.status;
    if (req.query.employmentType) filter.employmentType = req.query.employmentType;
    if (req.query.departmentId)   filter.departmentId   = req.query.departmentId;

    const [items, total] = await Promise.all([
      Employee.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Employee.countDocuments(filter),
    ]);
    return res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

// /employees/all — full dto (used by payroll form, attendance modal, etc.)
exports.all = async (req, res, next) => {
  try {
    const items = await Employee.find({ ...tenantFilter(req), isDeleted: false, status: 'active' })
      .sort({ firstName: 1 });
    return res.json(items.map(dto));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const e = await Employee.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!e) return res.status(404).json({ code: 'Employee.NotFound', description: 'Employee not found.' });
    return res.json(dto(e));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const tid   = req.user.tenant_id;
    const count = await Employee.countDocuments({ tenantId: tid });
    const employeeNumber = `EMP-${String(count + 1).padStart(4, '0')}`;
    const employee = await Employee.create({ ...req.body, tenantId: tid, employeeNumber });
    return res.status(201).json(dto(employee));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const e = await Employee.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!e) return res.status(404).json({ code: 'Employee.NotFound', description: 'Employee not found.' });
    return res.json(dto(e));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const e = await Employee.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req) },
      { isDeleted: true, updatedAt: new Date() }
    );
    if (!e) return res.status(404).json({ code: 'Employee.NotFound', description: 'Employee not found.' });
    return res.status(204).send();
  } catch (err) { next(err); }
};
