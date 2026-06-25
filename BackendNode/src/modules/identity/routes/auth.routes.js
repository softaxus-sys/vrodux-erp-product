const router  = require('express').Router();
const ctrl    = require('../controllers/auth.controller');
const { authenticate } = require('../../../middleware/auth');
const rateLimit = require('express-rate-limit');

const forgotPasswordLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: { code: 'RateLimit.Exceeded', description: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/',                            ctrl.login);
router.post('/login',                       ctrl.login);   // frontend calls /api/auth/login
router.post('/refresh',                     ctrl.refresh);
router.post('/revoke',                      ctrl.revoke);
router.post('/forgot-password', forgotPasswordLimiter, ctrl.forgotPassword);
router.post('/reset-password',              ctrl.resetPassword);

router.get( '/me',                 authenticate, ctrl.me);
router.put( '/me',                 authenticate, ctrl.updateMe);
router.post('/me/change-password', authenticate, ctrl.changePassword);

module.exports = router;
