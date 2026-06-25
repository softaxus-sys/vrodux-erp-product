const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  title:          { type: String, required: true },
  departmentId:   String,
  departmentName: String,
  type:           { type: String, enum: ['full_time', 'part_time', 'contract', 'internship'], default: 'full_time' },
  location:       String,
  description:    String,
  requirements:   String,
  salaryMin:      Number,
  salaryMax:      Number,
  currency:       { type: String, default: 'AED' },
  status:         { type: String, enum: ['draft', 'published', 'closed', 'on_hold'], default: 'draft' },
  postedAt:       Date,
  closingDate:    String,
  isDeleted:      { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      Date,
}, { versionKey: false });

const applicantSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  jobId:        { type: String, required: true },
  jobTitle:     String,
  fullName:     { type: String, required: true },
  email:        { type: String, required: true },
  phone:        String,
  resumeUrl:    String,
  coverLetter:  String,
  source:       String,
  stage:        { type: String, enum: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'], default: 'applied' },
  notes:        String,
  rating:       { type: Number, default: 0 },
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

module.exports = {
  Job: mongoose.model('Job', jobSchema),
  Applicant: mongoose.model('Applicant', applicantSchema),
};
