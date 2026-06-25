const router = require('express').Router();
const c      = require('../controllers/hospitality.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

router.get('/summary',                   c.summary);

router.get('/rooms',                     c.listRooms);
router.get('/rooms/:id',                 c.getRoomById);
router.post('/rooms',                    c.createRoom);
router.put('/rooms/:id',                 c.updateRoom);
router.patch('/rooms/:id/status',        c.patchRoomStatus);
router.delete('/rooms/:id',              c.deleteRoom);

router.get('/bookings',                  c.listBookings);
router.get('/bookings/:id',              c.getBookingById);
router.post('/bookings',                 c.createBooking);
router.post('/bookings/:id/check-in',    c.checkIn);
router.post('/bookings/:id/check-out',   c.checkOut);
router.post('/bookings/:id/cancel',      c.cancelBooking);
router.delete('/bookings/:id',           c.deleteBooking);

router.get('/housekeeping',              c.listHousekeeping);
router.post('/housekeeping',             c.createTask);
router.patch('/housekeeping/:id/status', c.patchTaskStatus);
router.delete('/housekeeping/:id',       c.deleteTask);

router.get('/guests',                    c.listGuests);
router.post('/guests',                   c.createGuest);
router.put('/guests/:id',                c.updateGuest);
router.delete('/guests/:id',             c.deleteGuest);

module.exports = router;
