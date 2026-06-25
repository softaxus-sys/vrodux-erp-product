const Warehouse = require('../models/Warehouse');
const { tenantFilter } = require('../../../middleware/auth');

const dto = w => ({
  id: w._id, name: w.name, code: w.code, address: w.address, city: w.city,
  country: w.country, contactName: w.contactName, contactPhone: w.contactPhone,
  isDefault: w.isDefault, isActive: w.isActive, createdAt: w.createdAt,
});

const list = async (req, res, next) => {
  try {
    const items = await Warehouse.find({ ...tenantFilter(req), isDeleted: false }).sort({ name: 1 });
    res.json(items.map(dto));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const w = await Warehouse.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!w) return res.status(404).json({ code: 'Warehouse.NotFound', description: 'Warehouse not found.' });
    res.json(dto(w));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    if (req.body.isDefault) await Warehouse.updateMany({ tenantId: req.user.tenant_id }, { isDefault: false });
    const w = await Warehouse.create({ ...req.body, tenantId: req.user.tenant_id });
    res.status(201).json(dto(w));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    if (req.body.isDefault) await Warehouse.updateMany({ tenantId: req.user.tenant_id }, { isDefault: false });
    const w = await Warehouse.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!w) return res.status(404).json({ code: 'Warehouse.NotFound', description: 'Warehouse not found.' });
    res.json(dto(w));
  } catch (err) { next(err); }
};

const setDefault = async (req, res, next) => {
  try {
    await Warehouse.updateMany({ tenantId: req.user.tenant_id }, { isDefault: false });
    await Warehouse.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDefault: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await Warehouse.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, setDefault, remove };
