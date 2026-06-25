const Customer = require('../models/Customer');
const { tenantFilter } = require('../../../middleware/auth');

const dto = c => ({ id: c._id, name: c.name, email: c.email, phone: c.phone, address: c.address, taxNumber: c.taxNumber, isActive: c.isActive, createdAt: c.createdAt });

exports.list = async (req, res, next) => {
  try {
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.search) f.name = { $regex: req.query.search, $options: 'i' };
    if (req.query.isActive !== undefined) f.isActive = req.query.isActive !== 'false';
    const items = await Customer.find(f).sort({ name: 1 });
    res.json(items.map(dto));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const c = await Customer.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!c) return res.status(404).json({ code: 'Customer.NotFound', description: 'Customer not found.' });
    res.json(dto(c));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const c = await Customer.create({ ...req.body, tenantId: req.user.tenant_id });
    res.status(201).json(dto(c));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const c = await Customer.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req), isDeleted: false }, { ...req.body }, { new: true });
    if (!c) return res.status(404).json({ code: 'Customer.NotFound', description: 'Customer not found.' });
    res.json(dto(c));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Customer.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};
