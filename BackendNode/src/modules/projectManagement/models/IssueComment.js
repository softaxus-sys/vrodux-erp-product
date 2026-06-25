const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId:  { type: String, required: true, index: true },
  issueId:   { type: String, required: true },
  projectId: { type: String, required: true },
  authorId:  String,
  authorName:{ type: String, required: true },
  content:   { type: String, required: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
}, { versionKey: false });
schema.index({ tenantId: 1, issueId: 1 });
module.exports = mongoose.model('IssueComment', schema);
