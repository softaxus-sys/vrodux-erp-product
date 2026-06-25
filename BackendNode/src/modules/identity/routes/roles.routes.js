const router = require('express').Router();
const ctrl   = require('../controllers/roles.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

router.get('/',                      ctrl.list);
router.get('/:id',                   ctrl.getById);
router.post('/',                     ctrl.create);
router.put('/:id',                   ctrl.update);
router.delete('/:id',                ctrl.remove);
router.get('/:id/permissions',       ctrl.getPermissions);
router.post('/:id/permissions',      ctrl.addPermission);

module.exports = router;
