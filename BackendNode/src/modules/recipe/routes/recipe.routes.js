const router = require('express').Router();
const c      = require('../controllers/recipe.controller');
const { authenticate } = require('../../../middleware/auth');

router.use(authenticate);
router.get('/summary',   c.summary);
router.get('/',          c.listRecipes);
router.get('/:id',       c.getRecipeById);
router.post('/',         c.createRecipe);
router.put('/:id',       c.updateRecipe);
router.delete('/:id',    c.deleteRecipe);

module.exports = router;
