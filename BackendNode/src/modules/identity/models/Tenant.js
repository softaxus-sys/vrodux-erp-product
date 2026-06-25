const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  slug:      { type: String, required: true, unique: true, lowercase: true },
  name:      { type: String, required: true },
  plan:      { type: String, enum: ['trial', 'starter', 'professional', 'enterprise'], default: 'trial' },
  industry:  String,
  status:    { type: String, enum: ['active', 'suspended', 'expired'], default: 'active' },
  modules:   [String],
  trialEndsAt: Date,
  licenseExpiresAt: Date,
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
}, { versionKey: false });

module.exports = mongoose.model('Tenant', tenantSchema);
