require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

const User       = require('../modules/identity/models/User');
const Role       = require('../modules/identity/models/Role');
const Permission = require('../modules/identity/models/Permission');
const Tenant     = require('../modules/identity/models/Tenant');

// HR
const Employee   = require('../modules/hr/models/Employee');
const Department = require('../modules/hr/models/Department');
const Leave      = require('../modules/hr/models/Leave');
const Attendance = require('../modules/hr/models/Attendance');

// Finance
const Account    = require('../modules/finance/models/Account');
const Invoice    = require('../modules/finance/models/Invoice');
const Expense    = require('../modules/finance/models/Expense');
const Supplier   = require('../modules/finance/models/Supplier');
const { FinanceCustomer } = require('../modules/finance/models/FinanceExtensions');

// Inventory
const Product      = require('../modules/inventory/models/Product');
const Warehouse    = require('../modules/inventory/models/Warehouse');
const Brand        = require('../modules/inventory/models/Brand');
const Category     = require('../modules/inventory/models/Category');
const UnitOfMeasure= require('../modules/inventory/models/UnitOfMeasure');
const ProductStock = require('../modules/inventory/models/ProductStock');

// Sales & Purchase
const Customer      = require('../modules/sales/models/Customer');
const SalesOrder    = require('../modules/sales/models/SalesOrder');
const PurchaseOrder = require('../modules/purchase/models/PurchaseOrder');
const { Vendor }    = require('../modules/purchase/models/PurchaseExtensions');

// CRM
const Lead    = require('../modules/crm/models/Lead');
const Contact = require('../modules/crm/models/Contact');
const Deal    = require('../modules/crm/models/Deal');

// Project Management
const Project     = require('../modules/projectManagement/models/Project');
const BoardColumn = require('../modules/projectManagement/models/BoardColumn');
const Issue       = require('../modules/projectManagement/models/Issue');

// ─────────────────────────────────────────────────────────────────────────────

const log = (msg) => console.log(`  ✓ ${msg}`);

const TODAY      = new Date().toISOString().split('T')[0];
const LAST_MONTH = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
const NEXT_MONTH = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

// ─── PERMISSIONS ─────────────────────────────────────────────────────────────
const MODULES = ['pos','inventory','finance','hr','sales','purchase','crm','project-management','settings'];
const RESOURCES = {
  'pos':               ['products','orders','sessions','customers','vendors','reports'],
  'inventory':         ['products','warehouses','stock-movements','stock-transfers','brands','categories','units'],
  'finance':           ['invoices','accounts','journal-entries','banking','expenses','budgets','purchase-bills','gl','recurring','vouchers'],
  'hr':                ['employees','departments','attendance','leaves','payroll','performance','recruitment'],
  'sales':             ['orders','delivery-challans','returns','customers','quotations'],
  'purchase':          ['orders','grn','returns','vendors','approvals'],
  'crm':               ['leads','contacts','deals','activities'],
  'project-management':['projects','boards','labels','sprints','issues'],
  'settings':          ['users','roles','permissions','tenants','branches'],
};
const ACTIONS = ['view','create','edit','delete'];

async function seedPermissions() {
  console.log('\n📋 Seeding permissions...');
  const perms = [];
  for (const mod of MODULES) {
    for (const res of (RESOURCES[mod] || [mod])) {
      for (const action of ACTIONS) {
        perms.push({ moduleId: `${mod}.${res}`, action });
      }
    }
  }
  for (const p of perms) {
    await Permission.findOneAndUpdate({ moduleId: p.moduleId, action: p.action }, p, { upsert: true, new: true });
  }
  log(`${perms.length} permissions`);
  return Permission.find({});
}

// ─── TENANT ──────────────────────────────────────────────────────────────────
async function seedTenant() {
  console.log('\n🏢 Seeding tenant...');
  let tenant = await Tenant.findOne({ slug: 'vrodux-demo' });
  if (!tenant) {
    tenant = await Tenant.create({
      slug: 'vrodux-demo', name: 'VroduxERP Demo Company',
      plan: 'enterprise', industry: 'retail', status: 'active',
      modules: MODULES,
      email: 'info@vroduxerp.com', phone: '+971 4 123 4567',
      address: 'Dubai, UAE', currency: 'AED',
    });
    log('Created tenant: VroduxERP Demo Company');
  } else {
    log('Tenant already exists');
  }
  return tenant;
}

// ─── ROLES ───────────────────────────────────────────────────────────────────
async function seedRoles(tenantId, allPerms) {
  console.log('\n🔐 Seeding roles...');
  const tid = String(tenantId);

  const rolesDef = [
    { name: 'Administrator',   description: 'Full system access',          isSystem: true,  perms: allPerms.map(p => p._id) },
    { name: 'HR Manager',      description: 'HR module full access',       isSystem: false, perms: allPerms.filter(p => p.moduleId.startsWith('hr.')).map(p => p._id) },
    { name: 'Finance Manager', description: 'Finance module full access',  isSystem: false, perms: allPerms.filter(p => p.moduleId.startsWith('finance.')).map(p => p._id) },
    { name: 'Sales Executive', description: 'Sales & CRM access',         isSystem: false, perms: allPerms.filter(p => p.moduleId.startsWith('sales.') || p.moduleId.startsWith('crm.')).map(p => p._id) },
    { name: 'Warehouse Staff', description: 'Inventory view/edit',        isSystem: false, perms: allPerms.filter(p => p.moduleId.startsWith('inventory.') && ['view','edit'].includes(p.action)).map(p => p._id) },
    { name: 'Viewer',          description: 'Read-only access to all',     isSystem: false, perms: allPerms.filter(p => p.action === 'view').map(p => p._id) },
  ];

  const roles = {};
  for (const def of rolesDef) {
    let role = await Role.findOne({ tenantId: tid, name: def.name });
    if (!role) {
      role = await Role.create({ tenantId: tid, name: def.name, description: def.description, isSystem: def.isSystem, permissions: def.perms });
      log(`Role: ${def.name}`);
    } else {
      log(`Role exists: ${def.name}`);
    }
    roles[def.name] = role;
  }
  return roles;
}

