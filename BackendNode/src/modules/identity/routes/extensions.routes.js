const router = require('express').Router();
const c      = require('../controllers/extensions.controller');
const { authenticate } = require('../../../middleware/auth');

// License / heartbeat (no auth needed)
router.get('/license/heartbeat', c.heartbeat);
router.get('/license',           authenticate, c.getLicense);

// Trial
router.get('/trial/challenge',   c.trialChallenge);

// Audit logs
router.get('/audit-logs',        authenticate, c.listAuditLogs);

// Branches
router.get('/branches',          authenticate, c.listBranches);
router.get('/branches/:id',      authenticate, c.getBranchById);
router.post('/branches',         authenticate, c.createBranch);
router.put('/branches/:id',      authenticate, c.updateBranch);
router.delete('/branches/:id',   authenticate, c.deleteBranch);

// App settings — legacy /settings (internal)
router.get('/settings',                        authenticate, c.getSettings);
router.post('/settings',                       authenticate, c.upsertSetting);

// App settings — /app-settings/{category} (frontend shape)
router.get('/app-settings',                    authenticate, c.getAllAppSettings);
router.get('/app-settings/:category',          authenticate, c.getAppSettingsByCategory);
router.put('/app-settings/:category',          authenticate, c.upsertAppSettingsCategory);
router.put('/app-settings',                    authenticate, c.upsertAllAppSettings);

// Tenants admin (super admin)
router.get('/admin/tenants/stats',          authenticate, c.getTenantStats);
router.get('/admin/tenants',                authenticate, c.listTenants);
router.get('/admin/tenants/:id',            authenticate, c.getTenantById);
router.put('/admin/tenants/:id',            authenticate, c.updateTenant);
router.post('/admin/tenants/:id/suspend',   authenticate, c.suspendTenant);
router.post('/admin/tenants/:id/activate',  authenticate, c.activateTenant);

module.exports = router;
