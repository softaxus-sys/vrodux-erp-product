const { AuditLog, Branch, AppSetting } = require('../models/IdentityExtensions');
const Tenant = require('../models/Tenant');
const User   = require('../models/User');
const { tenantFilter } = require('../../../middleware/auth');

const tf  = req => tenantFilter(req);
const tid = req => req.user.tenant_id;

/* ─── Audit Logs ─── */
exports.listAuditLogs = async (req, res, next) => {
  try {
    const f = { ...tf(req) };
    if (req.query.userId) f.userId = req.query.userId;
    if (req.query.resource) f.resource = req.query.resource;
    const logs = await AuditLog.find(f).sort({ createdAt: -1 }).limit(parseInt(req.query.limit) || 200);
    res.json(logs);
  } catch (err) { next(err); }
};

/* ─── Branches ─── */
exports.listBranches = async (req, res, next) => {
  try { res.json(await Branch.find({ ...tf(req), isDeleted: false }).sort({ name: 1 })); } catch (err) { next(err); }
};
exports.getBranchById = async (req, res, next) => {
  try {
    const b = await Branch.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'Branch.NotFound', description: 'Branch not found.' });
    res.json(b);
  } catch (err) { next(err); }
};
exports.createBranch = async (req, res, next) => {
  try {
    if (req.body.isDefault) await Branch.updateMany({ tenantId: tid(req) }, { isDefault: false });
    res.status(201).json(await Branch.create({ ...req.body, tenantId: tid(req) }));
  } catch (err) { next(err); }
};
exports.updateBranch = async (req, res, next) => {
  try {
    if (req.body.isDefault) await Branch.updateMany({ tenantId: tid(req) }, { isDefault: false });
    const b = await Branch.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, req.body, { new: true });
    if (!b) return res.status(404).json({ code: 'Branch.NotFound', description: 'Branch not found.' });
    res.json(b);
  } catch (err) { next(err); }
};
exports.deleteBranch = async (req, res, next) => {
  try {
    await Branch.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

/* ─── App Settings ─── */
exports.getSettings = async (req, res, next) => {
  try {
    const f = { tenantId: tid(req), $or: [{ scope: 'tenant', userId: null }, { scope: 'user', userId: req.user.sub }] };
    const settings = await AppSetting.find(f);
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (err) { next(err); }
};
exports.upsertSetting = async (req, res, next) => {
  try {
    const { key, value, scope } = req.body;
    const filter = { tenantId: tid(req), key, scope: scope || 'user', userId: (scope === 'tenant' ? null : req.user.sub) };
    const s = await AppSetting.findOneAndUpdate(filter, { value, updatedAt: new Date() }, { upsert: true, new: true });
    res.json(s);
  } catch (err) { next(err); }
};

/* ─── App Settings — /api/app-settings/:category (frontend shape) ─── */
// Category is stored as the key prefix: "appearance.theme", "regional.currency", etc.
// Frontend sends/receives a flat object of key→value pairs per category.

exports.getAllAppSettings = async (req, res, next) => {
  try {
    const docs = await AppSetting.find({ tenantId: tid(req), scope: 'tenant', userId: null });
    const result = {};
    docs.forEach(s => {
      const [cat, ...rest] = s.key.split('.');
      if (!result[cat]) result[cat] = {};
      result[cat][rest.join('.')] = s.value;
    });
    res.json(result);
  } catch (err) { next(err); }
};

exports.getAppSettingsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const docs = await AppSetting.find({ tenantId: tid(req), scope: 'tenant', userId: null, key: new RegExp(`^${category}\\.`) });
    const result = {};
    docs.forEach(s => {
      const subKey = s.key.slice(category.length + 1);
      result[subKey] = s.value;
    });
    res.json(result);
  } catch (err) { next(err); }
};

exports.upsertAppSettingsCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const entries = Object.entries(req.body || {});
    await Promise.all(entries.map(([subKey, value]) => {
      const key = `${category}.${subKey}`;
      const filter = { tenantId: tid(req), key, scope: 'tenant', userId: null };
      return AppSetting.findOneAndUpdate(filter, { value, updatedAt: new Date() }, { upsert: true, new: true });
    }));
    res.json(req.body);
  } catch (err) { next(err); }
};

exports.upsertAllAppSettings = async (req, res, next) => {
  try {
    const categories = req.body || {};
    const ops = [];
    for (const [category, values] of Object.entries(categories)) {
      for (const [subKey, value] of Object.entries(values || {})) {
        const key = `${category}.${subKey}`;
        const filter = { tenantId: tid(req), key, scope: 'tenant', userId: null };
        ops.push(AppSetting.findOneAndUpdate(filter, { value, updatedAt: new Date() }, { upsert: true, new: true }));
      }
    }
    await Promise.all(ops);
    res.json(categories);
  } catch (err) { next(err); }
};

/* ─── License ─── */
exports.getLicense = (req, res) => {
  res.json({ plan: 'enterprise', status: 'active', expiresAt: null, features: ['all'] });
};
exports.heartbeat = (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
};

/* ─── Trial ─── */
exports.trialChallenge = (req, res) => {
  const nonce = require('crypto').randomBytes(16).toString('hex');
  res.json({ nonce, expiresIn: 300 });
};

/* ─── Tenants Admin (super admin only) ─── */
exports.listTenants = async (req, res, next) => {
  try {
    if (req.user.is_super_admin !== 'true') return res.status(403).json({ code: 'Permission.Denied', description: 'Super admin only.' });
    res.json(await Tenant.find({}).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};
exports.getTenantById = async (req, res, next) => {
  try {
    if (req.user.is_super_admin !== 'true') return res.status(403).json({ code: 'Permission.Denied', description: 'Super admin only.' });
    const t = await Tenant.findById(req.params.id);
    if (!t) return res.status(404).json({ code: 'Tenant.NotFound', description: 'Tenant not found.' });
    res.json(t);
  } catch (err) { next(err); }
};
exports.updateTenant = async (req, res, next) => {
  try {
    if (req.user.is_super_admin !== 'true') return res.status(403).json({ code: 'Permission.Denied', description: 'Super admin only.' });
    const t = await Tenant.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!t) return res.status(404).json({ code: 'Tenant.NotFound', description: 'Tenant not found.' });
    res.json(t);
  } catch (err) { next(err); }
};
exports.suspendTenant = async (req, res, next) => {
  try {
    if (req.user.is_super_admin !== 'true') return res.status(403).json({ code: 'Permission.Denied', description: 'Super admin only.' });
    const t = await Tenant.findByIdAndUpdate(req.params.id, { status: 'suspended' }, { new: true });
    if (!t) return res.status(404).json({ code: 'Tenant.NotFound', description: 'Tenant not found.' });
    res.json(t);
  } catch (err) { next(err); }
};
exports.activateTenant = async (req, res, next) => {
  try {
    if (req.user.is_super_admin !== 'true') return res.status(403).json({ code: 'Permission.Denied', description: 'Super admin only.' });
    const t = await Tenant.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
    if (!t) return res.status(404).json({ code: 'Tenant.NotFound', description: 'Tenant not found.' });
    res.json(t);
  } catch (err) { next(err); }
};
exports.getTenantStats = async (req, res, next) => {
  try {
    if (req.user.is_super_admin !== 'true') return res.status(403).json({ code: 'Permission.Denied', description: 'Super admin only.' });
    const [total, active, trial] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ status: 'active' }),
      Tenant.countDocuments({ status: 'trial' }),
    ]);
    res.json({ total, active, trial, suspended: total - active - trial });
  } catch (err) { next(err); }
};
