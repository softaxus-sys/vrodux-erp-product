const { ConstrProject, ConstrSite, ConstrContractor, ConstrBOQ, ConstrRFQ, ConstrEstimate, ConstrContract } = require('../models');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

const tf = req => tenantFilter(req);
const tid = req => req.user.tenant_id;

/* ─── Projects ─── */
exports.projectsSummary = async (req, res, next) => {
  try {
    const all = await ConstrProject.find({ ...tf(req), isDeleted: false });
    const statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
    const result = { total: all.length, totalBudget: 0, totalSpent: 0 };
    statuses.forEach(s => { result[s] = all.filter(p => p.status === s).length; });
    result.totalBudget = all.reduce((s, p) => s + (p.budget || 0), 0);
    result.totalSpent  = all.reduce((s, p) => s + (p.spent  || 0), 0);
    res.json(result);
  } catch (err) { next(err); }
};

exports.listProjects = async (req, res, next) => {
  try {
    const items = await ConstrProject.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) { next(err); }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const p = await ConstrProject.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!p) return res.status(404).json({ code: 'ConstrProject.NotFound', description: 'Project not found.' });
    res.json(p);
  } catch (err) { next(err); }
};

exports.createProject = async (req, res, next) => {
  try {
    const p = await ConstrProject.create({ ...req.body, tenantId: tid(req) });
    res.status(201).json(p);
  } catch (err) { next(err); }
};

exports.deleteProject = async (req, res, next) => {
  try {
    await ConstrProject.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── Sites ─── */
exports.sitesSummary = async (req, res, next) => {
  try {
    const all = await ConstrSite.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, active: all.filter(s => s.status === 'active').length, completed: all.filter(s => s.status === 'completed').length, totalWorkers: all.reduce((s, x) => s + (x.workers || 0), 0) });
  } catch (err) { next(err); }
};

exports.listSites = async (req, res, next) => {
  try {
    const items = await ConstrSite.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) { next(err); }
};

exports.createSite = async (req, res, next) => {
  try { res.status(201).json(await ConstrSite.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};

exports.deleteSite = async (req, res, next) => {
  try { await ConstrSite.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true }); res.status(204).send(); } catch (err) { next(err); }
};

/* ─── Contractors ─── */
exports.contractorsSummary = async (req, res, next) => {
  try {
    const all = await ConstrContractor.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, active: all.filter(c => c.status === 'active').length, totalValue: all.reduce((s, c) => s + (c.totalValue || 0), 0) });
  } catch (err) { next(err); }
};

exports.listContractors = async (req, res, next) => {
  try {
    const items = await ConstrContractor.find({ ...tf(req), isDeleted: false }).sort({ name: 1 });
    res.json(items);
  } catch (err) { next(err); }
};

exports.createContractor = async (req, res, next) => {
  try { res.status(201).json(await ConstrContractor.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
};

exports.deleteContractor = async (req, res, next) => {
  try { await ConstrContractor.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true }); res.status(204).send(); } catch (err) { next(err); }
};

/* ─── BOQ ─── */
exports.boqSummary = async (req, res, next) => {
  try {
    const all = await ConstrBOQ.find({ ...tf(req), isDeleted: false });
    res.json({ total: all.length, approved: all.filter(b => b.status === 'approved').length, totalAmount: all.reduce((s, b) => s + (b.totalAmount || 0), 0) });
  } catch (err) { next(err); }
};

exports.listBoqs = async (req, res, next) => {
  try {
    const items = await ConstrBOQ.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) { next(err); }
};

exports.createBoq = async (req, res, next) => {
  try {
    const { lines = [], vatRate = 0, currency = 'AED', ...rest } = req.body;
    const items = lines.map(l => ({
      description: l.description, unit: l.unit, quantity: parseFloat(l.quantity) || 0,
      unitCost: parseFloat(l.unitRate) || 0,
      lineTotal: (parseFloat(l.quantity) || 0) * (parseFloat(l.unitRate) || 0),
    }));
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const totalAmount = subtotal * (1 + (parseFloat(vatRate) || 0) / 100);
    res.status(201).json(await ConstrBOQ.create({ ...rest, items, totalAmount, currency, tenantId: tid(req) }));
  } catch (err) { next(err); }
};

exports.deleteBoq = async (req, res, next) => {
  try { await ConstrBOQ.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true }); res.status(204).send(); } catch (err) { next(err); }
};

/* ─── Bidding: RFQs, Estimates, Contracts ─── */
exports.biddingSummary = async (req, res, next) => {
  try {
    const [rfqs, estimates, contracts] = await Promise.all([
      ConstrRFQ.countDocuments({ ...tf(req), isDeleted: false }),
      ConstrEstimate.countDocuments({ ...tf(req), isDeleted: false }),
      ConstrContract.countDocuments({ ...tf(req), isDeleted: false }),
    ]);
    res.json({ rfqs, estimates, contracts });
  } catch (err) { next(err); }
};

const mkSimpleCrud = (Model, name) => ({
  list: async (req, res, next) => {
    try { res.json(await Model.find({ ...tf(req), isDeleted: false }).sort({ createdAt: -1 })); } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try { res.json(await Model.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); }
  },
  patchStatus: async (req, res, next) => {
    try {
      const item = await Model.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { status: req.body.status, updatedAt: new Date() }, { new: true });
      if (!item) return res.status(404).json({ code: `${name}.NotFound`, description: `${name} not found.` });
      res.json(item);
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      await Model.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
      res.status(204).send();
    } catch (err) { next(err); }
  },
});

exports.rfqs      = mkSimpleCrud(ConstrRFQ, 'RFQ');
exports.estimates = mkSimpleCrud(ConstrEstimate, 'Estimate');
exports.contracts = mkSimpleCrud(ConstrContract, 'Contract');
