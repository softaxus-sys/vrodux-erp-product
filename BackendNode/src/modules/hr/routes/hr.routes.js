const router  = require('express').Router();
const empCtrl  = require('../controllers/employees.controller');
const payCtrl  = require('../controllers/payroll.controller');
const attCtrl  = require('../controllers/attendance.controller');
const lvCtrl   = require('../controllers/leaves.controller');
const deptCtrl = require('../controllers/departments.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

// Employees
router.get('/employees/summary',         empCtrl.summary);
router.get('/employees/all',             empCtrl.all);
router.get('/employees',                 empCtrl.list);
router.get('/employees/:id',             empCtrl.getById);
router.post('/employees',                empCtrl.create);
router.put('/employees/:id',             empCtrl.update);
router.delete('/employees/:id',          empCtrl.remove);

// Payroll
router.get('/payroll/summary',              payCtrl.summary);
router.get('/payroll',                      payCtrl.list);
router.get('/payroll/:id',                  payCtrl.getById);
router.post('/payroll',                     payCtrl.create);
router.post('/payroll/generate',            payCtrl.generate);
router.post('/payroll/:id/process',         payCtrl.process);
router.post('/payroll/:id/pay',             payCtrl.pay);
router.post('/payroll/:id/reject',          payCtrl.reject);
router.post('/payroll/:id/reopen',          payCtrl.reopen);
router.delete('/payroll/:id',               payCtrl.remove);
router.get('/payroll/:runId/slips/:slipId',              payCtrl.getSlip);
router.put('/payroll/:runId/slips/:slipId',              payCtrl.updateSlip);
router.post('/payroll/:runId/slips/:slipId/send-email',  payCtrl.sendEmail);

// Attendance
router.get('/attendance/summary',        attCtrl.summary);
router.get('/attendance',                attCtrl.list);
router.get('/attendance/:id',            attCtrl.getById);
router.post('/attendance',               attCtrl.create);
router.put('/attendance/:id',            attCtrl.update);
router.delete('/attendance/:id',         attCtrl.remove);

// Leaves
router.get('/leaves/summary',            lvCtrl.summary);
router.get('/leaves/balances',           lvCtrl.balances);
router.get('/leaves',                    lvCtrl.list);
router.get('/leaves/:id',                lvCtrl.getById);
router.post('/leaves',                   lvCtrl.create);
router.delete('/leaves/:id',             lvCtrl.remove);
router.post('/leaves/:id/approve',       lvCtrl.approve);
router.post('/leaves/:id/reject',        lvCtrl.reject);
router.post('/leaves/:id/cancel',        lvCtrl.cancel);

// Departments
router.get('/departments',               deptCtrl.list);
router.get('/departments/:id',           deptCtrl.getById);
router.post('/departments',              deptCtrl.create);
router.put('/departments/:id',           deptCtrl.update);
router.delete('/departments/:id',        deptCtrl.remove);

// Performance
const perfCtrl = require('../controllers/performance.controller');
router.get('/performance/summary',                   perfCtrl.summary);
router.get('/performance',                           perfCtrl.list);
router.get('/performance/:id',                       perfCtrl.getById);
router.post('/performance',                          perfCtrl.create);
router.put('/performance/:id',                       perfCtrl.update);
router.post('/performance/:id/submit',               perfCtrl.submit);
router.post('/performance/:id/acknowledge',          perfCtrl.acknowledge);
router.post('/performance/:id/complete',             perfCtrl.complete);
router.delete('/performance/:id',                    perfCtrl.remove);
router.post('/performance/:id/goals',                perfCtrl.addGoal);
router.put('/performance/:id/goals/:goalId',         perfCtrl.updateGoal);
router.delete('/performance/:id/goals/:goalId',      perfCtrl.removeGoal);

// Recruitment - Jobs
const recCtrl = require('../controllers/recruitment.controller');
router.get('/recruitment/jobs/summary',              recCtrl.jobsSummary);
router.get('/recruitment/jobs',                      recCtrl.listJobs);
router.get('/recruitment/jobs/:id',                  recCtrl.getJobById);
router.post('/recruitment/jobs',                     recCtrl.createJob);
router.put('/recruitment/jobs/:id',                  recCtrl.updateJob);
router.post('/recruitment/jobs/:id/publish',         recCtrl.publishJob);
router.post('/recruitment/jobs/:id/close',           recCtrl.closeJob);
router.delete('/recruitment/jobs/:id',               recCtrl.deleteJob);

// Recruitment - Applicants
router.get('/recruitment/applicants/summary',        recCtrl.applicantsSummary);
router.get('/recruitment/applicants',                recCtrl.listApplicants);
router.get('/recruitment/applicants/:id',            recCtrl.getApplicantById);
router.post('/recruitment/applicants',               recCtrl.createApplicant);
router.patch('/recruitment/applicants/:id/stage',    recCtrl.updateApplicantStage);
router.delete('/recruitment/applicants/:id',         recCtrl.deleteApplicant);

// Careers public routes (exported separately — mounted without auth in app.js)
const careersRouter = require('express').Router();
careersRouter.get('/jobs', async (req, res, next) => {
  try {
    const { Job } = require('../models/Job');
    res.json(await Job.find({ isDeleted: false, status: 'published' }).select('-tenantId').sort({ postedAt: -1 }));
  } catch (err) { next(err); }
});
careersRouter.get('/jobs/:id', async (req, res, next) => {
  try {
    const { Job } = require('../models/Job');
    const j = await Job.findOne({ _id: req.params.id, isDeleted: false, status: 'published' }).select('-tenantId');
    if (!j) return res.status(404).json({ code: 'Job.NotFound', description: 'Job not found.' });
    res.json(j);
  } catch (err) { next(err); }
});
careersRouter.post('/apply', async (req, res, next) => {
  try {
    const { Job, Applicant } = require('../models/Job');
    const job = await Job.findOne({ _id: req.body.jobId, isDeleted: false, status: 'published' });
    if (!job) return res.status(404).json({ code: 'Job.NotFound', description: 'Job not found.' });
    res.status(201).json(await Applicant.create({ ...req.body, jobTitle: job.title, tenantId: job.tenantId }));
  } catch (err) { next(err); }
});
module.exports = router;
module.exports.careersRouter = careersRouter;
