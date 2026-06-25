const router = require('express').Router();
const c      = require('../controllers/construction.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

router.get('/projects/summary',          c.projectsSummary);
router.get('/projects',                  c.listProjects);
router.get('/projects/:id',              c.getProjectById);
router.post('/projects',                 c.createProject);
router.delete('/projects/:id',           c.deleteProject);

router.get('/sites/summary',             c.sitesSummary);
router.get('/sites',                     c.listSites);
router.post('/sites',                    c.createSite);
router.delete('/sites/:id',              c.deleteSite);

router.get('/contractors/summary',       c.contractorsSummary);
router.get('/contractors',               c.listContractors);
router.post('/contractors',              c.createContractor);
router.delete('/contractors/:id',        c.deleteContractor);

router.get('/boqs/summary',              c.boqSummary);
router.get('/boqs',                      c.listBoqs);
router.post('/boqs',                     c.createBoq);
router.delete('/boqs/:id',              c.deleteBoq);

router.get('/bidding/summary',           c.biddingSummary);

router.get('/rfqs',                      c.rfqs.list);
router.post('/rfqs',                     c.rfqs.create);
router.patch('/rfqs/:id/status',         c.rfqs.patchStatus);
router.delete('/rfqs/:id',               c.rfqs.remove);

router.get('/estimates',                 c.estimates.list);
router.post('/estimates',                c.estimates.create);
router.patch('/estimates/:id/status',    c.estimates.patchStatus);
router.delete('/estimates/:id',          c.estimates.remove);

router.get('/contracts',                 c.contracts.list);
router.post('/contracts',                c.contracts.create);
router.patch('/contracts/:id/status',    c.contracts.patchStatus);
router.delete('/contracts/:id',          c.contracts.remove);

module.exports = router;
