const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  tenantId:       { type: String, required: true, index: true },
  employeeNumber: { type: String, required: true },
  firstName:      { type: String, required: true },
  lastName:       { type: String, required: true },
  email:          { type: String, required: true, lowercase: true },
  phone:          String,
  jobTitle:       String,
  departmentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  departmentName: String,
  managerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern'], default: 'full_time' },
  status:         { type: String, enum: ['active', 'inactive', 'terminated'], default: 'active' },
  joiningDate:    String,
  terminationDate:String,
  dateOfBirth:    String,
  address:        String,
  basicSalary:    { type: Number, default: 0 },
  currency:       { type: String, default: 'AED' },
  iban:           String,
  bankAccount:    String,
  bankName:       String,
  gender:         String,
  nationality:    String,
  passportNumber: String,
  emiratesId:     String,
  visaExpiry:     String,
  imageUrl:       String,
  isDeleted:      { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      Date,
}, { versionKey: false });

employeeSchema.index({ tenantId: 1, employeeNumber: 1 }, { unique: true });

module.exports = mongoose.model('Employee', employeeSchema);
