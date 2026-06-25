const PayrollRun = require('../models/PayrollRun');
const Employee   = require('../models/Employee');
const { paged, parsePaging } = require('../../../utils/helpers');
const { tenantFilter } = require('../../../middleware/auth');

const slipDto = (s, period) => ({
  id:              s._id,
  employeeId:      s.employeeId,
  employeeName:    s.employeeName,
  employeeNumber:  s.employeeNumber || '',
  department:      s.departmentName || '',
  departmentName:  s.departmentName || '',
  designation:     s.jobTitle || '',
  jobTitle:        s.jobTitle || '',
  payPeriod:       period || '',
  basicSalary:     s.basicSalary || 0,
  allowances:      typeof s.allowances === 'number' ? [{ label: 'Allowances', amount: s.allowances }] : (s.allowances || []),
  deductions:      typeof s.deductions === 'number' ? [{ label: 'Deductions', amount: s.deductions }] : (s.deductions || []),
  grossSalary:     (s.basicSalary || 0) + (typeof s.allowances === 'number' ? s.allowances : 0),
  totalDeductions: typeof s.deductions === 'number' ? s.deductions : 0,
  netSalary:       s.netSalary || 0,
  currency:        s.currency || 'AED',
  bank:            s.bank || '',
  iban:            s.iban || '',
  status:          s.emailSentAt ? 'sent' : 'generated',
  paidOn:          s.paidOn || null,
  emailSentAt:     s.emailSentAt || null,
  emailSentTo:     s.emailSentTo || null,
  notes:           s.notes || null,
});

const runDto = (r, includeSlips = false) => {
  const slips = r.slips || [];
  const totalBasicSalary = slips.reduce((s, sl) => s + (sl.basicSalary || 0), 0);
  const totalAllowances  = slips.reduce((s, sl) => s + (typeof sl.allowances === 'number' ? sl.allowances : 0), 0);
  const totalDeductions  = slips.reduce((s, sl) => s + (typeof sl.deductions === 'number' ? sl.deductions : 0), 0);
  const totalNetSalary   = slips.reduce((s, sl) => s + (sl.netSalary || 0), 0);

  return {
    id:               r._id,
    runNumber:        r.runNumber || `PR-${String(r._id).slice(-6).toUpperCase()}`,
    period:           r.period,
    notes:            r.notes || null,
    status:           r.status,
    createdByName:    r.createdByName || null,
    createdAt:        r.createdAt,
    updatedAt:        r.updatedAt,
    rejectionReason:  r.rejectionReason || null,
    rejectedByName:   r.rejectedByName  || null,
    rejectedAt:       r.rejectedAt      || null,
    processedAt:      r.processedAt     || null,
    paidAt:           r.paidAt          || null,
    totalBasicSalary,
    totalAllowances,
    totalDeductions,
    totalNetSalary,
    slipCount:        slips.length,
    ...(includeSlips ? { payslips: slips.map(sl => slipDto(sl, r.period)) } : {}),
  };
};

exports.summary = async (req, res, next) => {
  try {
    const base     = { ...tenantFilter(req), isDeleted: false };
    const allRuns  = await PayrollRun.find(base);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthRun  = allRuns.find(r => r.period === thisMonth && r.status !== 'draft');

    const allTimeDraft     = allRuns.filter(r => r.status === 'draft').length;
    const allTimeProcessed = allRuns.filter(r => r.status === 'processed').length;
    const allTimePaid      = allRuns.filter(r => r.status === 'paid').length;

    return res.json({
      allTime: {
        draft:     allTimeDraft,
        processed: allTimeProcessed,
        paid:      allTimePaid,
        total:     allRuns.length,
      },
      thisMonth: monthRun ? {
        status:         monthRun.status,
        totalNetSalary: monthRun.slips.reduce((s, sl) => s + (sl.netSalary || 0), 0),
        employeeCount:  monthRun.slips.length,
      } : null,
    });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const filter = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.period) filter.period = req.query.period;
    const [items, total] = await Promise.all([
      PayrollRun.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      PayrollRun.countDocuments(filter),
    ]);
    return res.json(paged(items.map(r => runDto(r)), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!run) return res.status(404).json({ code: 'PayrollRun.NotFound', description: 'Payroll run not found.' });
    return res.json(runDto(run, true));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { period, notes, slips } = req.body;
    const tid = req.user.tenant_id;
    const existing = await PayrollRun.findOne({ tenantId: tid, period, status: { $ne: 'draft' } });
    if (existing) return res.status(409).json({ code: 'PayrollRun.Duplicate', description: 'A non-draft payroll run already exists for this period.' });

    const processedSlips = slips.map(s => ({
      ...s,
      netSalary: (s.basicSalary || 0) + (s.allowances || 0) - (s.deductions || 0),
    }));
    const count = await PayrollRun.countDocuments({ tenantId: tid });
    const run = await PayrollRun.create({
      tenantId: tid, period, notes,
      status: 'draft',
      runNumber: `PR-${String(count + 1).padStart(5, '0')}`,
      createdByUserId: req.user.sub,
      createdByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
      slips: processedSlips,
    });
    return res.status(201).json(runDto(run, true));
  } catch (err) { next(err); }
};

