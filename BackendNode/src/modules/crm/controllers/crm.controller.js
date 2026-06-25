const Lead     = require('../models/Lead');
const Contact  = require('../models/Contact');
const Deal     = require('../models/Deal');
const Activity = require('../models/Activity');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

const crudFor = (Model, name, dtoFn) => ({
  list: async (req, res, next) => {
    try {
      const { page, pageSize, skip } = parsePaging(req.query);
      const f = { ...tenantFilter(req), isDeleted: false };
      if (req.query.status) f.status = req.query.status;
      if (req.query.stage) f.stage = req.query.stage;
      if (req.query.search) f.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { title: { $regex: req.query.search, $options: 'i' } },
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { subject: { $regex: req.query.search, $options: 'i' } },
      ];
      const [items, total] = await Promise.all([
        Model.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
        Model.countDocuments(f),
      ]);
      res.json(paged(items.map(dtoFn), total, page, pageSize));
    } catch (err) { next(err); }
  },
  getById: async (req, res, next) => {
    try {
      const item = await Model.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
      if (!item) return res.status(404).json({ code: `${name}.NotFound`, description: `${name} not found.` });
      res.json(dtoFn(item));
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      const item = await Model.create({ ...req.body, tenantId: req.user.tenant_id });
      res.status(201).json(dtoFn(item));
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      const item = await Model.findOneAndUpdate(
        { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
        { ...req.body, updatedAt: new Date() }, { new: true }
      );
      if (!item) return res.status(404).json({ code: `${name}.NotFound`, description: `${name} not found.` });
      res.json(dtoFn(item));
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      await Model.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
      res.status(204).send();
    } catch (err) { next(err); }
  },
});

