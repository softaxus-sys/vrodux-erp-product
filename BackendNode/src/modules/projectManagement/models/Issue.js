const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  projectId:   { type: String, required: true },
  columnId:    String,
  sprintId:    String,
  epicId:      String,
  title:       { type: String, required: true },
  description: String,
  type:        { type: String, enum: ['story', 'task', 'bug', 'epic', 'subtask'], default: 'task' },
  priority:    { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  status:      { type: String, enum: ['todo', 'in_progress', 'done', 'cancelled'], default: 'todo' },
  assigneeId:  String,
  assigneeName:String,
  reporterId:  String,
  reporterName:String,
  storyPoints: Number,
  dueDate:     String,
  order:       { type: Number, default: 0 },
  labelIds:    [String],
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

schema.index({ tenantId: 1, projectId: 1 });

module.exports = mongoose.model('Issue', schema);