// ─── USERS ───────────────────────────────────────────────────────────────────
async function seedUsers(tenantId, roles) {
  console.log('\n👤 Seeding users...');
  const tid = String(tenantId);

  const usersDef = [
    { email: 'admin@vroduxerp.com',   firstName: 'System',   lastName: 'Admin',    username: 'admin',    password: 'Admin@123456',  isSuperAdmin: true,  role: 'Administrator' },
    { email: 'hr@vroduxerp.com',      firstName: 'Sarah',    lastName: 'Johnson',  username: 'sarah.hr', password: 'Hr@123456',     isSuperAdmin: false, role: 'HR Manager' },
    { email: 'finance@vroduxerp.com', firstName: 'Michael',  lastName: 'Chen',     username: 'michael.f',password: 'Finance@123456',isSuperAdmin: false, role: 'Finance Manager' },
    { email: 'sales@vroduxerp.com',   firstName: 'Emily',    lastName: 'Davis',    username: 'emily.s',  password: 'Sales@123456',  isSuperAdmin: false, role: 'Sales Executive' },
    { email: 'store@vroduxerp.com',   firstName: 'Omar',     lastName: 'Al-Hassan',username: 'omar.w',   password: 'Store@123456',  isSuperAdmin: false, role: 'Warehouse Staff' },
    { email: 'viewer@vroduxerp.com',  firstName: 'Alex',     lastName: 'Kim',      username: 'alex.v',   password: 'Viewer@123456', isSuperAdmin: false, role: 'Viewer' },
  ];

  const users = {};
  for (const def of usersDef) {
    let user = await User.findOne({ email: def.email });
    if (!user) {
      const hash = await User.hashPassword(def.password);
      user = await User.create({
        tenantId: tid, username: def.username,
        firstName: def.firstName, lastName: def.lastName,
        email: def.email, passwordHash: hash,
        isSuperAdmin: def.isSuperAdmin, status: 'active',
        roles: roles[def.role] ? [roles[def.role]._id] : [],
      });
      log(`User: ${def.email} / ${def.password}`);
    } else {
      log(`User exists: ${def.email}`);
    }
    users[def.email] = user;
  }
  return users;
}

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
async function seedDepartments(tenantId) {
  console.log('\n🏬 Seeding departments...');
  const tid = String(tenantId);
  const depts = ['Human Resources','Finance & Accounting','Sales & Marketing','Operations','Information Technology','Warehouse & Logistics','Customer Service'];
  const result = {};
  for (const name of depts) {
    let d = await Department.findOne({ tenantId: tid, name });
    if (!d) { d = await Department.create({ tenantId: tid, name, isActive: true }); log(`Dept: ${name}`); }
    result[name] = d;
  }
  return result;
}

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────
async function seedEmployees(tenantId, depts) {
  console.log('\n👩‍💼 Seeding employees...');
  const tid = String(tenantId);

  const empDef = [
    { employeeNumber:'EMP-0001', firstName:'Sarah',   lastName:'Johnson',  email:'sarah.j@company.com',   jobTitle:'HR Manager',          departmentName:'Human Resources',        basicSalary:12000, employmentType:'full_time', joiningDate:'2022-03-01' },
    { employeeNumber:'EMP-0002', firstName:'Michael', lastName:'Chen',     email:'michael.c@company.com',  jobTitle:'Finance Manager',      departmentName:'Finance & Accounting',   basicSalary:14000, employmentType:'full_time', joiningDate:'2021-06-15' },
    { employeeNumber:'EMP-0003', firstName:'Emily',   lastName:'Davis',    email:'emily.d@company.com',    jobTitle:'Sales Executive',      departmentName:'Sales & Marketing',      basicSalary:9000,  employmentType:'full_time', joiningDate:'2023-01-10' },
    { employeeNumber:'EMP-0004', firstName:'Omar',    lastName:'Al-Hassan',email:'omar.h@company.com',     jobTitle:'Warehouse Manager',    departmentName:'Warehouse & Logistics',  basicSalary:8500,  employmentType:'full_time', joiningDate:'2022-09-01' },
    { employeeNumber:'EMP-0005', firstName:'Priya',   lastName:'Sharma',   email:'priya.s@company.com',    jobTitle:'Software Developer',   departmentName:'Information Technology', basicSalary:13000, employmentType:'full_time', joiningDate:'2023-04-20' },
    { employeeNumber:'EMP-0006', firstName:'James',   lastName:'Wilson',   email:'james.w@company.com',    jobTitle:'Sales Manager',        departmentName:'Sales & Marketing',      basicSalary:11000, employmentType:'full_time', joiningDate:'2021-11-05' },
    { employeeNumber:'EMP-0007', firstName:'Fatima',  lastName:'Al-Rashid',email:'fatima.r@company.com',   jobTitle:'HR Specialist',        departmentName:'Human Resources',        basicSalary:8000,  employmentType:'full_time', joiningDate:'2023-07-01' },
    { employeeNumber:'EMP-0008', firstName:'David',   lastName:'Brown',    email:'david.b@company.com',    jobTitle:'Accountant',           departmentName:'Finance & Accounting',   basicSalary:9500,  employmentType:'full_time', joiningDate:'2022-05-15' },
    { employeeNumber:'EMP-0009', firstName:'Aisha',   lastName:'Mohammed', email:'aisha.m@company.com',    jobTitle:'Customer Service Rep', departmentName:'Customer Service',       basicSalary:6500,  employmentType:'full_time', joiningDate:'2024-01-08' },
    { employeeNumber:'EMP-0010', firstName:'Carlos',  lastName:'Rodriguez',email:'carlos.r@company.com',   jobTitle:'Operations Manager',   departmentName:'Operations',             basicSalary:12500, employmentType:'full_time', joiningDate:'2021-08-20' },
  ];

  const employees = {};
  for (const def of empDef) {
    let emp = await Employee.findOne({ tenantId: tid, employeeNumber: def.employeeNumber });
    if (!emp) {
      emp = await Employee.create({
        tenantId: tid, ...def,
        phone: '+971 50 ' + Math.floor(1000000 + Math.random() * 9000000),
        currency: 'AED', status: 'active',
        gender: ['male','female'][Math.floor(Math.random()*2)],
        nationality: ['Emirati','Indian','Pakistani','Egyptian','Filipino'][Math.floor(Math.random()*5)],
      });
      log(`Employee: ${def.employeeNumber} — ${def.firstName} ${def.lastName}`);
    }
    employees[def.employeeNumber] = emp;
  }
  return employees;
}

