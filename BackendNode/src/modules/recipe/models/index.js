const mongoose = require('mongoose');

const ingredientLineSchema = new mongoose.Schema({
  inventoryItemId: String,
  itemName:        String,
  quantity:        { type: Number, required: true },
  unit:            String,
  costPerUnit:     { type: Number, default: 0 },
  lineTotal:       { type: Number, default: 0 },
}, { _id: true });

const recipeSchema = new mongoose.Schema({
  tenantId:        { type: String, required: true, index: true },
  name:            { type: String, required: true },
  categoryId:      String,
  categoryName:    String,
  menuItemId:      String,
  servings:        { type: Number, default: 1 },
  preparationTime: Number,
  cookingTime:     Number,
  instructions:    String,
  ingredients:     [ingredientLineSchema],
  totalCost:       { type: Number, default: 0 },
  costPerServing:  { type: Number, default: 0 },
  salePrice:       { type: Number, default: 0 },
  margin:          { type: Number, default: 0 },
  isActive:        { type: Boolean, default: true },
  isDeleted:       { type: Boolean, default: false },
  createdAt:       { type: Date, default: Date.now },
  updatedAt:       Date,
}, { versionKey: false });

module.exports = {
  Recipe: mongoose.model('Recipe', recipeSchema),
};
