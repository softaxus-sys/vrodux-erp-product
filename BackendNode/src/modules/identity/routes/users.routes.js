const router = require('express').Router();
const ctrl   = require('../controllers/users.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

router.get('/',                    ctrl.list);
router.get('/:id',                 ctrl.getById);
router.post('/',                   ctrl.create);
router.put('/:id',                 ctrl.update);
router.delete('/:id',              ctrl.remove);
router.post('/:id/roles',          ctrl.assignRole);
router.delete('/:id/roles/:roleId',ctrl.removeRole);
router.post('/:id/reset-password', ctrl.adminResetPassword);

module.exports = router;