exports.generate = async (req, res, next) => {
  try {
    const { period, notes } = req.body;
    const tid = req.user.tenant_id;
    const existing = await PayrollRun.findOne({ tenantId: tid, period, status: { $ne: 'draft' } });
    if (existing) return res.status(409).json({ code: 'PayrollRun.Duplicate', description: 'A non-draft payroll run already exists for this period.' });

    const employees = await Employee.find({ tenantId: tid, isDeleted: false, status: 'active' });
    const slips = employees.map(e => ({
      employeeId:    e._id,
      employeeName:  `${e.firstName} ${e.lastName}`.trim(),
      jobTitle:      e.jobTitle || '',
      departmentName:e.departmentName || '',
      basicSalary:   e.basicSalary || 0,
      allowances:    0,
      deductions:    0,
      netSalary:     e.basicSalary || 0,
    }));
    const count = await PayrollRun.countDocuments({ tenantId: tid });
    const run = await PayrollRun.create({
      tenantId: tid, period, notes, status: 'draft',
      runNumber: `PR-${String(count + 1).padStart(5, '0')}`,
      createdByUserId: req.user.sub,
      createdByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
      slips,
    });
    return res.status(201).json(runDto(run, true));
  } catch (err) { next(err); }
};

exports.process = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!run) return res.status(404).json({ code: 'PayrollRun.NotFound', description: 'Not found.' });
    if (run.status !== 'draft') return res.status(400).json({ code: 'PayrollRun.InvalidStatus', description: 'Only draft payroll runs can be processed.' });
    run.status = 'processed'; run.processedAt = new Date(); run.updatedAt = new Date();
    await run.save();
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.pay = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!run) return res.status(404).json({ code: 'PayrollRun.NotFound', description: 'Not found.' });
    if (run.status !== 'processed') return res.status(400).json({ code: 'PayrollRun.InvalidStatus', description: 'Only processed payroll runs can be marked paid.' });
    run.status = 'paid'; run.paidAt = new Date(); run.updatedAt = new Date();
    await run.save();
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!run) return res.status(404).json({ code: 'PayrollRun.NotFound', description: 'Not found.' });
    if (run.status !== 'draft') return res.status(400).json({ code: 'PayrollRun.InvalidStatus', description: 'Only draft payroll runs can be rejected.' });
    const name = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username;
    run.status = 'rejected';
    run.rejectionReason = req.body.reason || null;
    run.rejectedByName  = name;
    run.rejectedAt      = new Date();
    run.updatedAt       = new Date();
    await run.save();
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.reopen = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!run) return res.status(404).json({ code: 'PayrollRun.NotFound', description: 'Not found.' });
    if (run.status !== 'rejected') return res.status(400).json({ code: 'PayrollRun.InvalidStatus', description: 'Only rejected payroll runs can be reopened.' });
    run.status = 'draft';
    run.rejectionReason = null; run.rejectedByName = null; run.rejectedAt = null;
    run.updatedAt = new Date();
    await run.save();
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!run) return res.status(404).json({ code: 'PayrollRun.NotFound', description: 'Not found.' });
    if (run.status !== 'draft') return res.status(400).json({ code: 'PayrollRun.InvalidStatus', description: 'Only draft payroll runs can be deleted.' });
    run.isDeleted = true; run.updatedAt = new Date();
    await run.save();
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.getSlip = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.runId, ...tenantFilter(req) });
    if (!run) return res.status(404).json({ code: 'PayrollRun.NotFound', description: 'Not found.' });
    const slip = run.slips.id(req.params.slipId);
    if (!slip) return res.status(404).json({ code: 'PayrollSlip.NotFound', description: 'Slip not found.' });
    return res.json(slipDto(slip, run.period));
  } catch (err) { next(err); }
};

exports.updateSlip = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.runId, ...tenantFilter(req) });
    if (!run) return res.status(404).json({ code: 'PayrollRun.NotFound', description: 'Not found.' });
    if (!['draft', 'rejected'].includes(run.status))
      return res.status(400).json({ code: 'PayrollRun.InvalidStatus', description: 'Slips can only be edited on draft or rejected runs.' });
    const slip = run.slips.id(req.params.slipId);
    if (!slip) return res.status(404).json({ code: 'PayrollSlip.NotFound', description: 'Slip not found.' });
    const { allowances, deductions, notes } = req.body;
    slip.allowances = allowances ?? slip.allowances;
    slip.deductions = deductions ?? slip.deductions;
    slip.netSalary  = (slip.basicSalary || 0) + (slip.allowances || 0) - (slip.deductions || 0);
    if (notes !== undefined) slip.notes = notes;
    run.updatedAt = new Date();
    await run.save();
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.sendEmail = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.runId, ...tenantFilter(req) });
    if (!run) return res.status(404).json({ code: 'PayrollRun.NotFound', description: 'Not found.' });
    const slip = run.slips.id(req.params.slipId);
    if (!slip) return res.status(404).json({ code: 'PayrollSlip.NotFound', description: 'Slip not found.' });
    const employee = await Employee.findById(slip.employeeId);
    const sentTo   = employee?.email || 'unknown';
    const sentAt   = new Date();
    slip.emailSentAt = sentAt;
    slip.emailSentTo = sentTo;
    run.updatedAt = new Date();
    await run.save();
    return res.json({ sentTo, sentAt });
  } catch (err) { next(err); }
};
