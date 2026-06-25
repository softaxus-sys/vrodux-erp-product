const PerformanceReview = require('../models/PerformanceReview');
const { tenantFilter } = require('../../../middleware/auth');

const tf  = req => tenantFilter(req);
const tid = req => req.user.tenant_id;
const nf  = () => ({ code: 'PerformanceReview.NotFound', description: 'Performance review not found.' });

exports.summary = async (req, res, next) => {
  try {
    const all = await PerformanceReview.find({ ...tf(req), isDeleted: false });
    res.json({
      total: all.length,
      draft: all.filter(r => r.status === 'draft').length,
      submitted: all.filter(r => r.status === 'submitted').length,
      completed: all.filter(r => r.status === 'completed').length,
      avgScore: all.length ? all.reduce((s, r) => s + r.overallScore, 0) / all.length : 0,
    });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.employeeId) f.employeeId = req.query.employeeId;
    if (req.query.status) f.status = req.query.status;
    res.json(await PerformanceReview.find(f).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const r = await PerformanceReview.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!r) return res.status(404).json(nf());
    res.json(r);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(await PerformanceReview.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const r = await PerformanceReview.findOneAndUpdate({ _id: req.params.id, ...tf(req), isDeleted: false }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf());
    res.json(r);
  } catch (err) { next(err); }
};

exports.submit = async (req, res, next) => {
  try {
    const r = await PerformanceReview.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: 'draft' }, { status: 'submitted', updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf());
    res.json(r);
  } catch (err) { next(err); }
};

exports.acknowledge = async (req, res, next) => {
  try {
    const r = await PerformanceReview.findOneAndUpdate(
      { _id: req.params.id, ...tf(req), status: 'submitted' },
      { status: 'acknowledged', employeeComments: req.body.comments, updatedAt: new Date() },
      { new: true }
    );
    if (!r) return res.status(404).json(nf());
    res.json(r);
  } catch (err) { next(err); }
};

exports.complete = async (req, res, next) => {
  try {
    const r = await PerformanceReview.findOneAndUpdate({ _id: req.params.id, ...tf(req), status: { $in: ['submitted', 'acknowledged'] } }, { status: 'completed', updatedAt: new Date() }, { new: true });
    if (!r) return res.status(404).json(nf());
    res.json(r);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await PerformanceReview.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Goals (sub-resource) ─── */
exports.addGoal = async (req, res, next) => {
  try {
    const r = await PerformanceReview.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!r) return res.status(404).json(nf());
    r.goals.push(req.body);
    r.updatedAt = new Date();
    await r.save();
    res.json(r);
  } catch (err) { next(err); }
};

exports.updateGoal = async (req, res, next) => {
  try {
    const r = await PerformanceReview.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!r) return res.status(404).json(nf());
    const goal = r.goals.id(req.params.goalId);
    if (!goal) return res.status(404).json({ code: 'Goal.NotFound', description: 'Goal not found.' });
    Object.assign(goal, req.body);
    r.updatedAt = new Date();
    await r.save();
    res.json(r);
  } catch (err) { next(err); }
};

exports.removeGoal = async (req, res, next) => {
  try {
    const r = await PerformanceReview.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!r) return res.status(404).json(nf());
    r.goals.pull({ _id: req.params.goalId });
    r.updatedAt = new Date();
    await r.save();
    res.status(204).send();
  } catch (err) { next(err); }
};
