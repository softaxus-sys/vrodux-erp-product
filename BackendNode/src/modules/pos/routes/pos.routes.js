const router = require('express').Router();
const c      = require('../controllers/pos.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

// Categories
router.get('/categories',                          c.listCategories);
router.post('/categories',                         c.createCategory);
router.put('/categories/:id',                      c.updateCategory);
router.delete('/categories/:id',                   c.deleteCategory);

// Products
router.get('/products',                            c.listProducts);
router.get('/products/barcode/:barcode',           c.getProductByBarcode);
router.get('/products/:id',                        c.getProductById);
router.post('/products',                           c.createProduct);
router.put('/products/:id',                        c.updateProduct);
router.delete('/products/:id',                     c.deleteProduct);
router.post('/products/:id/stock-adjustment',      c.adjustStock);

// Customers
router.get('/customers',                           c.listCustomers);
router.get('/customers/:id',                       c.getCustomerById);
router.post('/customers',                          c.createCustomer);
router.put('/customers/:id',                       c.updateCustomer);
router.delete('/customers/:id',                    c.deleteCustomer);

// Vendors
router.get('/vendors',                             c.listVendors);
router.get('/vendors/:id',                         c.getVendorById);
router.post('/vendors',                            c.createVendor);
router.put('/vendors/:id',                         c.updateVendor);
router.delete('/vendors/:id',                      c.deleteVendor);

// Sessions
router.get('/sessions/active',                     c.getActiveSessions);
router.get('/sessions/:id',                        c.getSessionById);
router.post('/sessions/open',                      c.openSession);
router.post('/sessions/:id/close',                 c.closeSession);
router.post('/sessions/:id/suspend',               c.suspendSession);
router.get('/sessions/:id/transactions',           c.getSessionTransactions);
router.post('/sessions/:id/cash-movement',         c.addCashMovement);
router.get('/sessions/:id/cash-movements',         c.getCashMovements);

// Transactions
router.get('/transactions',                        c.listTransactions);
router.get('/transactions/:id',                    c.getTransactionById);
router.post('/transactions/sale',                  c.createSale);
router.post('/transactions/hold',                  c.holdTransaction);
router.post('/transactions/held/:id/recall',       c.recallTransaction);
router.post('/transactions/:id/void',              c.voidTransaction);
router.post('/transactions/:id/refund',            c.refundTransaction);

// Reports
router.get('/reports/daily-summary',               c.getDailySummary);
router.get('/reports/:reportId',                   c.getReport);

// Purchase Orders
router.get('/purchase-orders',                     c.listPurchaseOrders);
router.get('/purchase-orders/:id',                 c.getPurchaseOrderById);
router.post('/purchase-orders',                    c.createPurchaseOrder);
router.put('/purchase-orders/:id',                 c.updatePurchaseOrder);
router.patch('/purchase-orders/:id/status',        c.patchPurchaseOrderStatus);
router.delete('/purchase-orders/:id',              c.deletePurchaseOrder);

// Sales Orders
router.get('/sales-orders',                        c.listSalesOrders);
router.get('/sales-orders/:id',                    c.getSalesOrderById);
router.post('/sales-orders',                       c.createSalesOrder);
router.put('/sales-orders/:id',                    c.updateSalesOrder);
router.delete('/sales-orders/:id',                 c.deleteSalesOrder);

// Sales Quotations
router.get('/sales-quotations',                    c.listSalesQuotations);
router.get('/sales-quotations/:id',                c.getSalesQuotationById);
router.post('/sales-quotations',                   c.createSalesQuotation);
router.put('/sales-quotations/:id',                c.updateSalesQuotation);
router.post('/sales-quotations/:id/convert',       c.convertQuotation);
router.delete('/sales-quotations/:id',             c.deleteSalesQuotation);

// Lookup tables
router.get('/tax-rates',                           c.taxRates.list);
router.put('/tax-rates',                           c.taxRates.upsert);
router.delete('/tax-rates/:id',                    c.taxRates.remove);

router.get('/currencies',                          c.currencies.list);
router.put('/currencies',                          c.currencies.upsert);
router.delete('/currencies/:id',                   c.currencies.remove);

router.get('/payment-methods',                     c.payMethods.list);
router.put('/payment-methods',                     c.payMethods.upsert);
router.delete('/payment-methods/:id',              c.payMethods.remove);

router.get('/payment-terms',                       c.payTerms.list);
router.put('/payment-terms',                       c.payTerms.upsert);
router.delete('/payment-terms/:id',                c.payTerms.remove);

router.get('/customer-groups',                     c.custGroups.list);
router.put('/customer-groups',                     c.custGroups.upsert);
router.delete('/customer-groups/:id',              c.custGroups.remove);

// Vouchers
router.get('/vouchers',                            c.vouchers.list);
router.put('/vouchers',                            c.vouchers.upsert);
router.delete('/vouchers/:id',                     c.vouchers.remove);
router.post('/vouchers/validate',                  c.vouchers.validate);
router.post('/vouchers/redeem',                    c.vouchers.redeem);

// Print
router.get('/pos/print/status',                    c.printStatus);
router.post('/pos/print/raw',                      c.printRaw);

// Stock Movements (POS — read only, movements created by stock-adjustment)
router.get('/stock-movements', async (req, res, next) => {
  try {
    const PosProduct = require('../models/PosProduct');
    const { tenantFilter } = require('../../../middleware/auth');
    const { parsePaging, paged } = require('../../../utils/helpers');
    const { page, pageSize, skip } = parsePaging(req.query);
    // Stock adjustments are embedded; return recent transactions as proxy
    const PosTransaction = require('../models/PosTransaction');
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.productId) f['lineItems.productId'] = req.query.productId;
    if (req.query.type) f.type = req.query.type;
    const [items, total] = await Promise.all([PosTransaction.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize), PosTransaction.countDocuments(f)]);
    res.json(paged(items, total, page, pageSize));
  } catch (err) { next(err); }
});

module.exports = router;
