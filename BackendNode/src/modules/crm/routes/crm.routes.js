const router = require('express').Router();
const crm    = require('../controllers/crm.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

// Leads
router.get('/leads/summary',              crm.leads.summary);
router.get('/leads',                      crm.leads.list);
router.get('/leads/:id',                  crm.leads.getById);
router.post('/leads',                     crm.leads.create);
router.put('/leads/:id',                  crm.leads.update);
router.patch('/leads/:id/status',         crm.leads.patchStatus);
router.patch('/leads/:id/score',          crm.leads.patchScore);
router.post('/leads/:id/convert',         crm.leads.convert);
router.delete('/leads/:id',               crm.leads.remove);

// Contacts
router.get('/contacts',                   crm.contacts.list);
router.get('/contacts/:id',               crm.contacts.getById);
router.post('/contacts',                  crm.contacts.create);
router.put('/contacts/:id',               crm.contacts.update);
router.post('/contacts/:id/primary',      (req, res) => res.status(204).send());
router.delete('/contacts/:id',            crm.contacts.remove);

// Deals / Pipeline
router.get('/deals/summary',              crm.deals.summary);
router.get('/deals',                      crm.deals.list);
router.get('/deals/:id',                  crm.deals.getById);
router.post('/deals',                     crm.deals.create);
router.put('/deals/:id',                  crm.deals.update);
router.patch('/deals/:id/stage',          crm.deals.patchStage);
router.delete('/deals/:id',               crm.deals.remove);

// Customers (CRM)
router.get('/customers/summary',          crm.customers.summary);
router.get('/customers',                  crm.customers.list);
router.get('/customers/:id',              crm.customers.getById);
router.post('/customers',                 crm.customers.create);
router.put('/customers/:id',              crm.customers.update);
router.delete('/customers/:id',           crm.customers.remove);

// Activities
router.get('/activities/summary',         crm.activities.summary);
router.get('/activities',                 crm.activities.list);
router.get('/activities/:id',             crm.activities.getById);
router.post('/activities',                crm.activities.create);
router.put('/activities/:id',             crm.activities.update);
router.post('/activities/:id/complete',   crm.activities.complete);
router.post('/activities/:id/reopen',     crm.activities.reopen);
router.delete('/activities/:id',          crm.activities.remove);

// CRM Dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const { Lead, Contact, Deal, Activity } = require('../models');
    const tf = req => require('../../../middleware/auth').tenantFilter(req);
    const [leads, contacts, deals, activities] = await Promise.all([
      Lead.countDocuments({ ...tf(req), isDeleted: false }),
      Contact.countDocuments({ ...tf(req), isDeleted: false }),
      Deal.find({ ...tf(req), isDeleted: false }),
      Activity.countDocuments({ ...tf(req), isDeleted: false }),
    ]);
    res.json({
      leads, contacts, activities,
      deals: { total: deals.length, open: deals.filter(d => !['closed-won','closed-lost'].includes(d.stage)).length, won: deals.filter(d => d.stage === 'closed-won').length, lost: deals.filter(d => d.stage === 'closed-lost').length, totalValue: deals.reduce((s, d) => s + (d.value || 0), 0) },
    });
  } catch (err) { next(err); }
});

// B2B
const ext = require('../models/CrmExtensions');
const tf2 = req => require('../../../middleware/auth').tenantFilter(req);
const tid = req => req.user.tenant_id;

const mkCrud = (Model, name) => ({
  list:    async (req, res, next) => { try { res.json(await Model.find({ ...tf2(req), isDeleted: false }).sort({ createdAt: -1 })); } catch (err) { next(err); } },
  create:  async (req, res, next) => { try { res.status(201).json(await Model.create({ ...req.body, tenantId: tid(req) })); } catch (err) { next(err); } },
  update:  async (req, res, next) => { try { const d = await Model.findOneAndUpdate({ _id: req.params.id, ...tf2(req) }, { ...req.body, updatedAt: new Date() }, { new: true }); if (!d) return res.status(404).json({ code: `${name}.NotFound`, description: `${name} not found.` }); res.json(d); } catch (err) { next(err); } },
  patchStatus: async (req, res, next) => { try { const d = await Model.findOneAndUpdate({ _id: req.params.id, ...tf2(req) }, { status: req.body.status, updatedAt: new Date() }, { new: true }); if (!d) return res.status(404).json({ code: `${name}.NotFound`, description: `${name} not found.` }); res.json(d); } catch (err) { next(err); } },
  remove:  async (req, res, next) => { try { await Model.findOneAndUpdate({ _id: req.params.id, ...tf2(req) }, { isDeleted: true }); res.status(204).send(); } catch (err) { next(err); } },
});

