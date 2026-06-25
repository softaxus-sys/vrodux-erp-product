const Brand = require('../models/Brand');
const Category = require('../models/Category');
const UoM = require('../models/UnitOfMeasure');
const { tenantFilter } = require('../../../middleware/auth');

const crudFor = (Model, name, dtoFn) => ({
  list: async (req, res, next) => {
    try {
      const f = { ...tenantFilter(req), isDeleted: false };
      if (req.query.search) f.name = { $regex: req.query.search, $options: 'i' };
      if (req.query.isActive !== undefined) f.isActive = req.query.isActive !== 'false';
      const items = await Model.find(f).sort({ name: 1 });
      res.json(items.map(dtoFn));
    } catch (err) { next(err); }
  },
  getById: async (req, res, next) => {
    try {
      const item = await Model.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
      if (!item) return res.status(404).json({ code: `${name}.NotFound`, description: `${name} not found.` });
      res.json(dtoFn(item));
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      const item = await Model.create({ ...req.body, tenantId: req.user.tenant_id });
      res.status(201).json(dtoFn(item));
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      const item = await Model.findOneAndUpdate(
        { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
        { ...req.body }, { new: true }
      );
      if (!item) return res.status(404).json({ code: `${name}.NotFound`, description: `${name} not found.` });
      res.json(dtoFn(item));
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      await Model.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true });
      res.status(204).send();
    } catch (err) { next(err); }
  },
});

const brandDto = b => ({ id: b._id, name: b.name, description: b.description, isActive: b.isActive, createdAt: b.createdAt });
const catDto   = c => ({ id: c._id, name: c.name, parentId: c.parentId, description: c.description, isActive: c.isActive, createdAt: c.createdAt });
const uomDto   = u => ({ id: u._id, name: u.name, abbreviation: u.abbreviation, isActive: u.isActive, createdAt: u.createdAt });

const brands     = crudFor(Brand, 'Brand', brandDto);
const categories = crudFor(Category, 'ProductCategory', catDto);
const uoms       = crudFor(UoM, 'UnitOfMeasure', uomDto);

module.exports = { brands, categories, uoms };
