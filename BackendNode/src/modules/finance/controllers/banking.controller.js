const BankAccount = require('../models/BankAccount');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

// Frontend expects: iban, availableBalance, status "active"|"inactive", accountType "current"|"savings", lastSynced
const dto = b => ({
  id:               b._id,
  accountName:      b.accountName,
  bankName:         b.bankName,
  accountNumber:    b.accountNumber,
  iban:             b.iban || '',
  currency:         b.currency || 'AED',
  balance:          b.balance || 0,
  availableBalance: b.availableBalance || b.balance || 0,
  status:           b.isActive !== false ? 'active' : 'inactive',
  accountType:      b.accountType || 'current',
  lastSynced:       b.lastSynced || b.updatedAt || b.createdAt,
  isDefault:        b.isDefault || false,
  createdAt:        b.createdAt,
});

// Frontend BankTransactionDto: accountId, date, description, reference, amount, type "credit"|"debit", category, reconciled, balance
const txDto = (t, accountId) => ({
  id:          t._id,
  accountId:   accountId,
  date:        t.date,
  description: t.description,
  reference:   t.reference || '',
  amount:      Math.abs((t.credit || 0) - (t.debit || 0)) || t.amount || 0,
  type:        (t.credit || 0) > 0 ? 'credit' : 'debit',
  category:    t.category || '',
  reconciled:  t.isReconciled || false,
  balance:     t.balance || 0,
  debit:       t.debit || 0,
  credit:      t.credit || 0,
});

exports.summary = async (req, res, next) => {
  try {
    const accounts = await BankAccount.find({ ...tenantFilter(req), isDeleted: false });
    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let totalBalance = 0, totalCreditThisMonth = 0, totalDebitThisMonth = 0, unreconciled = 0;
    for (const b of accounts) {
      totalBalance += b.balance || 0;
      for (const tx of (b.transactions || [])) {
        if ((tx.date || '').startsWith(month)) {
          totalCreditThisMonth += tx.credit || 0;
          totalDebitThisMonth  += tx.debit  || 0;
        }
        if (!tx.isReconciled) unreconciled++;
      }
    }
    res.json({ totalBalance, totalAccounts: accounts.length, totalCreditThisMonth, totalDebitThisMonth, unreconciled });
  } catch (err) { next(err); }
};

exports.listAccounts = async (req, res, next) => {
  try {
    const items = await BankAccount.find({ ...tenantFilter(req), isDeleted: false }).sort({ accountName: 1 });
    res.json(items.map(dto));
  } catch (err) { next(err); }
};

exports.getAccountById = async (req, res, next) => {
  try {
    const b = await BankAccount.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'BankAccount.NotFound', description: 'Bank account not found.' });
    res.json(dto(b));
  } catch (err) { next(err); }
};

exports.createAccount = async (req, res, next) => {
  try {
    if (req.body.isDefault) {
      await BankAccount.updateMany({ tenantId: req.user.tenant_id }, { isDefault: false });
    }
    const b = await BankAccount.create({ ...req.body, tenantId: req.user.tenant_id });
    res.status(201).json(dto(b));
  } catch (err) { next(err); }
};

exports.updateAccount = async (req, res, next) => {
  try {
    if (req.body.isDefault) {
      await BankAccount.updateMany({ tenantId: req.user.tenant_id }, { isDefault: false });
    }
    const b = await BankAccount.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!b) return res.status(404).json({ code: 'BankAccount.NotFound', description: 'Bank account not found.' });
    res.json(dto(b));
  } catch (err) { next(err); }
};

exports.setDefault = async (req, res, next) => {
  try {
    await BankAccount.updateMany({ tenantId: req.user.tenant_id }, { isDefault: false });
    const b = await BankAccount.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req) }, { isDefault: true, updatedAt: new Date() }, { new: true }
    );
    if (!b) return res.status(404).json({ code: 'BankAccount.NotFound', description: 'Bank account not found.' });
    res.json(dto(b));
  } catch (err) { next(err); }
};

exports.removeAccount = async (req, res, next) => {
  try {
    await BankAccount.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

exports.listTransactions = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const b = await BankAccount.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'BankAccount.NotFound', description: 'Bank account not found.' });
    const txs   = b.transactions.slice().reverse();
    const total = txs.length;
    const sliced = txs.slice(skip, skip + pageSize);
    res.json(paged(sliced.map(t => txDto(t, b._id)), total, page, pageSize));
  } catch (err) { next(err); }
};

exports.addTransaction = async (req, res, next) => {
  try {
    const b = await BankAccount.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'BankAccount.NotFound', description: 'Bank account not found.' });
    const lastBalance = b.transactions.length ? b.transactions[b.transactions.length - 1].balance : b.balance;
    const tx = { ...req.body, balance: lastBalance + (req.body.credit || 0) - (req.body.debit || 0) };
    b.transactions.push(tx);
    b.balance = tx.balance;
    b.updatedAt = new Date();
    await b.save();
    res.status(201).json(txDto(b.transactions[b.transactions.length - 1], b._id));
  } catch (err) { next(err); }
};

exports.reconcile = async (req, res, next) => {
  try {
    const { transactionIds = [] } = req.body;
    const b = await BankAccount.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'BankAccount.NotFound', description: 'Bank account not found.' });
    b.transactions.forEach(tx => {
      if (transactionIds.includes(String(tx._id))) tx.isReconciled = true;
    });
    b.updatedAt = new Date();
    await b.save();
    res.status(204).send();
  } catch (err) { next(err); }
};

// Standalone transaction endpoints (all accounts)
exports.listAllTransactions = async (req, res, next) => {
  try {
    const accounts = await BankAccount.find({ ...tenantFilter(req), isDeleted: false });
    let txs = [];
    accounts.forEach(acc => {
      (acc.transactions || []).forEach(tx => {
        txs.push({ id: tx._id, bankAccountId: acc._id, accountName: acc.accountName, date: tx.date, description: tx.description, amount: tx.amount, type: tx.type, reconciled: tx.isReconciled || false, reference: tx.reference || null, category: tx.category || null });
      });
    });
    txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(txs);
  } catch (err) { next(err); }
};
exports.addTransactionDirect = async (req, res, next) => {
  try {
    const { bankAccountId, ...txData } = req.body;
    const b = await BankAccount.findOne({ _id: bankAccountId, ...tenantFilter(req), isDeleted: false });
    if (!b) return res.status(404).json({ code: 'BankAccount.NotFound', description: 'Bank account not found.' });
    b.transactions.push(txData);
    if (txData.type === 'credit') b.balance = (b.balance || 0) + (txData.amount || 0);
    else b.balance = (b.balance || 0) - (txData.amount || 0);
    b.updatedAt = new Date();
    await b.save();
    res.status(201).json(b.transactions[b.transactions.length - 1]);
  } catch (err) { next(err); }
};
exports.reconcileTransaction = async (req, res, next) => {
  try {
    const accounts = await BankAccount.find({ ...tenantFilter(req), isDeleted: false });
    for (const acc of accounts) {
      const tx = acc.transactions.id(req.params.id);
      if (tx) { tx.isReconciled = true; acc.updatedAt = new Date(); await acc.save(); return res.status(204).send(); }
    }
    res.status(404).json({ code: 'Transaction.NotFound', description: 'Transaction not found.' });
  } catch (err) { next(err); }
};