// ─── CHART OF ACCOUNTS ───────────────────────────────────────────────────────
async function seedAccounts(tenantId) {
  console.log('\n📊 Seeding chart of accounts...');
  const tid = String(tenantId);

  const accounts = [
    { code:'1000', name:'Cash & Cash Equivalents',     type:'asset',     subtype:'current_asset',    balance:250000 },
    { code:'1100', name:'Accounts Receivable',          type:'asset',     subtype:'current_asset',    balance:85000  },
    { code:'1200', name:'Inventory',                    type:'asset',     subtype:'current_asset',    balance:320000 },
    { code:'1300', name:'Prepaid Expenses',             type:'asset',     subtype:'current_asset',    balance:12000  },
    { code:'1500', name:'Property & Equipment',         type:'asset',     subtype:'fixed_asset',      balance:500000 },
    { code:'1600', name:'Accumulated Depreciation',     type:'asset',     subtype:'fixed_asset',      balance:-80000 },
    { code:'2000', name:'Accounts Payable',             type:'liability', subtype:'current_liability',balance:45000  },
    { code:'2100', name:'Accrued Liabilities',          type:'liability', subtype:'current_liability',balance:18000  },
    { code:'2200', name:'VAT Payable',                  type:'liability', subtype:'current_liability',balance:9500   },
    { code:'2500', name:'Bank Loan',                    type:'liability', subtype:'long_term_liability',balance:200000},
    { code:'3000', name:'Owner\'s Capital',             type:'equity',    subtype:'owners_equity',    balance:600000 },
    { code:'3100', name:'Retained Earnings',            type:'equity',    subtype:'retained_earnings', balance:224500 },
    { code:'4000', name:'Sales Revenue',                type:'revenue',   subtype:'operating_revenue', balance:890000 },
    { code:'4100', name:'Service Revenue',              type:'revenue',   subtype:'operating_revenue', balance:120000 },
    { code:'4900', name:'Other Income',                 type:'revenue',   subtype:'other_revenue',     balance:15000  },
    { code:'5000', name:'Cost of Goods Sold',           type:'expense',   subtype:'cost_of_goods',     balance:445000 },
    { code:'6000', name:'Salaries & Wages',             type:'expense',   subtype:'operating_expense', balance:180000 },
    { code:'6100', name:'Rent Expense',                 type:'expense',   subtype:'operating_expense', balance:48000  },
    { code:'6200', name:'Utilities Expense',            type:'expense',   subtype:'operating_expense', balance:9600   },
    { code:'6300', name:'Marketing & Advertising',      type:'expense',   subtype:'operating_expense', balance:24000  },
    { code:'6400', name:'Depreciation Expense',         type:'expense',   subtype:'operating_expense', balance:20000  },
    { code:'6500', name:'Office Supplies',              type:'expense',   subtype:'operating_expense', balance:3600   },
    { code:'6600', name:'Insurance Expense',            type:'expense',   subtype:'operating_expense', balance:12000  },
    { code:'6700', name:'Travel & Entertainment',       type:'expense',   subtype:'operating_expense', balance:8400   },
  ];

  for (const acc of accounts) {
    await Account.findOneAndUpdate({ tenantId: tid, code: acc.code }, { tenantId: tid, ...acc, isActive: true }, { upsert: true, new: true });
  }
  log(`${accounts.length} accounts`);
}

// ─── BRANDS & CATEGORIES & UOM ───────────────────────────────────────────────
async function seedMasterData(tenantId) {
  console.log('\n🏷️  Seeding master data (brands, categories, UoM)...');
  const tid = String(tenantId);

  const brands = ['Apple','Samsung','Sony','LG','HP','Dell','Lenovo','Philips','Bosch','Generic'];
  const brandDocs = {};
  for (const name of brands) {
    let b = await Brand.findOne({ tenantId: tid, name });
    if (!b) b = await Brand.create({ tenantId: tid, name, isActive: true });
    brandDocs[name] = b;
  }
  log(`${brands.length} brands`);

  const cats = ['Electronics','Smartphones','Laptops','Accessories','Home Appliances','Office Supplies','Audio & Video','Networking','Storage','Software'];
  const catDocs = {};
  for (const name of cats) {
    let c = await Category.findOne({ tenantId: tid, name });
    if (!c) c = await Category.create({ tenantId: tid, name, isActive: true });
    catDocs[name] = c;
  }
  log(`${cats.length} categories`);

  const uoms = [
    { name:'Piece', abbreviation:'pcs' },{ name:'Box', abbreviation:'box' },
    { name:'Kilogram', abbreviation:'kg' },{ name:'Litre', abbreviation:'ltr' },
    { name:'Meter', abbreviation:'mtr' },{ name:'Dozen', abbreviation:'doz' },
    { name:'Set', abbreviation:'set' },{ name:'Pack', abbreviation:'pack' },
  ];
  const uomDocs = {};
  for (const u of uoms) {
    let doc = await UnitOfMeasure.findOne({ tenantId: tid, name: u.name });
    if (!doc) doc = await UnitOfMeasure.create({ tenantId: tid, ...u, isActive: true });
    uomDocs[u.name] = doc;
  }
  log(`${uoms.length} units of measure`);

  return { brandDocs, catDocs, uomDocs };
}

