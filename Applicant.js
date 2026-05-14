const mongoose = require('mongoose');

function generateCandidateId() {
  const date  = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `CP-${date}-${rand}`;
}

const applicantSchema = new mongoose.Schema({
  candidateId:  { type:String, unique:true, default: generateCandidateId },
  fullName:     { type:String, required:true, trim:true },
  dateOfBirth:  { type:Date,   required:true },
  email:        { type:String, required:true, trim:true, lowercase:true },
  countryCode:  { type:String, required:true, default:'+91' },
  phone:        { type:String, required:true, trim:true },
  domain:       { type:String, required:true },
  startDate:    { type:Date,   required:true },
  endDate:      { type:Date },
  duration:     { type:String, required:true },
  paymentStatus:{ type:String, enum:['paid','failed','refunded'], default:'paid' },
  paymentAmount:{ type:Number, required:true },
  paymentCurrency:{ type:String, default:'INR' },
  razorpayOrderId:{ type:String, required:true },
  razorpayPaymentId:{ type:String, required:true },
  razorpaySignature:{ type:String },
  paidAt:       { type:Date },
  status:       { type:String, enum:['pending','contacted','enrolled','rejected'], default:'pending' },
  emailSent:    { type:Boolean, default:false },
  emailError:   { type:String },
  pdfPath:      { type:String },
  certificateSent:{ type:Boolean, default:false },
  certificateSentAt:{ type:Date },
  certificateId:{ type:String },
  certificatePdfPath:{ type:String },
  certificateEmailError:{ type:String },
  submittedAt:  { type:Date, default:Date.now },
}, { timestamps:true });

applicantSchema.index({ email:1 });
applicantSchema.index({ razorpayPaymentId:1 }, { unique:true });
applicantSchema.index({ endDate:1, certificateSent:1, paymentStatus:1 });

module.exports = mongoose.model('Applicant', applicantSchema);
