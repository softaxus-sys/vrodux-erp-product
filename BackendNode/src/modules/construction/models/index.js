const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  code:        String,
  type:        String,
  clientName:  String,
  clientContact:String,
  location:    String,
  startDate:   String,
  endDate:     String,
  budget:      { type: Number, default: 0 },
  spent:       { type: Number, default: 0 },
  progress:    { type: Number, default: 0 },
  status:      { type: String, enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'], default: 'planning' },
  description: String,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

const siteSchema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  projectId:      String,
  project:        String,
  name:           { type: String, required: true },
  address:        String,
  city:           String,
  emirate:        String,
  area:           Number,
  startDate:      String,
  status:         { type: String, enum: ['active', 'inactive', 'completed'], default: 'active' },
  supervisor:     String,
  siteManager:    String,
  managerPhone:   String,
  safetyOfficer:  String,
  officerPhone:   String,
  workers:        { type: Number, default: 0 },
  maxWorkers:     Number,
  currentWorkers: { type: Number, default: 0 },
  permitNumber:   String,
  permitExpiry:   String,
  safetyScore:    { type: Number, default: 0 },
  notes:          String,
  isDeleted:      { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
}, { versionKey: false });

const contractorSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  trade:       String,
  email:       String,
  phone:       String,
  licenseNo:   String,
  rating:      { type: Number, default: 0 },
  status:      { type: String, enum: ['active', 'inactive'], default: 'active' },
  totalContracts: { type: Number, default: 0 },
  totalValue:  { type: Number, default: 0 },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

const boqItemSchema = new mongoose.Schema({ description: String, unit: String, quantity: Number, unitCost: Number, lineTotal: Number }, { _id: true });
const boqSchema = new mongoose.Schema({
  tenantId:   { type: String, required: true, index: true },
  projectId:  String,
  name:       { type: String, required: true },
  status:     { type: String, enum: ['draft', 'approved', 'revised'], default: 'draft' },
  totalAmount:{ type: Number, default: 0 },
  items:      [boqItemSchema],
  isDeleted:  { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
}, { versionKey: false });

const rfqSchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  title:     { type: String, required: true },
  projectId: String,
  status:    { type: String, enum: ['draft', 'sent', 'received', 'awarded', 'cancelled'], default: 'draft' },
  dueDate:   String,
  notes:     String,
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
}, { versionKey: false });

const estimateSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  title:        { type: String, required: true },
  projectId:    String,
  status:       { type: String, enum: ['draft', 'submitted', 'approved', 'rejected'], default: 'draft' },
  totalAmount:  { type: Number, default: 0 },
  notes:        String,
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

const contractSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  title:        { type: String, required: true },
  projectId:    String,
  contractorId: String,
  contractorName:String,
  value:        { type: Number, default: 0 },
  startDate:    String,
  endDate:      String,
  status:       { type: String, enum: ['draft', 'active', 'completed', 'terminated'], default: 'draft' },
  notes:        String,
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

module.exports = {
  ConstrProject:   mongoose.model('ConstrProject', projectSchema),
  ConstrSite:      mongoose.model('ConstrSite', siteSchema),
  ConstrContractor:mongoose.model('ConstrContractor', contractorSchema),
  ConstrBOQ:       mongoose.model('ConstrBOQ', boqSchema),
  ConstrRFQ:       mongoose.model('ConstrRFQ', rfqSchema),
  ConstrEstimate:  mongoose.model('ConstrEstimate', estimateSchema),
  ConstrContract:  mongoose.model('ConstrContract', contractSchema),
};