// ─── WAREHOUSES ──────────────────────────────────────────────────────────────
async function seedWarehouses(tenantId) {
  console.log('\n🏭 Seeding warehouses...');
  const tid = String(tenantId);

  const warehouses = [
    { name:'Main Warehouse', code:'WH-001', address:'Industrial Area, Dubai', isDefault: true  },
    { name:'Retail Store',   code:'WH-002', address:'Mall of Emirates, Dubai', isDefault: false },
    { name:'Online Fulfillment', code:'WH-003', address:'Jebel Ali Free Zone', isDefault: false },
  ];
  const whDocs = {};
  for (const wh of warehouses) {
    let doc = await Warehouse.findOne({ tenantId: tid, code: wh.code });
    if (!doc) { doc = await Warehouse.create({ tenantId: tid, ...wh, isActive: true }); log(`Warehouse: ${wh.name}`); }
    whDocs[wh.code] = doc;
  }
  return whDocs;
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
async function seedProducts(tenantId, masterData, warehouses) {
  console.log('\n📦 Seeding products...');
  const tid = String(tenantId);
  const { brandDocs, catDocs, uomDocs } = masterData;

  const productsDef = [
    { sku:'APPL-IP15-128', name:'iPhone 15 128GB',         barcode:'840244600017', category:'Smartphones',   brand:'Apple',   uom:'Piece', costPrice:2800, sellingPrice:3499, stockQty:45, reorderPoint:10 },
    { sku:'SAMS-S24-256',  name:'Samsung Galaxy S24 256GB', barcode:'887276700892', category:'Smartphones',   brand:'Samsung', uom:'Piece', costPrice:2200, sellingPrice:2799, stockQty:32, reorderPoint:8  },
    { sku:'DELL-XPS15-16', name:'Dell XPS 15 16GB RAM',    barcode:'884116403449', category:'Laptops',        brand:'Dell',    uom:'Piece', costPrice:4500, sellingPrice:5499, stockQty:18, reorderPoint:5  },
    { sku:'HP-ELITE-840',  name:'HP EliteBook 840 G10',    barcode:'196548965521', category:'Laptops',        brand:'HP',      uom:'Piece', costPrice:3800, sellingPrice:4699, stockQty:22, reorderPoint:5  },
    { sku:'SONY-WH1000',   name:'Sony WH-1000XM5 Headphones',barcode:'027242924741',category:'Audio & Video', brand:'Sony',    uom:'Piece', costPrice:900,  sellingPrice:1299, stockQty:60, reorderPoint:15 },
    { sku:'APPL-WATCH-S9', name:'Apple Watch Series 9 45mm',barcode:'840244601984', category:'Electronics',   brand:'Apple',   uom:'Piece', costPrice:1400, sellingPrice:1799, stockQty:28, reorderPoint:8  },
    { sku:'LG-OLED55-C3',  name:'LG OLED 55" C3 Smart TV', barcode:'195174034001', category:'Home Appliances',brand:'LG',      uom:'Piece', costPrice:4200, sellingPrice:5299, stockQty:12, reorderPoint:4  },
    { sku:'PHIL-AIRFRYER', name:'Philips Air Fryer 5.6L',  barcode:'075020088154', category:'Home Appliances',brand:'Philips', uom:'Piece', costPrice:450,  sellingPrice:649,  stockQty:35, reorderPoint:10 },
    { sku:'LOGI-MX-KEYS',  name:'Logitech MX Keys Keyboard',barcode:'097855162038',category:'Accessories',    brand:'Generic', uom:'Piece', costPrice:280,  sellingPrice:399,  stockQty:50, reorderPoint:12 },
    { sku:'LOGI-MX-MASTER',name:'Logitech MX Master 3S Mouse',barcode:'097855178275',category:'Accessories',  brand:'Generic', uom:'Piece', costPrice:200,  sellingPrice:299,  stockQty:65, reorderPoint:15 },
    { sku:'SAMSG-T7-1TB',  name:'Samsung T7 Portable SSD 1TB',barcode:'887276408583',category:'Storage',      brand:'Samsung', uom:'Piece', costPrice:320,  sellingPrice:449,  stockQty:40, reorderPoint:10 },
    { sku:'ANKER-HUB-7',   name:'Anker 7-Port USB Hub',    barcode:'848061096298', category:'Networking',     brand:'Generic', uom:'Piece', costPrice:85,   sellingPrice:149,  stockQty:80, reorderPoint:20 },
  ];

  const wh = Object.values(warehouses)[0];
  const products = {};
  for (const def of productsDef) {
    let prod = await Product.findOne({ tenantId: tid, sku: def.sku });
    if (!prod) {
      prod = await Product.create({
        tenantId: tid, sku: def.sku, name: def.name, barcode: def.barcode,
        categoryId: String(catDocs[def.category]?._id || ''),
        categoryName: def.category,
        brandId: String(brandDocs[def.brand]?._id || ''),
        brandName: def.brand,
        uomId: String(uomDocs[def.uom]?._id || ''),
        uomName: def.uom,
        costPrice: def.costPrice, sellingPrice: def.sellingPrice,
        stockQty: def.stockQty, reorderPoint: def.reorderPoint,
        isActive: true, trackInventory: true,
      });
      await ProductStock.findOneAndUpdate(
        { tenantId: tid, productId: String(prod._id) },
        { tenantId: tid, productId: String(prod._id), totalQty: def.stockQty,
          batches: [{ warehouseId: String(wh._id), warehouseName: wh.name, quantity: def.stockQty, receivedAt: new Date() }] },
        { upsert: true, new: true }
      );
      log(`Product: ${def.sku} — ${def.name}`);
    }
    products[def.sku] = prod;
  }
  return products;
}

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
async function seedCustomers(tenantId) {
  console.log('\n🤝 Seeding customers...');
  const tid = String(tenantId);

  const custDef = [
    { name:'Al Fardan Electronics',  email:'purchasing@alfardan.ae',    phone:'+971 4 345 6789', address:'Deira, Dubai',          creditLimit:50000  },
    { name:'Carrefour UAE',          email:'procurement@carrefour.ae',  phone:'+971 4 567 8901', address:'Dubai Festival City',   creditLimit:200000 },
    { name:'Jumbo Electronics',      email:'orders@jumbo.ae',           phone:'+971 4 234 5678', address:'Al Barsha, Dubai',      creditLimit:150000 },
    { name:'Sharaf DG',              email:'buying@sharafdg.com',       phone:'+971 4 678 9012', address:'Dubai Mall',            creditLimit:100000 },
    { name:'Ahmed Al-Mansoori',      email:'ahmed@personal.ae',         phone:'+971 50 234 5678',address:'Abu Dhabi',             creditLimit:10000  },
    { name:'TechBiz Solutions LLC',  email:'it@techbiz.ae',             phone:'+971 4 891 2345', address:'Business Bay, Dubai',   creditLimit:75000  },
    { name:'Noon.com',               email:'vendor@noon.com',           phone:'+971 4 123 9876', address:'Dubai Internet City',   creditLimit:500000 },
    { name:'Lulu Hypermarket',       email:'purchase@luluhyper.com',    phone:'+971 2 567 3456', address:'Abu Dhabi',             creditLimit:300000 },
  ];

  const customers = {};
  for (const def of custDef) {
    let c = await Customer.findOne({ tenantId: tid, email: def.email });
    if (!c) {
      c = await Customer.create({ tenantId: tid, ...def, isActive: true });
      await FinanceCustomer.findOneAndUpdate({ tenantId: tid, email: def.email }, { tenantId: tid, ...def, isActive: true }, { upsert: true });
      log(`Customer: ${def.name}`);
    }
    customers[def.name] = c;
  }
  return customers;
}

// ─── VENDORS / SUPPLIERS ─────────────────────────────────────────────────────
async function seedVendors(tenantId) {
  console.log('\n🏪 Seeding vendors & suppliers...');
  const tid = String(tenantId);

  const vendorDef = [
    { name:'Apple Middle East',      email:'trade@apple-me.com',     phone:'+971 4 701 8000', category:'Electronics',  paymentTerms:'Net 30', currency:'USD' },
    { name:'Samsung Gulf',           email:'orders@samsung-gulf.com',phone:'+971 4 451 5555', category:'Electronics',  paymentTerms:'Net 45', currency:'USD' },
    { name:'Ingram Micro UAE',       email:'sales@ingrammicro.ae',   phone:'+971 4 881 6300', category:'IT Distribution',paymentTerms:'Net 30',currency:'AED' },
    { name:'Jebel Ali Wholesale',    email:'info@jawholesale.ae',    phone:'+971 4 881 1111', category:'General',       paymentTerms:'Net 15', currency:'AED' },
    { name:'Tech Data ME',           email:'orders@techdata.ae',     phone:'+971 4 886 4444', category:'IT Distribution',paymentTerms:'Net 60',currency:'USD' },
    { name:'Bosch Home Appliances',  email:'trade@bosch-me.com',     phone:'+971 4 447 5055', category:'Appliances',    paymentTerms:'Net 30', currency:'AED' },
  ];

  for (const def of vendorDef) {
    await Vendor.findOneAndUpdate({ tenantId: tid, email: def.email }, { tenantId: tid, ...def, isActive: true }, { upsert: true });
    await Supplier.findOneAndUpdate({ tenantId: tid, email: def.email }, { tenantId: tid, name: def.name, email: def.email, phone: def.phone, isActive: true }, { upsert: true });
    log(`Vendor: ${def.name}`);
  }
}

// ─── SALES ORDERS ────────────────────────────────────────────────────────────
async function seedSalesOrders(tenantId, customers, products) {
  console.log('\n🛒 Seeding sales orders...');
  const tid = String(tenantId);

  const existing = await SalesOrder.countDocuments({ tenantId: tid });
  if (existing > 0) { log('Sales orders already exist, skipping'); return; }

  const custArr = Object.values(customers);
  const prodArr = Object.values(products);

  const orders = [
    { customer: custArr[0], items: [{p: prodArr[0], qty:2},{p: prodArr[4], qty:1}], status:'delivered', date: LAST_MONTH },
    { customer: custArr[1], items: [{p: prodArr[2], qty:5},{p: prodArr[9], qty:5}], status:'confirmed', date: LAST_MONTH },
    { customer: custArr[2], items: [{p: prodArr[1], qty:3},{p: prodArr[10],qty:3}], status:'shipped',   date: TODAY },
    { customer: custArr[3], items: [{p: prodArr[6], qty:2},{p: prodArr[7], qty:4}], status:'pending',   date: TODAY },
    { customer: custArr[4], items: [{p: prodArr[5], qty:1}],                         status:'delivered', date: LAST_MONTH },
    { customer: custArr[5], items: [{p: prodArr[3], qty:2},{p: prodArr[8], qty:2}], status:'confirmed', date: TODAY },
  ];

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const orderNumber = `SO-${String(i + 1).padStart(5, '0')}`;
    const items = o.items.map(it => ({
      productId: String(it.p._id), productName: it.p.name, sku: it.p.sku,
      orderedQuantity: it.qty, unitPrice: it.p.sellingPrice, discount: 0,
      lineTotal: it.qty * it.p.sellingPrice,
    }));
    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const taxAmount = subtotal * 0.05;
    await SalesOrder.create({
      tenantId: tid, orderNumber, customerId: String(o.customer._id),
      customerName: o.customer.name, orderDate: o.date,
      items, subtotal, taxRate: 5, taxAmount, discountAmount: 0,
      totalAmount: subtotal + taxAmount, status: o.status,
    });
    log(`Sales Order: ${orderNumber} — ${o.customer.name}`);
  }
}

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────
async function seedPurchaseOrders(tenantId, products) {
  console.log('\n📥 Seeding purchase orders...');
  const tid = String(tenantId);

  const existing = await PurchaseOrder.countDocuments({ tenantId: tid });
  if (existing > 0) { log('Purchase orders already exist, skipping'); return; }

  const vendors = await Vendor.find({ tenantId: tid }).limit(4);
  const prodArr = Object.values(products);

  const orders = [
    { vendor: vendors[0], items:[{p:prodArr[0],qty:20},{p:prodArr[5],qty:10}], status:'received', date:LAST_MONTH },
    { vendor: vendors[1], items:[{p:prodArr[1],qty:15},{p:prodArr[10],qty:20}],status:'sent',     date:TODAY },
    { vendor: vendors[2], items:[{p:prodArr[2],qty:8},{p:prodArr[3],qty:6}],   status:'draft',    date:TODAY },
    { vendor: vendors[3], items:[{p:prodArr[7],qty:25},{p:prodArr[11],qty:30}],status:'partial',  date:LAST_MONTH },
  ];

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    if (!o.vendor) continue;
    const orderNumber = `PO-${String(i + 1).padStart(5, '0')}`;
    const items = o.items.map(it => ({
      productId: String(it.p._id), productName: it.p.name, sku: it.p.sku,
      orderedQuantity: it.qty, receivedQuantity: o.status === 'received' ? it.qty : 0,
      unitCost: it.p.costPrice, lineTotal: it.qty * it.p.costPrice,
    }));
    const totalAmount = items.reduce((s, it) => s + it.lineTotal, 0);
    await PurchaseOrder.create({
      tenantId: tid, orderNumber, vendorId: String(o.vendor._id),
      vendorName: o.vendor.name, orderDate: o.date, expectedDate: NEXT_MONTH,
      items, totalAmount, status: o.status,
    });
    log(`Purchase Order: ${orderNumber} — ${o.vendor.name}`);
  }
}

