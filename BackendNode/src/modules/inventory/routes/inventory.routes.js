const router  = require('express').Router();
const prod    = require('../controllers/products.controller');
const wh      = require('../controllers/warehouses.controller');
const sm      = require('../controllers/stockMovements.controller');
const st      = require('../controllers/stockTransfers.controller');
const master  = require('../controllers/master.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

// Products
router.get('/products',                      prod.list);
router.get('/products/barcode/:barcode',     prod.getByBarcode);
router.get('/products/:id',                  prod.getById);
router.post('/products',                     prod.create);
router.put('/products/:id',                  prod.update);
router.patch('/products/:id/activate',       prod.activate);
router.patch('/products/:id/deactivate',     prod.deactivate);
router.delete('/products/:id',               prod.remove);
router.get('/products/:id/stock',            prod.getStock);
router.get('/products/:id/batches',          prod.getBatches);

// Warehouses
router.get('/warehouses',                    wh.list);
router.get('/warehouses/:id',                wh.getById);
router.post('/warehouses',                   wh.create);
router.put('/warehouses/:id',                wh.update);
router.patch('/warehouses/:id/set-default',  wh.setDefault);
router.delete('/warehouses/:id',             wh.remove);

// Stock Movements
router.get('/stock-movements',               sm.list);
router.post('/stock-movements',              sm.create);

// Stock Transfers
router.get('/stock-transfers/summary',       st.summary);
router.get('/stock-transfers',               st.list);
router.get('/stock-transfers/:id',           st.getById);
router.post('/stock-transfers',              st.create);
router.post('/stock-transfers/:id/submit',   st.submit);
router.post('/stock-transfers/:id/approve',  st.approve);
router.post('/stock-transfers/:id/receive',  st.receive);

// Brands
router.get('/brands',                        master.brands.list);
router.get('/brands/:id',                    master.brands.getById);
router.post('/brands',                       master.brands.create);
router.put('/brands/:id',                    master.brands.update);
router.delete('/brands/:id',                 master.brands.remove);

// Categories — frontend calls /categories AND /product-categories (alias both)
router.get('/categories',                    master.categories.list);
router.get('/categories/:id',                master.categories.getById);
router.post('/categories',                   master.categories.create);
router.put('/categories/:id',                master.categories.update);
router.delete('/categories/:id',             master.categories.remove);
router.get('/product-categories',            master.categories.list);
router.get('/product-categories/:id',        master.categories.getById);
router.post('/product-categories',           master.categories.create);
router.put('/product-categories/:id',        master.categories.update);
router.delete('/product-categories/:id',     master.categories.remove);

// Units of Measure
router.get('/units-of-measure',              master.uoms.list);
router.get('/units-of-measure/:id',          master.uoms.getById);
router.post('/units-of-measure',             master.uoms.create);
router.put('/units-of-measure/:id',          master.uoms.update);
router.delete('/units-of-measure/:id',       master.uoms.remove);

// Reports (read-only)
router.get('/reports/stock-levels', async (req, res) => {
  const ProductStock = require('../models/ProductStock');
  const { tenantFilter } = require('../../../middleware/auth');
  const items = await ProductStock.find(tenantFilter(req)).sort({ productName: 1 });
  res.json(items.map(s => ({ productId: s.productId, productName: s.productName, totalQty: s.totalQty, updatedAt: s.updatedAt })));
});

module.exports = router;