const proposals = mkCrud(ext.CrmProposal, 'CrmProposal');
router.get('/b2b/proposals',              proposals.list);
router.post('/b2b/proposals',             proposals.create);
router.put('/b2b/proposals/:id',          proposals.update);
router.patch('/b2b/proposals/:id/status', proposals.patchStatus);
router.delete('/b2b/proposals/:id',       proposals.remove);

const contracts = mkCrud(ext.CrmB2BContract, 'CrmB2BContract');
router.get('/b2b/contracts',              contracts.list);
router.post('/b2b/contracts',             contracts.create);
router.put('/b2b/contracts/:id',          contracts.update);
router.patch('/b2b/contracts/:id/status', contracts.patchStatus);
router.delete('/b2b/contracts/:id',       contracts.remove);

const tickets = mkCrud(ext.SupportTicket, 'SupportTicket');
router.get('/support/tickets',              tickets.list);
router.post('/support/tickets',             tickets.create);
router.put('/support/tickets/:id',          tickets.update);
router.patch('/support/tickets/:id/status', tickets.patchStatus);
router.delete('/support/tickets/:id',       tickets.remove);

// Education
const students = mkCrud(ext.EduStudent, 'EduStudent');
router.get('/education/students',            students.list);
router.post('/education/students',           students.create);
router.put('/education/students/:id',        students.update);
router.delete('/education/students/:id',     students.remove);

const admissions = mkCrud(ext.EduAdmission, 'EduAdmission');
router.get('/education/admissions',              admissions.list);
router.post('/education/admissions',             admissions.create);
router.patch('/education/admissions/:id/status', admissions.patchStatus);
router.delete('/education/admissions/:id',       admissions.remove);

const enrollments = mkCrud(ext.EduEnrollment, 'EduEnrollment');
router.get('/education/enrollments',         enrollments.list);
router.post('/education/enrollments',        enrollments.create);
router.put('/education/enrollments/:id',     enrollments.update);
router.delete('/education/enrollments/:id',  enrollments.remove);

// Healthcare
const patients = mkCrud(ext.HealthPatient, 'HealthPatient');
router.get('/healthcare/patients',           patients.list);
router.post('/healthcare/patients',          patients.create);
router.put('/healthcare/patients/:id',       patients.update);
router.delete('/healthcare/patients/:id',    patients.remove);

const appointments = mkCrud(ext.HealthAppointment, 'HealthAppointment');
router.get('/healthcare/appointments',             appointments.list);
router.post('/healthcare/appointments',            appointments.create);
router.patch('/healthcare/appointments/:id/status',appointments.patchStatus);
router.delete('/healthcare/appointments/:id',      appointments.remove);

const treatments = mkCrud(ext.HealthTreatment, 'HealthTreatment');
router.get('/healthcare/treatment-plans',           treatments.list);
router.post('/healthcare/treatment-plans',          treatments.create);
router.put('/healthcare/treatment-plans/:id',       treatments.update);
router.delete('/healthcare/treatment-plans/:id',    treatments.remove);

// Insurance
const policies = mkCrud(ext.InsPolicy, 'InsPolicy');
router.get('/insurance/policies',            policies.list);
router.post('/insurance/policies',           policies.create);
router.put('/insurance/policies/:id',        policies.update);
router.patch('/insurance/policies/:id/status',policies.patchStatus);
router.delete('/insurance/policies/:id',     policies.remove);

const claims = mkCrud(ext.InsClaim, 'InsClaim');
router.get('/insurance/claims',              claims.list);
router.post('/insurance/claims',             claims.create);
router.patch('/insurance/claims/:id/status', claims.patchStatus);
router.delete('/insurance/claims/:id',       claims.remove);

module.exports = router;