// ─── INVOICES ────────────────────────────────────────────────────────────────
async function seedInvoices(tenantId, customers) {
  console.log('\n🧾 Seeding invoices...');
  const tid = String(tenantId);

  const existing = await Invoice.countDocuments({ tenantId: tid });
  if (existing > 0) { log('Invoices already exist, skipping'); return; }

  const custArr = Object.values(customers);
  const invDef = [
    { customer: custArr[0], amount:13997, status:'paid',    date:LAST_MONTH },
    { customer: custArr[1], amount:38495, status:'sent',    date:LAST_MONTH },
    { customer: custArr[2], amount:10197, status:'paid',    date:LAST_MONTH },
    { customer: custArr[3], amount:17948, status:'sent',    date:TODAY },
    { customer: custArr[4], amount:1799,  status:'paid',    date:LAST_MONTH },
    { customer: custArr[5], amount:12996, status:'draft',   date:TODAY },
    { customer: custArr[6], amount:74995, status:'sent',    date:LAST_MONTH },
  ];

  for (let i = 0; i < invDef.length; i++) {
    const def = invDef[i];
    const invoiceNumber = `INV-${String(i + 1).padStart(5, '0')}`;
    const subtotal = Math.round(def.amount / 1.05);
    const taxAmount = def.amount - subtotal;
    await Invoice.create({
      tenantId: tid, invoiceNumber,
      customerId: String(def.customer._id), customerName: def.customer.name,
      invoiceDate: def.date, dueDate: NEXT_MONTH,
      items: [{ itemName:'Products & Services', quantity:1, unitPrice:subtotal, lineTotal:subtotal }],
      subtotal, taxRate:5, taxAmount, totalAmount:def.amount,
      paidAmount: def.status === 'paid' ? def.amount : def.status === 'partial' ? Math.round(def.amount * 0.5) : 0,
      status: def.status,
    });
    log(`Invoice: ${invoiceNumber} — ${def.customer.name} (${def.status})`);
  }
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────
async function seedExpenses(tenantId) {
  console.log('\n💸 Seeding expenses...');
  const tid = String(tenantId);

  const existing = await Expense.countDocuments({ tenantId: tid });
  if (existing > 0) { log('Expenses already exist, skipping'); return; }

  const expDef = [
    { title:'Office Rent — June 2025',       category:'Rent',      amount:8000,  status:'paid',     date:LAST_MONTH },
    { title:'Employee Team Lunch',            category:'Meals',     amount:850,   status:'paid',     date:LAST_MONTH },
    { title:'Google Ads Campaign',           category:'Marketing', amount:5000,  status:'approved', date:TODAY },
    { title:'Software Licenses — Microsoft', category:'Software',  amount:2400,  status:'paid',     date:LAST_MONTH },
    { title:'Dubai Chamber Membership',      category:'Membership',amount:1500,  status:'pending',  date:TODAY },
    { title:'Airport Taxi — Client Visit',   category:'Travel',    amount:320,   status:'approved', date:TODAY },
    { title:'Printer Ink & Toners',          category:'Supplies',  amount:480,   status:'paid',     date:LAST_MONTH },
    { title:'Electricity Bill',              category:'Utilities', amount:1200,  status:'paid',     date:LAST_MONTH },
  ];

  for (const def of expDef) {
    await Expense.create({ tenantId: tid, ...def, currency:'AED', submittedBy:'Michael Chen', expenseDate: def.date });
    log(`Expense: ${def.title}`);
  }
}

// ─── CRM ─────────────────────────────────────────────────────────────────────
async function seedCRM(tenantId) {
  console.log('\n📞 Seeding CRM (leads, contacts, deals)...');
  const tid = String(tenantId);

  const existingLeads = await Lead.countDocuments({ tenantId: tid });
  if (existingLeads > 0) { log('CRM data already exists, skipping'); return; }

  const leads = [
    { name:'Etisalat Enterprise',     email:'it@etisalat.ae',      phone:'+971 4 101 0001', source:'website',  status:'qualified', notes:'Interested in bulk laptop procurement' },
    { name:'Emirates NBD Bank',       email:'procurement@enbd.ae', phone:'+971 4 609 0000', source:'referral', status:'contacted', notes:'Need POS system upgrade' },
    { name:'Dubai Municipality',      email:'it@dm.gov.ae',        phone:'+971 4 221 5555', source:'cold_call',status:'new',       notes:'Government tender for IT equipment' },
    { name:'DEWA',                    email:'supply@dewa.gov.ae',  phone:'+971 4 601 9999', source:'event',    status:'qualified', notes:'Annual maintenance contract opportunity' },
    { name:'Al Habtoor Group',        email:'cto@alhabtoor.ae',    phone:'+971 4 207 7777', source:'referral', status:'converted', notes:'Converted to customer — Sharaf DG account' },
  ];
  for (const l of leads) {
    await Lead.create({ tenantId: tid, ...l });
    log(`Lead: ${l.name}`);
  }

  const contacts = [
    { firstName:'Khalid', lastName:'Al-Mazrouei', email:'khalid@etisalat.ae',  phone:'+971 50 501 0001', company:'Etisalat',      title:'IT Director' },
    { firstName:'Reem',   lastName:'Al-Falasi',   email:'reem@enbd.ae',         phone:'+971 50 609 0001', company:'Emirates NBD',  title:'Procurement Manager' },
    { firstName:'Hassan', lastName:'Al-Suwaidi',  email:'hassan@dm.gov.ae',     phone:'+971 50 221 5556', company:'Dubai Municipality','title':'IT Manager' },
    { firstName:'Mariam', lastName:'Al-Qassimi',  email:'mariam@alfardan.ae',   phone:'+971 50 345 6780', company:'Al Fardan Electronics','title':'Buyer' },
    { firstName:'Tariq',  lastName:'Bin-Zayed',   email:'tariq@jumbo.ae',       phone:'+971 50 234 5679', company:'Jumbo Electronics','title':'Purchasing Director' },
  ];
  for (const c of contacts) {
    await Contact.create({ tenantId: tid, ...c, isActive: true });
    log(`Contact: ${c.firstName} ${c.lastName}`);
  }

  const deals = [
    { title:'Etisalat Laptop Fleet Q3',  value:125000, stage:'proposal',      probability:60, currency:'AED' },
    { title:'ENBD POS Replacement',      value:85000,  stage:'negotiation',   probability:75, currency:'AED' },
    { title:'Dubai Municipality IT',     value:250000, stage:'qualification', probability:30, currency:'AED' },
    { title:'Jumbo Electronics Reseller',value:500000, stage:'closed-won',    probability:100,currency:'AED' },
    { title:'Al Habtoor Smart Offices',  value:180000, stage:'prospecting',   probability:20, currency:'AED' },
  ];
  for (const d of deals) {
    await Deal.create({ tenantId: tid, ...d, closeDate: NEXT_MONTH });
    log(`Deal: ${d.title} (${d.stage})`);
  }
}

// ─── PROJECT MANAGEMENT ──────────────────────────────────────────────────────
async function seedProjects(tenantId, users) {
  console.log('\n📋 Seeding projects...');
  const tid = String(tenantId);

  const existing = await Project.countDocuments({ tenantId: tid });
  if (existing > 0) { log('Projects already exist, skipping'); return; }

  const adminUser = users['admin@vroduxerp.com'];
  const devUser   = users['sales@vroduxerp.com'];

  const projectsDef = [
    {
      name:'ERP Implementation Phase 2', key:'ERP2', description:'Second phase of ERP rollout covering Finance and HR modules.',
      leadName:'System Admin', startDate:LAST_MONTH, status:'active',
      columns:['Backlog','To Do','In Progress','Testing','Done'],
      issues:[
        { title:'Set up Chart of Accounts',       priority:'high',   status:'done',        type:'task' },
        { title:'HR Payroll Integration',          priority:'high',   status:'in_progress', type:'story' },
        { title:'User Acceptance Testing - Finance',priority:'medium',status:'todo',        type:'task' },
        { title:'VAT Configuration',               priority:'critical',status:'done',       type:'task' },
        { title:'Employee Self-Service Portal',    priority:'low',    status:'todo',        type:'story' },
      ],
    },
    {
      name:'Website Redesign 2025', key:'WEB25', description:'Full redesign of corporate website with new brand identity.',
      leadName:'Emily Davis', startDate:TODAY, status:'active',
      columns:['To Do','In Progress','Review','Done'],
      issues:[
        { title:'Homepage Hero Section Design',    priority:'high',   status:'in_progress', type:'task' },
        { title:'Mobile Responsiveness Audit',     priority:'high',   status:'todo',        type:'task' },
        { title:'SEO Optimization',                priority:'medium', status:'todo',        type:'task' },
        { title:'Product Catalog Integration',     priority:'high',   status:'todo',        type:'story' },
      ],
    },
    {
      name:'Warehouse Management Upgrade', key:'WMS1', description:'Upgrade warehouse operations with new scanning system.',
      leadName:'Omar Al-Hassan', startDate:LAST_MONTH, status:'active',
      columns:['Todo','In Progress','Done'],
      issues:[
        { title:'Barcode Scanner Setup',           priority:'critical',status:'done',       type:'task' },
        { title:'Stock Count Reconciliation',      priority:'high',   status:'in_progress', type:'task' },
        { title:'Bin Location Labeling',           priority:'medium', status:'todo',        type:'task' },
      ],
    },
  ];

  for (const pd of projectsDef) {
    const project = await Project.create({
      tenantId: tid, name: pd.name, key: pd.key, description: pd.description,
      leadId: String(adminUser._id), leadName: pd.leadName,
      startDate: pd.startDate, status: pd.status,
      members: [{ userId: String(adminUser._id), userName: 'System Admin', role: 'owner' }],
    });

    // Create columns
    const colDocs = {};
    for (let i = 0; i < pd.columns.length; i++) {
      const col = await BoardColumn.create({ tenantId: tid, projectId: String(project._id), name: pd.columns[i], order: i });
      colDocs[pd.columns[i]] = col;
    }

    // Create issues
    const firstCol = Object.values(colDocs)[0];
    const doneCol  = Object.values(colDocs).at(-1);
    for (let i = 0; i < pd.issues.length; i++) {
      const iss = pd.issues[i];
      const col = iss.status === 'done' ? doneCol : iss.status === 'in_progress' ? Object.values(colDocs)[Math.floor(colDocs.length/2)] || firstCol : firstCol;
      await Issue.create({
        tenantId: tid, projectId: String(project._id),
        columnId: String(col._id),
        title: iss.title, type: iss.type, priority: iss.priority, status: iss.status, order: i,
      });
    }
    log(`Project: ${pd.name} (${pd.issues.length} issues)`);
  }
}

// ─── ATTENDANCE ──────────────────────────────────────────────────────────────
async function seedAttendance(tenantId, employees) {
  console.log('\n⏰ Seeding attendance records...');
  const tid = String(tenantId);

  const existing = await Attendance.countDocuments({ tenantId: tid });
  if (existing > 0) { log('Attendance records already exist, skipping'); return; }

  const empArr = Object.values(employees).slice(0, 5);
  const statuses = ['present','present','present','present','on_leave','present','present','half_day','present','absent'];

  for (const emp of empArr) {
    for (let d = 6; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends
      const dateStr = date.toISOString().split('T')[0];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      await Attendance.create({
        tenantId: tid, employeeId: String(emp._id),
        employeeName: `${emp.firstName} ${emp.lastName}`,
        date: dateStr, checkIn: '09:00', checkOut: '18:00', status,
      });
    }
  }
  log(`Attendance for ${empArr.length} employees (last 7 days)`);
}

// ─── LEAVES ──────────────────────────────────────────────────────────────────
async function seedLeaves(tenantId, employees) {
  console.log('\n🌴 Seeding leave requests...');
  const tid = String(tenantId);

  const existing = await Leave.countDocuments({ tenantId: tid });
  if (existing > 0) { log('Leave requests already exist, skipping'); return; }

  const empArr = Object.values(employees);
  const leaveDef = [
    { emp: empArr[2], type:'annual',  from:'2025-07-15', to:'2025-07-19', days:5,  status:'approved', reason:'Family vacation' },
    { emp: empArr[3], type:'sick',    from:TODAY,         to:TODAY,        days:1,  status:'pending',  reason:'Medical appointment' },
    { emp: empArr[6], type:'annual',  from:'2025-08-01', to:'2025-08-10', days:10, status:'pending',  reason:'Eid vacation travel' },
    { emp: empArr[4], type:'unpaid',  from:'2025-06-20', to:'2025-06-20', days:1,  status:'rejected', reason:'Personal matter' },
    { emp: empArr[1], type:'annual',  from:'2025-09-01', to:'2025-09-05', days:5,  status:'approved', reason:'Summer break' },
  ];

  for (const def of leaveDef) {
    await Leave.create({
      tenantId: tid, employeeId: String(def.emp._id),
      employeeName: `${def.emp.firstName} ${def.emp.lastName}`,
      leaveType: def.type, startDate: def.from, endDate: def.to,
      days: def.days, reason: def.reason, status: def.status,
    });
    log(`Leave: ${def.emp.firstName} — ${def.type} (${def.status})`);
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🚀 VroduxERP Seed Script');
  console.log('─────────────────────────────────────────');
  await connectDB();

  const allPerms = await seedPermissions();
  const tenant   = await seedTenant();
  const tid      = tenant._id;

  const roles    = await seedRoles(tid, allPerms);
  const users    = await seedUsers(tid, roles);
  const depts    = await seedDepartments(tid);
  const emps     = await seedEmployees(tid, depts);

  await seedAccounts(tid);

  const masterData = await seedMasterData(tid);
  const warehouses = await seedWarehouses(tid);
  const products   = await seedProducts(tid, masterData, warehouses);

  const customers  = await seedCustomers(tid);
  await seedVendors(tid);

  await seedSalesOrders(tid, customers, products);
  await seedPurchaseOrders(tid, products);
  await seedInvoices(tid, customers);
  await seedExpenses(tid);
  await seedCRM(tid);
  await seedProjects(tid, users);
  await seedAttendance(tid, emps);
  await seedLeaves(tid, emps);

  console.log('\n─────────────────────────────────────────');
  console.log('✅ Seed complete!\n');
  console.log('  Login credentials:');
  console.log('  ┌────────────────────────────────┬──────────────────┬──────────────────┐');
  console.log('  │ Email                          │ Password         │ Role             │');
  console.log('  ├────────────────────────────────┼──────────────────┼──────────────────┤');
  console.log('  │ admin@vroduxerp.com            │ Admin@123456     │ Super Admin      │');
  console.log('  │ hr@vroduxerp.com               │ Hr@123456        │ HR Manager       │');
  console.log('  │ finance@vroduxerp.com          │ Finance@123456   │ Finance Manager  │');
  console.log('  │ sales@vroduxerp.com            │ Sales@123456     │ Sales Executive  │');
  console.log('  │ store@vroduxerp.com            │ Store@123456     │ Warehouse Staff  │');
  console.log('  │ viewer@vroduxerp.com           │ Viewer@123456    │ Viewer (read-only)│');
  console.log('  └────────────────────────────────┴──────────────────┴──────────────────┘');

  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
