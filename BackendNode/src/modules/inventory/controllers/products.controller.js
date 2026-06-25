const Product = require('../models/Product');
const ProductStock = require('../models/ProductStock');
const StockMovement = require('../models/StockMovement');
const { tenantFilter } = require('../../../middleware/auth');
const { paged, parsePaging } = require('../../../utils/helpers');

const dto = p => ({
  id: p._id, name: p.name, sku: p.sku, barcode: p.barcode, description: p.description,
  categoryId: p.categoryId, categoryName: p.categoryName, brandId: p.brandId, brandName: p.brandName,
  uomId: p.uomId, uomName: p.uomName, costPrice: p.costPrice, sellingPrice: p.sellingPrice,
  taxRate: p.taxRate, reorderLevel: p.reorderLevel, isActive: p.isActive, imageUrl: p.imageUrl,
  createdAt: p.createdAt,
});

const list = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePaging(req.query);
    const f = { ...tenantFilter(req), isDeleted: false };
    if (req.query.isActive !== undefined) f.isActive = req.query.isActive !== 'false';
    if (req.query.categoryId) f.categoryId = req.query.categoryId;
    if (req.query.brandId) f.brandId = req.query.brandId;
    if (req.query.search) f.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { sku: { $regex: req.query.search, $options: 'i' } },
    ];
    const [items, total] = await Promise.all([
      Product.find(f).sort({ name: 1 }).skip(skip).limit(pageSize),
      Product.countDocuments(f),
    ]);
    res.json(paged(items.map(dto), total, page, pageSize));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const p = await Product.findOne({ _id: req.params.id, ...tenantFilter(req), isDeleted: false });
    if (!p) return res.status(404).json({ code: 'Product.NotFound', description: 'Product not found.' });
    res.json(dto(p));
  } catch (err) { next(err); }
};

const getByBarcode = async (req, res, next) => {
  try {
    const p = await Product.findOne({ barcode: req.params.barcode, ...tenantFilter(req), isDeleted: false });
    if (!p) return res.status(404).json({ code: 'Product.NotFound', description: 'Product not found.' });
    res.json(dto(p));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const p = await Product.create({ ...req.body, tenantId: req.user.tenant_id });
    await ProductStock.create({ tenantId: req.user.tenant_id, productId: String(p._id), productName: p.name });
    res.status(201).json(dto(p));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const p = await Product.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), isDeleted: false },
      { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!p) return res.status(404).json({ code: 'Product.NotFound', description: 'Product not found.' });
    res.json(dto(p));
  } catch (err) { next(err); }
};

const activate = async (req, res, next) => {
  try {
    await Product.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isActive: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

const deactivate = async (req, res, next) => {
  try {
    await Product.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isActive: false, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await Product.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, { isDeleted: true, updatedAt: new Date() });
    res.status(204).send();
  } catch (err) { next(err); }
};

const getStock = async (req, res, next) => {
  try {
    const stock = await ProductStock.findOne({ productId: req.params.id, ...tenantFilter(req) });
    res.json(stock ? { productId: stock.productId, totalQty: stock.totalQty, updatedAt: stock.updatedAt } : { productId: req.params.id, totalQty: 0 });
  } catch (err) { next(err); }
};

const getBatches = async (req, res, next) => {
  try {
    const stock = await ProductStock.findOne({ productId: req.params.id, ...tenantFilter(req) });
    res.json(stock ? stock.batches : []);
  } catch (err) { next(err); }
};

module.exports = { list, getById, getByBarcode, create, update, activate, deactivate, remove, getStock, getBatches };
