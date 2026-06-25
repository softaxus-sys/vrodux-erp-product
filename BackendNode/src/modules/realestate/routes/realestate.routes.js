const router = require('express').Router();
const c      = require('../controllers/realEstate.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

router.get('/properties/summary',        c.propertiesSummary);
router.get('/properties',                c.listProperties);
router.get('/properties/:id',            c.getPropertyById);
router.post('/properties',               c.createProperty);
router.put('/properties/:id',            c.updateProperty);
router.delete('/properties/:id',         c.deleteProperty);

router.get('/units/summary',             c.unitsSummary);
router.get('/units',                     c.listUnits);
router.post('/units',                    c.createUnit);
router.delete('/units/:id',              c.deleteUnit);

router.get('/tenants/summary',           c.reTenantsSummary);
router.get('/tenants',                   c.listReTenants);
router.post('/tenants',                  c.createReTenant);
router.delete('/tenants/:id',            c.deleteReTenant);

router.get('/contracts/summary',         c.contractsSummary);
router.get('/contracts',                 c.listContracts);
router.post('/contracts',                c.createContract);
router.delete('/contracts/:id',          c.deleteContract);

router.get('/brokers/summary',           c.brokersSummary);
router.get('/brokers',                   c.listBrokers);
router.post('/brokers',                  c.createBroker);
router.delete('/brokers/:id',            c.deleteBroker);

router.get('/sales/summary',             c.salesSummary);

router.get('/site-visits',               c.listSiteVisits);
router.post('/site-visits',              c.createSiteVisit);
router.patch('/site-visits/:id/complete',c.completeSiteVisit);
router.delete('/site-visits/:id',        c.deleteSiteVisit);

router.get('/reservations',              c.listReservations);
router.post('/reservations',             c.createReservation);
router.patch('/reservations/:id/status', c.patchReservationStatus);
router.delete('/reservations/:id',       c.deleteReservation);

router.get('/bookings',                  c.listBookings);
router.post('/bookings',                 c.createBooking);
router.post('/bookings/:id/payment',     c.addBookingPayment);
router.patch('/bookings/:id/status',     c.patchBookingStatus);
router.delete('/bookings/:id',           c.deleteBooking);

module.exports = router;
