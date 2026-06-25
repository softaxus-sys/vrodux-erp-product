const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: String,
  targetDate:  String,
  weight:      { type: Number, default: 0 },
  status:      { type: String, enum: ['pending', 'in_progress', 'achieved', 'missed'], default: 'pending' },
  score:       Number,
  comments:    String,
}, { _id: true });

const performanceReviewSchema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  employeeId:     { type: String, required: true },
  employeeName:   String,
  reviewerId:     String,
  reviewerName:   String,
  period:         { type: String, required: true },
  reviewDate:     String,
  status:         { type: String, enum: ['draft', 'submitted', 'acknowledged', 'completed'], default: 'draft' },
  overallScore:   { type: Number, default: 0 },
  goals:          [goalSchema],
  strengths:      String,
  areasToImprove: String,
  comments:       String,
  employeeComments:String,
  isDeleted:      { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      Date,
}, { versionKey: false });

module.exports = mongoose.model('PerformanceReview', performanceReviewSchema);
