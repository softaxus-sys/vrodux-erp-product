const JournalEntry = require('../models/JournalEntry');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

// Frontend JournalEntryDto expects: date (not entryDate), isBalanced, createdBy, lines with accountCode
const dto = j => ({
  id:           j._id,
  journalNumber:j.journalNumber,
  period:       j.period,
  date:         j.entryDate || j.date || j.createdAt,  // frontend expects date
  entryDate:    j.entryDate || j.date || null,
  reference:    j.reference || '',
  description:  j.description || '',
  status:       j.status,
  totalDebit:   j.totalDebit || 0,
  totalCredit:  j.totalCredit || 0,
  isBalanced:   Math.abs((j.totalDebit || 0) - (j.totalCredit || 0)) < 0.01,
  createdBy:    j.createdBy || '',
  postedBy:     j.postedBy || null,
  postedDate:   j.postedDate || null,
  lines:        (j.lines || []).map(l => ({
    id:          l._id,
    accountCode: l.accountCode || l.accountId || '',
    accountName: l.accountName || '',
    debit:       l.debit || 0,
    credit:      l.credit || 0,
    description: l.description || l.memo || '',
  })),
  createdAt:    j.createdAt,
});

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.status) f.status = req.query.status;
    if (req.query.period) f.period = req.query.period;
    const [items, total] = await Promise.all([
      JournalEntry.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      JournalEntry.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const j = await JournalEntry.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!j) return res.status(404).json({ code: 'JournalEntry.NotFound', description: 'Journal entry not found.' });
    res.json(dto(j));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { lines = [], ...rest } = req.body;
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    const count = await JournalEntry.countDocuments({ tenantId: req.user.tenant_id });
    const journalNumber = `JE-${String(count + 1).padStart(5, '0')}`;
    const j = await JournalEntry.create({
      ...rest, lines, totalDebit, totalCredit, journalNumber, tenantId: req.user.tenant_id,
    });
    res.status(201).json(dto(j));
  } catch (err) { next(err); }
};

const post = async (req, res, next) => {
  try {
    const j = await JournalEntry.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!j) return res.status(404).json({ code: 'JournalEntry.NotFound', description: 'Journal entry not found.' });
    if (j.status !== 'draft') return res.status(400).json({ code: 'JournalEntry.InvalidStatus', description: 'Only draft entries can be posted.' });
    j.status = 'posted'; j.updatedAt = new Date();
    await j.save();
    res.json(dto(j));
  } catch (err) { next(err); }
};

const voidEntry = async (req, res, next) => {
  try {
    const j = await JournalEntry.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!j) return res.status(404).json({ code: 'JournalEntry.NotFound', description: 'Journal entry not found.' });
    if (j.status !== 'posted') return res.status(400).json({ code: 'JournalEntry.InvalidStatus', description: 'Only posted entries can be voided.' });
    j.status = 'voided'; j.updatedAt = new Date();
    await j.save();
    res.json(dto(j));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const j = await JournalEntry.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!j) return res.status(404).json({ code: 'JournalEntry.NotFound', description: 'Journal entry not found.' });
    if (j.status === 'posted') return res.status(400).json({ code: 'JournalEntry.CannotDelete', description: 'Posted entries cannot be deleted.' });
    j.isDeleted = true; j.updatedAt = new Date();
    await j.save();
    res.status(204).send();
  } catch (err) { next(err); }
};

const summary = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req), isDeleted: false };
    const all = await JournalEntry.find(f);
    const posted = all.filter(j => j.status === 'posted');
    const totalDebit  = posted.reduce((s, j) => s + (j.totalDebit  || 0), 0);
    const totalCredit = posted.reduce((s, j) => s + (j.totalCredit || 0), 0);
    res.json({ totalEntries: all.length, postedEntries: posted.length, draftEntries: all.filter(j => j.status === 'draft').length, voidedEntries: all.filter(j => j.status === 'voided').length, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 });
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, post, voidEntry, remove, summary };
