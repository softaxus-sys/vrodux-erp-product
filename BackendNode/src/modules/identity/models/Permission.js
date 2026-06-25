const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  moduleId:    { type: String, required: true },
  action:      { type: String, required: true },
  description: String,
}, { versionKey: false });

permissionSchema.index({ moduleId: 1, action: 1 }, { unique: true });

permissionSchema.virtual('key').get(function () {
  return `${this.moduleId}.${this.action}`;
});

module.exports = mongoose.model('Permission', permissionSchema);