const leadDto    = l => {
  // Frontend expects firstName/lastName/fullName — some seeds may have 'name' only
  const nameParts = (l.name || '').split(' ');
  const firstName = l.firstName || nameParts[0] || '';
  const lastName  = l.lastName  || nameParts.slice(1).join(' ') || '';
  return {
    id:          l._id,
    firstName,
    lastName,
    fullName:    l.fullName || l.name || `${firstName} ${lastName}`.trim(),
    name:        l.fullName || l.name || `${firstName} ${lastName}`.trim(),
    title:       l.title || '',
    company:     l.company || '',
    industry:    l.industry || '',
    email:       l.email || '',
    phone:       l.phone || '',
    country:     l.country || '',
    city:        l.city || '',
    source:      l.source || '',
    status:      l.status || 'new',
    priority:    l.priority || 'medium',
    assignedTo:  l.assignedTo || '',
    notes:       l.notes || '',
    tags:        l.tags || [],
    activities:  (l.activities || []).map(a => ({ id: a._id, type: a.type, title: a.subject || '', description: a.description || '', date: a.dueDate || a.createdAt, by: a.assignedTo || '' })),
    createdAt:   l.createdAt,
    updatedAt:   l.updatedAt || null,
  };
};
const contactDto = c => ({
  id:         c._id,
  firstName:  c.firstName || '',
  lastName:   c.lastName  || '',
  fullName:   `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || '',
  email:      c.email || '',
  phone:      c.phone || '',
  mobile:     c.mobile || c.phone || '',
  company:    c.company || '',
  jobTitle:   c.jobTitle || '',
  customerId: c.customerId || null,
  status:     c.status || 'active',
  createdAt:  c.createdAt,
});
const dealDto    = d => ({
  id:               d._id,
  title:            d.title || '',
  company:          d.company || d.customerName || '',
  customerId:       d.customerId || null,
  customerName:     d.customerName || '',
  value:            d.value || 0,
  currency:         d.currency || 'AED',
  stage:            d.stage || 'lead',
  priority:         d.priority || 'medium',
  probability:      d.probability || 0,
  expectedCloseDate:d.expectedClose || d.expectedCloseDate || null,
  createdDate:      d.createdAt,
  assignedTo:       d.assignedTo || '',
  source:           d.source || '',
  industry:         d.industry || '',
  description:      d.notes || d.description || '',
  tags:             d.tags || [],
  contact:          d.contact || { name: '', title: '', email: '', phone: '' },
  activities:       (d.activities || []).map(a => ({ id: a._id, type: a.type, title: a.subject || '', description: a.description || '', date: a.dueDate || a.createdAt, by: a.assignedTo || '' })),
  nextAction:       d.nextAction || null,
  nextActionDate:   d.nextActionDate || null,
  createdAt:        d.createdAt,
});
const actDto = a => ({
  id:             a._id,
  type:           a.type,
  subject:        a.subject || a.title || '',
  description:    a.description || null,
  relatedToType:  a.relatedType || a.relatedToType || 'lead',
  relatedToId:    a.relatedId   || a.relatedToId   || '',
  relatedToName:  a.relatedName || null,
  dueDate:        a.dueDate || null,
  completed:      a.status === 'completed',
  completedAt:    a.completedAt || null,
  assignedTo:     a.assignedTo || '',
  createdAt:      a.createdAt,
  updatedAt:      a.updatedAt || null,
});

const customerDto = c => ({
  id:             c._id,
  name:           c.name || '',
  tradeName:      c.tradeName || null,
  industry:       c.industry || '',
  website:        c.website || null,
  country:        c.country || '',
  city:           c.city || '',
  address:        c.address || '',
  phone:          c.phone || '',
  email:          c.email || '',
  status:         c.status || 'active',
  tier:           c.tier || 'standard',
  accountManager: c.accountManager || '',
  since:          c.since || c.createdAt,
  lastActivity:   c.lastActivity || null,
  totalRevenue:   c.totalRevenue || 0,
  openDeals:      c.openDeals || 0,
  currency:       c.currency || 'AED',
  employees:      c.employees || null,
  description:    c.description || '',
  contacts:       c.contacts || [],
  deals:          c.deals || [],
  activities:     (c.activities || []).map(a => ({ id: a._id, type: a.type, title: a.subject || '', description: a.description || '', date: a.dueDate || a.createdAt, by: a.assignedTo || '' })),
  tags:           c.tags || [],
  contractRenewal:c.contractRenewal || null,
  npsScore:       c.npsScore || null,
  createdAt:      c.createdAt,
});

// Extended ops
const leadOps = {
  ...crudFor(Lead, 'Lead', leadDto),
  patchStatus: async (req, res, next) => {
    try {
      const l = await Lead.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { status: req.body.status, updatedAt: new Date() }, { new: true });
      if (!l) return res.status(404).json({ code: 'Lead.NotFound', description: 'Lead not found.' });
      res.json(leadDto(l));
    } catch (err) { next(err); }
  },
  patchScore: async (req, res, next) => {
    try {
      const l = await Lead.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { score: req.body.score, updatedAt: new Date() }, { new: true });
      if (!l) return res.status(404).json({ code: 'Lead.NotFound', description: 'Lead not found.' });
      res.json(leadDto(l));
    } catch (err) { next(err); }
  },
  convert: async (req, res, next) => {
    try {
      const l = await Lead.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { status: 'converted', updatedAt: new Date() }, { new: true });
      if (!l) return res.status(404).json({ code: 'Lead.NotFound', description: 'Lead not found.' });
      res.json({ customerId: null, dealId: null, message: 'Lead converted.' });
    } catch (err) { next(err); }
  },
  summary: async (req, res, next) => {
    try {
      const f    = { ...tenantFilter(req), isDeleted: false };
      const all  = await Lead.find(f);
      const now  = new Date();
      const weekAgo = new Date(now - 7 * 24 * 3600000).toISOString();
      res.json({
        total:               all.length,
        newThisWeek:         all.filter(l => l.createdAt >= weekAgo).length,
        qualified:           all.filter(l => l.status === 'qualified').length,
        contacted:           all.filter(l => l.status === 'contacted').length,
        converted:           all.filter(l => l.status === 'converted').length,
        conversionRate:      all.length ? Math.round(all.filter(l => l.status === 'converted').length / all.length * 100) : 0,
        totalEstimatedValue: all.reduce((s, l) => s + (l.estimatedValue || 0), 0),
      });
    } catch (err) { next(err); }
  },
};

const dealOps = {
  ...crudFor(Deal, 'Deal', dealDto),
  patchStage: async (req, res, next) => {
    try {
      const d = await Deal.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { stage: req.body.stage, probability: req.body.probability, updatedAt: new Date() }, { new: true });
      if (!d) return res.status(404).json({ code: 'Deal.NotFound', description: 'Deal not found.' });
      res.json(dealDto(d));
    } catch (err) { next(err); }
  },
  summary: async (req, res, next) => {
    try {
      const all   = await Deal.find({ ...tenantFilter(req), isDeleted: false });
      const won   = all.filter(d => d.stage === 'won');
      const total = all.reduce((s, d) => s + (d.value || 0), 0);
      res.json({
        totalDeals:  all.length,
        totalValue:  total,
        wonValue:    won.reduce((s, d) => s + (d.value || 0), 0),
        lostDeals:   all.filter(d => d.stage === 'lost').length,
        avgDealSize: all.length ? Math.round(total / all.length) : 0,
        winRate:     all.length ? Math.round(won.length / all.length * 100) : 0,
      });
    } catch (err) { next(err); }
  },
};

const customerOps = {
  ...crudFor(Contact, 'Customer', customerDto),
  summary: async (req, res, next) => {
    try {
      const all = await Contact.find({ ...tenantFilter(req), isDeleted: false });
      res.json({
        total:        all.length,
        active:       all.filter(c => c.status === 'active').length,
        inactive:     all.filter(c => c.status !== 'active').length,
        platinum:     all.filter(c => c.tier === 'platinum').length,
        gold:         all.filter(c => c.tier === 'gold').length,
        totalRevenue: all.reduce((s, c) => s + (c.totalRevenue || 0), 0),
        openDeals:    all.reduce((s, c) => s + (c.openDeals || 0), 0),
        avgNps:       0,
      });
    } catch (err) { next(err); }
  },
};

const actOps = {
  ...crudFor(Activity, 'Activity', actDto),
  summary: async (req, res, next) => {
    try {
      const f   = { ...tenantFilter(req), isDeleted: false };
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const all = await Activity.find(f);
      res.json({
        openTasks: all.filter(a => a.status !== 'completed').length,
        overdue:   all.filter(a => a.status !== 'completed' && a.dueDate < now).length,
        dueToday:  all.filter(a => a.status !== 'completed' && (a.dueDate || '').startsWith(today)).length,
        upcoming:  all.filter(a => a.status !== 'completed' && a.dueDate > now).length,
      });
    } catch (err) { next(err); }
  },
  complete: async (req, res, next) => {
    try {
      await Activity.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { status: 'completed', completedAt: new Date(), updatedAt: new Date() });
      res.status(204).send();
    } catch (err) { next(err); }
  },
  reopen: async (req, res, next) => {
    try {
      await Activity.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { status: 'open', completedAt: null, updatedAt: new Date() });
      res.status(204).send();
    } catch (err) { next(err); }
  },
};

module.exports = {
  leads:      leadOps,
  contacts:   crudFor(Contact, 'Contact', contactDto),
  customers:  customerOps,
  deals:      dealOps,
  activities: actOps,
};
