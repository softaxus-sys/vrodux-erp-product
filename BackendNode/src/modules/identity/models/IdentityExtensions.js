const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  tenantId:    { type: String, index: true },
  userId:      String,
  userName:    String,
  action:      String,
  resource:    String,
  resourceId:  String,
  details:     mongoose.Schema.Types.Mixed,
  ipAddress:   String,
  userAgent:   String,
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

const branchSchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  name:      { type: String, required: true },
  code:      String,
  address:   String,
  phone:     String,
  email:     String,
  manager:   String,
  isDefault: { type: Boolean, default: false },
  isActive:  { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const appSettingSchema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  userId:    { type: String },
  scope:     { type: String, enum: ['user', 'tenant'], default: 'user' },
  key:       { type: String, required: true },
  value:     mongoose.Schema.Types.Mixed,
  updatedAt: Date,
}, { versionKey: false });
appSettingSchema.index({ tenantId: 1, userId: 1, key: 1 }, { unique: true, sparse: true });

module.exports = {
  AuditLog:   mongoose.model('AuditLog', auditLogSchema),
  Branch:     mongoose.model('Branch', branchSchema),
  AppSetting: mongoose.model('AppSetting', appSettingSchema),
};
