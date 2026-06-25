const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tenantId:     { type: String, required: true, index: true },
  employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: String,
  date:         { type: String, required: true },
  checkIn:      String,
  checkOut:     String,
  workingHours: Number,
  status:       { type: String, enum: ['present', 'absent', 'half_day', 'on_leave'], default: 'present' },
  notes:        String,
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    Date,
}, { versionKey: false });

module.exports = mongoose.model('Attendance', schema);
