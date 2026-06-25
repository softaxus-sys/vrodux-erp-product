const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  tenantId:     { type: String, index: true },
  username:     { type: String, required: true },
  firstName:    { type: String, required: true },
  lastName:     { type: String, required: true },
  email:        { type: String, required: true, lowercase: true },
  passwordHash: { type: String, required: true },
  phoneNumber:  String,
  avatarUrl:    String,
  status:       { type: String, enum: ['active', 'inactive', 'banned'], default: 'active' },
  isSuperAdmin: { type: Boolean, default: false },
  isDeleted:    { type: Boolean, default: false },
  roles:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

userSchema.index({ tenantId: 1, email: 1 }, { unique: true, sparse: true });

userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = async function(plain) {
  return bcrypt.hash(plain, 12);
};

module.exports = mongoose.model('User', userSchema);
