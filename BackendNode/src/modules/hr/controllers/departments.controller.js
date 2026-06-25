const Department = require('../models/Department');
const { tenantFilter } = require('../../../middleware/auth');

const dto = d => ({ id: d._id, name: d.name, description: d.description, managerId: d.managerId, createdAt: d.createdAt });

exports.list = async (req, res, next) => {
  try {
    const items = await Department.find({ ...tenantFilter(req), isDeleted: false }).sort({ name: 1 });
    return res.json(items.map(dto));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const d = await Department.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!d) return res.status(404).json({ code: 'Department.NotFound', description: 'Department not found.' });
    return res.json(dto(d));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const d = await Department.create({ ...req.body, tenantId: req.user.tenant_id });
    return res.status(201).json(dto(d));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const d = await Department.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { ...req.body });
    if (!d) return res.status(404).json({ code: 'Department.NotFound', description: 'Department not found.' });
    return res.status(204).send();
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Department.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
    return res.status(204).send();
  } catch (err) { next(err); }
};
