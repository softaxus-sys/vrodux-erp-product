const { Recipe } = require('../models');
const { tenantFilter } = require('../../../middleware/auth');

const tf  = req => tenantFilter(req);
const tid = req => req.user.tenant_id;

exports.summary = async (req, res, next) => {
  try {
    const all = await Recipe.find({ ...tf(req), isDeleted: false });
    res.json({
      total: all.length,
      active: all.filter(r => r.isActive).length,
      avgCostPerServing: all.length ? all.reduce((s, r) => s + r.costPerServing, 0) / all.length : 0,
      avgMargin: all.length ? all.reduce((s, r) => s + r.margin, 0) / all.length : 0,
    });
  } catch (err) { next(err); }
};

exports.listRecipes = async (req, res, next) => {
  try {
    const f = { ...tf(req), isDeleted: false };
    if (req.query.categoryId) f.categoryId = req.query.categoryId;
    if (req.query.search) f.name = new RegExp(req.query.search, 'i');
    res.json(await Recipe.find(f).sort({ name: 1 }));
  } catch (err) { next(err); }
};

exports.getRecipeById = async (req, res, next) => {
  try {
    const r = await Recipe.findOne({ _id: req.params.id, ...tf(req), isDeleted: false });
    if (!r) return res.status(404).json({ code: 'Recipe.NotFound', description: 'Recipe not found.' });
    res.json(r);
  } catch (err) { next(err); }
};

exports.createRecipe = async (req, res, next) => {
  try {
    const ingredients = (req.body.ingredients || []).map(i => ({ ...i, lineTotal: (i.quantity || 0) * (i.costPerUnit || 0) }));
    const totalCost = ingredients.reduce((s, i) => s + i.lineTotal, 0);
    const servings = req.body.servings || 1;
    const salePrice = req.body.salePrice || 0;
    const costPerServing = servings > 0 ? totalCost / servings : 0;
    const margin = salePrice > 0 ? ((salePrice - costPerServing) / salePrice) * 100 : 0;
    const r = await Recipe.create({ ...req.body, ingredients, totalCost, costPerServing, margin, tenantId: tid(req) });
    res.status(201).json(r);
  } catch (err) { next(err); }
};

exports.updateRecipe = async (req, res, next) => {
  try {
    const ingredients = (req.body.ingredients || []).map(i => ({ ...i, lineTotal: (i.quantity || 0) * (i.costPerUnit || 0) }));
    const totalCost = ingredients.reduce((s, i) => s + i.lineTotal, 0);
    const servings = req.body.servings || 1;
    const salePrice = req.body.salePrice || 0;
    const costPerServing = servings > 0 ? totalCost / servings : 0;
    const margin = salePrice > 0 ? ((salePrice - costPerServing) / salePrice) * 100 : 0;
    const r = await Recipe.findOneAndUpdate(
      { _id: req.params.id, ...tf(req), isDeleted: false },
      { ...req.body, ingredients, totalCost, costPerServing, margin, updatedAt: new Date() },
      { new: true }
    );
    if (!r) return res.status(404).json({ code: 'Recipe.NotFound', description: 'Recipe not found.' });
    res.json(r);
  } catch (err) { next(err); }
};

exports.deleteRecipe = async (req, res, next) => {
  try {
    await Recipe.findOneAndUpdate({ _id: req.params.id, ...tf(req) }, { isDeleted: true });
    res.status(204).send();
  } catch (err) { next(err); }
};
