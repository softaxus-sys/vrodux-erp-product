const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  number:      { type: String, required: true },
  type:        { type: String, enum: ['single', 'double', 'suite', 'deluxe', 'penthouse'], default: 'single' },
  floor:       Number,
  beds:        { type: Number, default: 1 },
  maxOccupancy:{ type: Number, default: 2 },
  ratePerNight:{ type: Number, default: 0 },
  status:      { type: String, enum: ['available', 'occupied', 'maintenance', 'cleaning'], default: 'available' },
  amenities:   [String],
  description: String,
  isActive:    { type: Boolean, default: true },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });
roomSchema.index({ tenantId: 1, number: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

const bookingSchema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  bookingNumber: { type: String, required: true },
  roomId:        String,
  roomNumber:    String,
  guestName:     { type: String, required: true },
  guestEmail:    String,
  guestPhone:    String,
  checkIn:       { type: String, required: true },
  checkOut:      { type: String, required: true },
  nights:        { type: Number, default: 1 },
  adults:        { type: Number, default: 1 },
  children:      { type: Number, default: 0 },
  ratePerNight:  { type: Number, default: 0 },
  totalAmount:   { type: Number, default: 0 },
  paidAmount:    { type: Number, default: 0 },
  status:        { type: String, enum: ['reserved', 'checked_in', 'checked_out', 'cancelled', 'no_show'], default: 'reserved' },
  source:        String,
  notes:         String,
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     Date,
}, { versionKey: false });

const housekeepingSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  roomId:      String,
  roomNumber:  String,
  taskType:    { type: String, enum: ['cleaning', 'turndown', 'deep_clean', 'maintenance', 'inspection'], default: 'cleaning' },
  priority:    { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  assignedTo:  String,
  status:      { type: String, enum: ['pending', 'in_progress', 'completed', 'skipped'], default: 'pending' },
  notes:       String,
  completedAt: Date,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

const guestSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  fullName:    { type: String, required: true },
  email:       String,
  phone:       String,
  nationality: String,
  passportNo:  String,
  dateOfBirth: String,
  address:     String,
  preferences: String,
  visits:      { type: Number, default: 0 },
  totalSpent:  { type: Number, default: 0 },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = {
  HospRoom:         mongoose.model('HospRoom', roomSchema),
  HospBooking:      mongoose.model('HospBooking', bookingSchema),
  HospHousekeeping: mongoose.model('HospHousekeeping', housekeepingSchema),
  HospGuest:        mongoose.model('HospGuest', guestSchema),
};
