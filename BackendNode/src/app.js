const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const { errorHandler } = require('./middleware/error');

const authRoutes     = require('./modules/identity/routes/auth.routes');
const userRoutes     = require('./modules/identity/routes/users.routes');
const roleRoutes     = require('./modules/identity/routes/roles.routes');
const idExtRoutes    = require('./modules/identity/routes/extensions.routes');
const hrRoutes       = require('./modules/hr/routes/hr.routes');
const { careersRouter } = require('./modules/hr/routes/hr.routes');
const finRoutes      = require('./modules/finance/routes/finance.routes');
const invRoutes      = require('./modules/inventory/routes/inventory.routes');
const salesRoutes    = require('./modules/sales/routes/sales.routes');
const purRoutes      = require('./modules/purchase/routes/purchase.routes');
const crmRoutes      = require('./modules/crm/routes/crm.routes');
const pmRoutes       = require('./modules/projectManagement/routes/pm.routes');
const posRoutes      = require('./modules/pos/routes/pos.routes');
const constrRoutes   = require('./modules/construction/routes/construction.routes');
const reRoutes       = require('./modules/realEstate/routes/realEstate.routes');
const hospRoutes     = require('./modules/hospitality/routes/hospitality.routes');
const restRoutes     = require('./modules/restaurant/routes/restaurant.routes');
const recipeRoutes   = require('./modules/recipe/routes/recipe.routes');

const app = express();

const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'VroduxERP Node API', timestamp: new Date().toISOString() }));

// Identity
app.use('/api/auth',              authRoutes);
app.use('/api/users',             userRoutes);
app.use('/api/roles',             roleRoutes);
app.use('/api',                   idExtRoutes);  // /api/branches, /api/audit-logs, /api/settings, /api/admin/*, /api/license, /api/trial

// Public careers (no auth)
app.use('/api/careers',           careersRouter);

// Business modules
app.use('/api/hr',                hrRoutes);
app.use('/api/finance',           finRoutes);
app.use('/api/inventory',         invRoutes);
app.use('/api/sales',             salesRoutes);
app.use('/api/purchase',          purRoutes);
app.use('/api/crm',               crmRoutes);
app.use('/api/projectmanagement', pmRoutes);

// Industry modules
app.use('/api/pos',               posRoutes);
app.use('/api/construction',      constrRoutes);
app.use('/api/real-estate',       reRoutes);
app.use('/api/hospitality',       hospRoutes);
app.use('/api/restaurant',        restRoutes);
app.use('/api/recipes',           recipeRoutes);

// 404
app.use((req, res) => res.status(404).json({ code: 'Route.NotFound', description: `No route: ${req.method} ${req.path}` }));

app.use(errorHandler);

module.exports = app;
