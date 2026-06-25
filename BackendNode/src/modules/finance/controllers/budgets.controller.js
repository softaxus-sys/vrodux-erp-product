const Budget = require('../models/Budget');
const { tenantFilter } = require('../../../middleware/auth');

// Frontend expects: totalBudgeted (not totalBudget), variance, lineCount
const dto = b => {
  const lines       = b.lines || [];
  const totalBudgeted = b.totalBudget || lines.reduce((s, l) => s + (l.budgeted || 0), 0);
  const totalActual   = b.totalActual || lines.reduce((s, l) => s + (l.actual || 0), 0);
  return {
    id:            b._id,
    name:          b.name,
    period:        b.period,
    startDate:     b.startDate || null,
    endDate:       b.endDate   || null,
    status:        b.status,
    totalBudgeted,
    totalActual,
    variance:      totalBudgeted - totalActual,
    lineCount:     lines.length,
    notes:         b.notes || null,
    lines,
    createdAt:     b.createdAt,
    updatedAt:     b.updatedAt || null,
  };
};

exports.summary = async (req, res, next) => {
  try {
    const all = await Budget.find({ ...tenantFilter(req), isDeleted: false });
    const totalBudget = all.reduce((s, b) => s + (b.totalBudget || 0), 0);
    const totalActual = all.reduce((s, b) => s + (b.totalActual || 0), 0);
    const overallVariance = totalBudget - totalActual;
    const depsOverBudget  = all.filter(b => (b.totalActual || 0) > (b.totalBudget || 0)).length;
    const depsUnderBudget = all.filter(b => (b.totalActual || 0) <= (b.totalBudget || 0)).length;
    const utilisation     = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
    const variancePct     = totalBudget > 0 ? Math.round((overallVariance / totalBudget) * 100) : 0;
    res.json({ totalBudget, totalActual, overallVariance, variancePct, depsOverBudget, depsUnderBudget, utilisation });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    const items = await Budget.find(f).sort({ createdAt: -1 });
    res.json(items.map(dto));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const b = await Budget.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'Budget.NotFound', description: 'Budget not found.' });
    res.json(dto(b));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { lines = [], ...rest } = req.body;
    const totalBudget = lines.reduce((s, l) => s + (l.budgeted || 0), 0);
    const b = await Budget.create({ ...rest, lines, totalBudget, tenantId: req.user.tenant_id });
    res.status(201).json(dto(b));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { lines, ...rest } = req.body;
    const upd = { ...rest, updatedAt: new Date() };
    if (lines) { upd.lines = lines; upd.totalBudget = lines.reduce((s, l) => s + (l.budgeted || 0), 0); }
    const b = await Budget.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, upd, { new: true });
    if (!b) return res.status(404).json({ code: 'Budget.NotFound', description: 'Budget not found.' });
    res.json(dto(b));
  } catch (err) { next(err); }
};

exports.changeStatus = async (req, res, next) => {
  try {
    const b = await Budget.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, { status: req.body.status, updatedAt: new Date() }, { new: true });
    if (!b) return res.status(404).json({ code: 'Budget.NotFound', description: 'Budget not found.' });
    res.json(b);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Budget.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};
