const router   = require('express').Router();
const inv      = require('../controllers/invoices.controller');
const jnl      = require('../controllers/journals.controller');
const acc      = require('../controllers/accounts.controller');
const bank     = require('../controllers/banking.controller');
const exp      = require('../controllers/expenses.controller');
const bud      = require('../controllers/budgets.controller');
const pb       = require('../controllers/purchaseBills.controller');
const gl       = require('../controllers/gl.controller');
const ext      = require('../controllers/extensions.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);

// ── Invoices ────────────────────────────────────────────────────────────────
router.get('/invoices/summary',                  inv.summary);
router.get('/invoices',                          inv.list);
router.get('/invoices/:id',                      inv.getById);
router.post('/invoices',                         inv.create);
router.put('/invoices/:id',                      inv.update);
router.post('/invoices/:id/send',                inv.send);
router.post('/invoices/:id/pay',                 inv.pay);
router.post('/invoices/:id/cancel',              inv.cancel);
router.delete('/invoices/:id',                   inv.remove);

// ── Journals (reads) — frontend calls /journals ──────────────────────────
router.get('/journals/summary',                  jnl.summary);
router.get('/journals',                          jnl.list);
router.get('/journals/:id',                      jnl.getById);

// ── Journal Entries (mutations) — frontend calls /journal-entries ─────────
router.get('/journal-entries',                   jnl.list);
router.get('/journal-entries/:id',               jnl.getById);
router.post('/journal-entries',                  jnl.create);
router.post('/journal-entries/:id/post',         jnl.post);
router.post('/journal-entries/:id/void',         jnl.voidEntry);
router.delete('/journal-entries/:id',            jnl.remove);

// ── Accounts (Chart of Accounts) ─────────────────────────────────────────
router.get('/accounts/summary',                  acc.summary);
router.get('/accounts',                          acc.list);
router.get('/accounts/:id',                      acc.getById);
router.post('/accounts',                         acc.create);
router.put('/accounts/:id',                      acc.update);
router.delete('/accounts/:id',                   acc.remove);

// ── Account Types (full CRUD) — frontend: POST /account-types ────────────
router.get('/account-types',                     ext.getAccountTypes);
router.post('/account-types/reorder',            ext.reorderAccountTypes);
router.post('/account-types',                    ext.createAccountType);
router.put('/account-types/:id',                 ext.updateAccountType);
router.delete('/account-types/:id',              ext.deleteAccountType);

// ── Banking ──────────────────────────────────────────────────────────────
router.get('/banking/summary',                   bank.summary);
router.get('/banking/accounts',                  bank.listAccounts);
router.get('/banking/accounts/:id',              bank.getAccountById);
router.post('/banking/accounts',                 bank.createAccount);
router.put('/banking/accounts/:id',              bank.updateAccount);
router.patch('/banking/accounts/:id/set-default', bank.setDefault);
router.delete('/banking/accounts/:id',           bank.removeAccount);

// Banking transactions — frontend calls both standalone and account-scoped
router.get('/banking/transactions',              bank.listAllTransactions);
router.post('/banking/transactions',             bank.addTransactionDirect);
router.post('/banking/transactions/:id/reconcile', bank.reconcileTransaction);
router.get('/banking/accounts/:id/transactions', bank.listTransactions);
router.post('/banking/accounts/:id/transactions', bank.addTransaction);
router.post('/banking/accounts/:id/reconcile',   bank.reconcile);

// ── Expenses ─────────────────────────────────────────────────────────────
router.get('/expenses/summary',                  exp.summary);
router.get('/expenses',                          exp.list);
router.get('/expenses/:id',                      exp.getById);
router.post('/expenses',                         exp.create);
router.put('/expenses/:id',                      exp.update);
router.post('/expenses/:id/approve',             exp.approve);
router.post('/expenses/:id/reject',              exp.reject);
router.post('/expenses/:id/pay',                 exp.pay);
router.delete('/expenses/:id/receipt',           (req, res) => res.status(204).send());
router.delete('/expenses/:id',                   exp.remove);

// ── Budgets ──────────────────────────────────────────────────────────────
router.get('/budgets/summary',                   bud.summary);
router.get('/budgets',                           bud.list);
router.get('/budgets/:id',                       bud.getById);
router.post('/budgets',                          bud.create);
router.put('/budgets/:id',                       bud.update);
router.post('/budgets/:id/status',               bud.changeStatus);
router.delete('/budgets/:id',                    bud.remove);

// ── Purchase Bills (AP) ──────────────────────────────────────────────────
router.get('/suppliers',                         pb.getSuppliers);
router.get('/purchase-bills/summary',            pb.summary);
router.get('/purchase-bills',                    pb.list);
router.get('/purchase-bills/:id',                pb.getById);
router.post('/purchase-bills',                   pb.create);
router.put('/purchase-bills/:id',                pb.update);
router.post('/purchase-bills/:id/approve',       pb.approve);
router.post('/purchase-bills/:id/cancel',        pb.cancel);
router.delete('/purchase-bills/:id',             pb.remove);

// ── General Ledger ───────────────────────────────────────────────────────
router.get('/gl/summary',                        gl.summary);
router.get('/gl/trial-balance',                  gl.trialBalance);
router.get('/gl/profit-loss',                    gl.profitLoss);
router.get('/gl/balance-sheet',                  gl.balanceSheet);
router.get('/gl/cash-flow',                      gl.cashFlow);
router.get('/gl/accounts/:accountId/ledger',     gl.accountLedger);

// ── Exchange Rates ───────────────────────────────────────────────────────
router.get('/exchange-rates/convert',            ext.convertCurrency);
router.get('/exchange-rates',                    ext.listRates);
router.post('/exchange-rates',                   ext.createRate);

// ── Fiscal Periods ───────────────────────────────────────────────────────
router.get('/fiscal-periods',                    ext.listFiscalPeriods);
router.post('/fiscal-periods',                   ext.createFiscalPeriod);
router.post('/fiscal-periods/:id/close',         ext.closeFiscalPeriod);
router.post('/fiscal-periods/:id/reopen',        ext.reopenFiscalPeriod);

// ── Tax ──────────────────────────────────────────────────────────────────
router.get('/tax/summary',                       ext.taxSummary);
router.get('/tax/transactions',                  ext.listTaxTransactions);
router.get('/tax/periods',                       ext.listTaxPeriods);
router.post('/tax/periods',                      ext.createTaxPeriod);
router.post('/tax/periods/:id/file',             ext.fileTaxPeriod);
router.post('/tax/periods/:id/pay',              ext.payTaxPeriod);

// ── Recurring Invoices — frontend uses /recurring-invoices ────────────────
router.get('/recurring-invoices/summary',        ext.recurringInvoicesSummary);
router.get('/recurring-invoices',                ext.listRecurring);
router.get('/recurring-invoices/:id',            ext.getRecurringById);
router.post('/recurring-invoices/run-due',       ext.runDueRecurring);
router.post('/recurring-invoices/:id/pause',     ext.pauseRecurring);
router.post('/recurring-invoices/:id/resume',    ext.resumeRecurring);
router.post('/recurring-invoices/:id/generate',  ext.generateRecurring);
router.post('/recurring-invoices',               ext.createRecurring);
router.put('/recurring-invoices/:id',            ext.updateRecurring);
router.delete('/recurring-invoices/:id',         ext.deleteRecurring);
// Legacy alias
router.get('/recurring',                         ext.listRecurring);
router.get('/recurring/:id',                     ext.getRecurringById);

// ── Payment Vouchers ─────────────────────────────────────────────────────
router.get('/payment-vouchers',                  ext.paymentVouchers.list);
router.get('/payment-vouchers/:id',              ext.paymentVouchers.getById);
router.post('/payment-vouchers',                 ext.paymentVouchers.create);
router.post('/payment-vouchers/:id/post',        ext.paymentVouchers.post);
router.post('/payment-vouchers/:id/void',        ext.paymentVouchers.void);
router.delete('/payment-vouchers/:id',           ext.paymentVouchers.remove);

// ── Receipt Vouchers ─────────────────────────────────────────────────────
router.get('/receipt-vouchers',                  ext.receiptVouchers.list);
router.get('/receipt-vouchers/:id',              ext.receiptVouchers.getById);
router.post('/receipt-vouchers',                 ext.receiptVouchers.create);
router.post('/receipt-vouchers/:id/post',        ext.receiptVouchers.post);
router.post('/receipt-vouchers/:id/void',        ext.receiptVouchers.void);
router.delete('/receipt-vouchers/:id',           ext.receiptVouchers.remove);

// ── Finance Customers ────────────────────────────────────────────────────
router.get('/customers',                         ext.listCustomers);
router.get('/customers/:id',                     ext.getCustomerById);
router.post('/customers',                        ext.createCustomer);
router.put('/customers/:id',                     ext.updateCustomer);
router.delete('/customers/:id',                  ext.deleteCustomer);

// ── AR / AP Aging ────────────────────────────────────────────────────────
router.get('/receivables/aging',                 ext.arAging);
router.get('/payables/aging',                    ext.apAging);

module.exports = router;
