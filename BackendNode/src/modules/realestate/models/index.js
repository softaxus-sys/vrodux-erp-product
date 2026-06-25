const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  propertyType:String,
  address:     String,
  city:        String,
  emirate:     String,
  totalArea:   Number,
  totalUnits:  { type: Number, default: 0 },
  marketValue: { type: Number, default: 0 },
  developer:   String,
  description: String,
  status:      { type: String, enum: ['available', 'partially_sold', 'sold_out'], default: 'available' },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

const unitSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  propertyId:  { type: String, required: true },
  unitNumber:  { type: String, required: true },
  type:        String,
  floor:       Number,
  area:        Number,
  listPrice:   { type: Number, default: 0 },
  status:      { type: String, enum: ['available', 'reserved', 'sold', 'rented'], default: 'available' },
  tenantName:  String,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

const reTenantSchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  fullName:  { type: String, required: true },
  email:     String,
  phone:     String,
  nationality:String,
  emiratesId:String,
  status:    { type: String, enum: ['active', 'inactive'], default: 'active' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const reContractSchema = new mongoose.Schema({
  tenantId:   { type: String, required: true, index: true },
  unitId:     String,
  reTenantId: String,
  tenantName: String,
  type:       { type: String, enum: ['sale', 'lease'], default: 'sale' },
  startDate:  String,
  endDate:    String,
  amount:     { type: Number, default: 0 },
  status:     { type: String, enum: ['active', 'expired', 'terminated'], default: 'active' },
  isDeleted:  { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
}, { versionKey: false });

const brokerSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  name:        { type: String, required: true },
  email:       String,
  phone:       String,
  licenseNo:   String,
  agency:      String,
  commission:  { type: Number, default: 0 },
  totalSales:  { type: Number, default: 0 },
  status:      { type: String, enum: ['active', 'inactive'], default: 'active' },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

const siteVisitSchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  propertyId:String,
  leadId:    String,
  leadName:  String,
  visitDate: String,
  status:    { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  feedback:  String,
  notes:     String,
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
}, { versionKey: false });

const reservationSchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  unitId:    String,
  leadName:  String,
  status:    { type: String, enum: ['pending', 'confirmed', 'cancelled', 'converted'], default: 'pending' },
  amount:    { type: Number, default: 0 },
  notes:     String,
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
}, { versionKey: false });

const reBookingSchema = new mongoose.Schema({
  tenantId:   { type: String, required: true, index: true },
  unitId:     String,
  customerId: String,
  customerName:String,
  amount:     { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  status:     { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  notes:      String,
  isDeleted:  { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  Date,
}, { versionKey: false });

module.exports = {
  REProperty:    mongoose.model('REProperty', propertySchema),
  REUnit:        mongoose.model('REUnit', unitSchema),
  RETenant:      mongoose.model('RETenant', reTenantSchema),
  REContract:    mongoose.model('REContract', reContractSchema),
  REBroker:      mongoose.model('REBroker', brokerSchema),
  RESiteVisit:   mongoose.model('RESiteVisit', siteVisitSchema),
  REReservation: mongoose.model('REReservation', reservationSchema),
  REBooking:     mongoose.model('REBooking', reBookingSchema),
};
