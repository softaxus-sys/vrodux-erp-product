const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  number:    { type: String, required: true },
  capacity:  { type: Number, default: 4 },
  section:   String,
  status:    { type: String, enum: ['available', 'occupied', 'reserved', 'cleaning'], default: 'available' },
  isActive:  { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const menuCategorySchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  name:      { type: String, required: true },
  order:     { type: Number, default: 0 },
  isActive:  { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const menuItemSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  categoryId:  String,
  categoryName:String,
  name:        { type: String, required: true },
  description: String,
  price:       { type: Number, required: true },
  preparationTime: Number,
  allergens:   [String],
  isAvailable: { type: Boolean, default: true },
  isActive:    { type: Boolean, default: true },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

const orderLineSchema = new mongoose.Schema({
  menuItemId:  String,
  name:        String,
  quantity:    { type: Number, default: 1 },
  unitPrice:   { type: Number, default: 0 },
  lineTotal:   { type: Number, default: 0 },
  notes:       String,
  status:      { type: String, enum: ['pending', 'preparing', 'ready', 'served', 'cancelled'], default: 'pending' },
  sentAt:      Date,
}, { _id: true });

const restaurantOrderSchema = new mongoose.Schema({
  tenantId:      { type: String, required: true, index: true },
  orderNumber:   { type: String, required: true },
  tableId:       String,
  tableNumber:   String,
  covers:        { type: Number, default: 1 },
  items:         [orderLineSchema],
  subtotal:      { type: Number, default: 0 },
  taxAmount:     { type: Number, default: 0 },
  discountAmount:{ type: Number, default: 0 },
  totalAmount:   { type: Number, default: 0 },
  paidAmount:    { type: Number, default: 0 },
  paymentMethod: String,
  status:        { type: String, enum: ['open', 'sent_to_kitchen', 'partially_ready', 'ready', 'closed', 'cancelled'], default: 'open' },
  notes:         String,
  closedAt:      Date,
  isDeleted:     { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     Date,
}, { versionKey: false });

const reservationSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  guestName:    { type: String, required: true },
  guestPhone:   String,
  guestEmail:   String,
  date:         { type: String, required: true },
  time:         { type: String, required: true },
  covers:       { type: Number, default: 2 },
  tableId:      String,
  status:       { type: String, enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'], default: 'pending' },
  notes:        String,
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

const kitchenTicketSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  orderId:     String,
  orderNumber: String,
  tableNumber: String,
  items:       [{ menuItemId: String, name: String, quantity: Number, notes: String, status: { type: String, enum: ['pending', 'preparing', 'ready'], default: 'pending' } }],
  status:      { type: String, enum: ['pending', 'preparing', 'ready', 'completed'], default: 'pending' },
  printedAt:   Date,
  completedAt: Date,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = {
  RestTable:        mongoose.model('RestTable', tableSchema),
  RestMenuCategory: mongoose.model('RestMenuCategory', menuCategorySchema),
  RestMenuItem:     mongoose.model('RestMenuItem', menuItemSchema),
  RestOrder:        mongoose.model('RestOrder', restaurantOrderSchema),
  RestReservation:  mongoose.model('RestReservation', reservationSchema),
  KitchenTicket:    mongoose.model('KitchenTicket', kitchenTicketSchema),
};
