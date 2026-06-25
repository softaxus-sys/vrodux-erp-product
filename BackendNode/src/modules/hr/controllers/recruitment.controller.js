const { Job, Applicant } = require('../models/Job');
const { tenantFilter } = require('../../../middleware/auth');

const tf  = req => tenantFilter(req);
const tid = req => req.user.tenant_id;

/* ─── Jobs ─── */
exports.jobsSummary = async (req, res, next) => {
  try {
    const all = await Job.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, published: all.filter(j => j.status === 'published').length, closed: all.filter(j => j.status === 'closed').length, draft: all.filter(j => j.status === 'draft').length });
  } catch (err) { next(err); }
};
exports.listJobs = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    res.json(await Job.find(f).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};
exports.getJobById = async (req, res, next) => {
  try {
    const j = await Job.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!j) return res.status(404).json({ code: 'Job.NotFound', description: 'Job not found.' });
    res.json(j);
  } catch (err) { next(err); }
};
exports.createJob = async (req, res, next) => {
  try { res.status(201).json(await Job.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.updateJob = async (req, res, next) => {
  try {
    const j = await Job.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!j) return res.status(404).json({ code: 'Job.NotFound', description: 'Job not found.' });
    res.json(j);
  } catch (err) { next(err); }
};
exports.publishJob = async (req, res, next) => {
  try {
    const j = await Job.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { status: 'published', postedAt: new Date(), updatedAt: new Date() }, { new: true });
    if (!j) return res.status(404).json({ code: 'Job.NotFound', description: 'Job not found.' });
    res.json(j);
  } catch (err) { next(err); }
};
exports.closeJob = async (req, res, next) => {
  try {
    const j = await Job.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { status: 'closed', updatedAt: new Date() }, { new: true });
    if (!j) return res.status(404).json({ code: 'Job.NotFound', description: 'Job not found.' });
    res.json(j);
  } catch (err) { next(err); }
};
exports.deleteJob = async (req, res, next) => {
  try {
    await Job.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Applicants ─── */
exports.applicantsSummary = async (req, res, next) => {
  try {
    const all = await Applicant.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, applied: all.filter(a => a.stage === 'applied').length, interview: all.filter(a => a.stage === 'interview').length, hired: all.filter(a => a.stage === 'hired').length, rejected: all.filter(a => a.stage === 'rejected').length });
  } catch (err) { next(err); }
};
exports.listApplicants = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.jobId) f.jobId = req.query.jobId;
    if (req.query.stage) f.stage = req.query.stage;
    res.json(await Applicant.find(f).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};
exports.getApplicantById = async (req, res, next) => {
  try {
    const a = await Applicant.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!a) return res.status(404).json({ code: 'Applicant.NotFound', description: 'Applicant not found.' });
    res.json(a);
  } catch (err) { next(err); }
};
exports.createApplicant = async (req, res, next) => {
  try { res.status(201).json(await Applicant.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};
exports.updateApplicantStage = async (req, res, next) => {
  try {
    const a = await Applicant.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { stage: req.body.stage, notes: req.body.notes, updatedAt: new Date() }, { new: true });
    if (!a) return res.status(404).json({ code: 'Applicant.NotFound', description: 'Applicant not found.' });
    res.json(a);
  } catch (err) { next(err); }
};
exports.deleteApplicant = async (req, res, next) => {
  try {
    await Applicant.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};
