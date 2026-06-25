const mongoose = require('mongoose');

// B2B
const proposalSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  contactId:   String,
  contactName: String,
  title:       { type: String, required: true },
  value:       { type: Number, default: 0 },
  currency:    { type: String, default: 'AED' },
  validUntil:  String,
  status:      { type: String, enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'], default: 'draft' },
  description: String,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

const b2bContractSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  contactId:   String,
  contactName: String,
  title:       { type: String, required: true },
  value:       { type: Number, default: 0 },
  startDate:   String,
  endDate:     String,
  status:      { type: String, enum: ['draft', 'active', 'expired', 'terminated'], default: 'draft' },
  terms:       String,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

const supportTicketSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  contactId:   String,
  contactName: String,
  subject:     { type: String, required: true },
  description: String,
  priority:    { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status:      { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  assignedTo:  String,
  resolvedAt:  Date,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   Date,
}, { versionKey: false });

// Education
const studentSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  studentId:    String,
  fullName:     { type: String, required: true },
  email:        String,
  phone:        String,
  dateOfBirth:  String,
  gender:       String,
  address:      String,
  status:       { type: String, enum: ['active', 'inactive', 'graduated', 'dropped'], default: 'active' },
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
}, { versionKey: false });

const admissionSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  studentName:  String,
  email:        String,
  phone:        String,
  program:      String,
  intake:       String,
  status:       { type: String, enum: ['pending', 'under_review', 'accepted', 'rejected', 'enrolled'], default: 'pending' },
  notes:        String,
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
}, { versionKey: false });

const enrollmentSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  studentId:   String,
  studentName: String,
  program:     String,
  course:      String,
  startDate:   String,
  endDate:     String,
  fee:         { type: Number, default: 0 },
  status:      { type: String, enum: ['active', 'completed', 'dropped'], default: 'active' },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

// Healthcare
const patientSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  patientId:   String,
  fullName:    { type: String, required: true },
  email:       String,
  phone:       String,
  dateOfBirth: String,
  gender:      String,
  bloodGroup:  String,
  allergies:   [String],
  insurance:   String,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

const appointmentSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  patientId:   String,
  patientName: String,
  doctorId:    String,
  doctorName:  String,
  date:        String,
  time:        String,
  type:        String,
  status:      { type: String, enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'], default: 'scheduled' },
  notes:       String,
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

const treatmentPlanSchema = new mongoose.Schema({
  tenantId:    { type: String, required: true, index: true },
  patientId:   String,
  patientName: String,
  diagnosis:   String,
  plan:        String,
  startDate:   String,
  status:      { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  isDeleted:   { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
}, { versionKey: false });

// Insurance
const policySchema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  policyNumber:   String,
  holderId:       String,
  holderName:     String,
  type:           String,
  premium:        { type: Number, default: 0 },
  coverageAmount: { type: Number, default: 0 },
  startDate:      String,
  endDate:        String,
  status:         { type: String, enum: ['active', 'expired', 'cancelled', 'lapsed'], default: 'active' },
  isDeleted:      { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
}, { versionKey: false });

const claimSchema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  policyId:     String,
  policyNumber: String,
  holderName:   String,
  amount:       { type: Number, default: 0 },
  incidentDate: String,
  description:  String,
  status:       { type: String, enum: ['pending', 'under_review', 'approved', 'rejected', 'paid'], default: 'pending' },
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

module.exports = {
  CrmProposal:     mongoose.model('CrmProposal', proposalSchema),
  CrmB2BContract:  mongoose.model('CrmB2BContract', b2bContractSchema),
  SupportTicket:   mongoose.model('SupportTicket', supportTicketSchema),
  EduStudent:      mongoose.model('EduStudent', studentSchema),
  EduAdmission:    mongoose.model('EduAdmission', admissionSchema),
  EduEnrollment:   mongoose.model('EduEnrollment', enrollmentSchema),
  HealthPatient:   mongoose.model('HealthPatient', patientSchema),
  HealthAppointment:mongoose.model('HealthAppointment', appointmentSchema),
  HealthTreatment: mongoose.model('HealthTreatment', treatmentPlanSchema),
  InsPolicy:       mongoose.model('InsPolicy', policySchema),
  InsClaim:        mongoose.model('InsClaim', claimSchema),
};
