const router = require('express').Router();
const c      = require('../controllers/restaurant.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

router.get('/summary',                        c.summary);

router.get('/tables',                         c.listTables);
router.post('/tables',                        c.createTable);
router.put('/tables/:id',                     c.updateTable);
router.patch('/tables/:id/status',            c.patchTableStatus);
router.delete('/tables/:id',                  c.deleteTable);

router.get('/menu/categories',                c.listCategories);
router.post('/menu/categories',               c.createCategory);
router.put('/menu/categories/:id',            c.updateCategory);
router.delete('/menu/categories/:id',         c.deleteCategory);

router.get('/menu/items',                     c.listMenuItems);
router.get('/menu/items/:id',                 c.getMenuItemById);
router.post('/menu/items',                    c.createMenuItem);
router.put('/menu/items/:id',                 c.updateMenuItem);
router.patch('/menu/items/:id/availability',  c.toggleMenuItemAvailability);
router.delete('/menu/items/:id',              c.deleteMenuItem);

router.get('/orders',                         c.listOrders);
router.get('/orders/:id',                     c.getOrderById);
router.post('/orders',                        c.createOrder);
router.post('/orders/:id/items',              c.addOrderItems);
router.post('/orders/:id/send-to-kitchen',    c.sendToKitchen);
router.post('/orders/:id/close',              c.closeOrder);
router.post('/orders/:id/cancel',             c.cancelOrder);
router.delete('/orders/:id',                  c.deleteOrder);

router.get('/reservations',                   c.listReservations);
router.post('/reservations',                  c.createReservation);
router.patch('/reservations/:id/status',      c.patchReservationStatus);
router.delete('/reservations/:id',            c.deleteReservation);

router.get('/kitchen',                        c.listKitchenTickets);
router.patch('/kitchen/:id/status',           c.patchTicketStatus);

module.exports = router;
