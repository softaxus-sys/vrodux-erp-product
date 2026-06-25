const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const { tenantFilter } = require('../../../middleware/auth');

const summary = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req), isDeleted: false, status: 'posted' };
    const entries = await JournalEntry.find(f);
    let totalDebits = 0, totalCredits = 0;
    entries.forEach(e => { totalDebits += e.totalDebit || 0; totalCredits += e.totalCredit || 0; });
    const accounts = await Account.find({ ...tenantFilter(req), isDeleted: false });
    // Group entries by period
    const periodMap = {};
    entries.forEach(e => {
      const p = e.period || (e.entryDate || '').slice(0, 7);
      if (!periodMap[p]) periodMap[p] = { period: p, totalDebits: 0, totalCredits: 0, entryCount: 0 };
      periodMap[p].totalDebits  += e.totalDebit  || 0;
      periodMap[p].totalCredits += e.totalCredit || 0;
      periodMap[p].entryCount++;
    });
    const periods = Object.values(periodMap).sort((a, b) => b.period.localeCompare(a.period));
    const currentPeriod = periods[0] || null;
    res.json({ totalDebits, totalCredits, isBalanced: Math.abs(totalDebits - totalCredits) < 0.01, periods, accounts: accounts.length, currentPeriod });
  } catch (err) { next(err); }
};

const trialBalance = async (req, res, next) => {
  try {
    const accounts = await Account.find({ ...tenantFilter(req), isDeleted: false, isActive: true }).sort({ code: 1 });
    const entries = await JournalEntry.find({ ...tenantFilter(req), isDeleted: false, status: 'posted' });
    const balances = {};
    entries.forEach(e => {
      e.lines.forEach(l => {
        if (!balances[l.accountId]) balances[l.accountId] = { debit: 0, credit: 0 };
        balances[l.accountId].debit += l.debit || 0;
        balances[l.accountId].credit += l.credit || 0;
      });
    });
    // Frontend expects TrialBalanceLine[] array directly (not wrapped in { rows, totalDebit, totalCredit })
    const rows = accounts.map(a => {
      const b = balances[String(a._id)] || { debit: 0, credit: 0 };
      const openingBalance = 0;
      const closingBalance = openingBalance + b.debit - b.credit;
      return {
        accountId: a._id, accountCode: a.code || a.accountNumber || '', accountName: a.name,
        accountType: a.type || a.accountType || '',
        openingBalance, totalDebits: b.debit, totalCredits: b.credit, closingBalance,
      };
    });
    res.json(rows);
  } catch (err) { next(err); }
};

const profitLoss = async (req, res, next) => {
  try {
    const entries = await JournalEntry.find({ ...tenantFilter(req), isDeleted: false, status: 'posted' });
    const revenue = {}, expenses = {};
    entries.forEach(e => {
      e.lines.forEach(l => {
        const key = l.accountName || l.accountId;
        if (!key) return;
      });
    });
    const accounts = await Account.find({ ...tenantFilter(req), isDeleted: false, type: { $in: ['revenue', 'expense'] } });
    const balances = {};
    entries.forEach(e => {
      e.lines.forEach(l => {
        if (!l.accountId) return;
        if (!balances[l.accountId]) balances[l.accountId] = { debit: 0, credit: 0 };
        balances[l.accountId].debit += l.debit || 0;
        balances[l.accountId].credit += l.credit || 0;
      });
    });
    let totalRevenue = 0, totalExpenses = 0;
    const revenueRows = [], expenseRows = [];
    accounts.forEach(a => {
      const b = balances[String(a._id)] || { debit: 0, credit: 0 };
      const net = b.credit - b.debit;
      if (a.type === 'revenue') { revenueRows.push({ name: a.name, amount: net }); totalRevenue += net; }
      else { expenseRows.push({ name: a.name, amount: b.debit - b.credit }); totalExpenses += (b.debit - b.credit); }
    });
    res.json({ revenue: revenueRows, expenses: expenseRows, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses });
  } catch (err) { next(err); }
};

const balanceSheet = async (req, res, next) => {
  try {
    const accounts = await Account.find({ ...tenantFilter(req), isDeleted: false, type: { $in: ['asset', 'liability', 'equity'] } });
    const entries = await JournalEntry.find({ ...tenantFilter(req), isDeleted: false, status: 'posted' });
    const balances = {};
    entries.forEach(e => {
      e.lines.forEach(l => {
        if (!l.accountId) return;
        if (!balances[l.accountId]) balances[l.accountId] = { debit: 0, credit: 0 };
        balances[l.accountId].debit += l.debit || 0;
        balances[l.accountId].credit += l.credit || 0;
      });
    });
    const assets = [], liabilities = [], equity = [];
    accounts.forEach(a => {
      const b = balances[String(a._id)] || { debit: 0, credit: 0 };
      const row = { name: a.name, amount: a.type === 'asset' ? b.debit - b.credit : b.credit - b.debit };
      if (a.type === 'asset') assets.push(row);
      else if (a.type === 'liability') liabilities.push(row);
      else equity.push(row);
    });
    const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
    const totalEquity = equity.reduce((s, r) => s + r.amount, 0);
    res.json({ assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity });
  } catch (err) { next(err); }
};

const cashFlow = async (req, res, next) => {
  try {
    res.json({ operating: 0, investing: 0, financing: 0, netCashFlow: 0, message: 'Cash flow statement requires account classification.' });
  } catch (err) { next(err); }
};

const accountLedger = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const account = await Account.findOne({ _id: accountId, ...tenantFilter(req), isDeleted: false });
    if (!account) return res.status(404).json({ code: 'Account.NotFound', description: 'Account not found.' });
    const entries = await JournalEntry.find({ ...tenantFilter(req), isDeleted: false, status: 'posted', 'lines.accountId': accountId }).sort({ entryDate: 1 });
    let runningBalance = 0;
    const lines = [];
    entries.forEach(e => {
      e.lines.filter(l => String(l.accountId) === String(accountId)).forEach(l => {
        runningBalance += (l.debit || 0) - (l.credit || 0);
        lines.push({ journalEntryId: e._id, journalNumber: e.journalNumber, date: e.entryDate || e.date || e.createdAt, description: l.description || e.description || '', debit: l.debit || 0, credit: l.credit || 0, balance: runningBalance });
      });
    });
    res.json({ accountId: account._id, accountCode: account.code || '', accountName: account.name, accountType: account.type || '', openingBalance: 0, closingBalance: runningBalance, lines });
  } catch (err) { next(err); }
};

module.exports = { summary, trialBalance, profitLoss, balanceSheet, cashFlow, accountLedger };
