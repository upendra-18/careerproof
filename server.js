require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');

const Applicant = require('./Applicant');
const { generateOfferLetterPDF, generateCertificatePDF } = require('./pdfService');
const { sendOfferEmail, sendCertificateEmail } = require('./emailService');

const app = express();
const PORT = process.env.PORT || 5000;
const APPLICATION_FEE_INR = 199;
const isVercel = !!process.env.VERCEL;
const SEND_CERTIFICATE_IMMEDIATELY = process.env.SEND_CERTIFICATE_IMMEDIATELY === 'true';

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function getRazorpayMode(keyId) {
  if (!keyId) return 'missing';
  if (keyId.startsWith('rzp_live_')) return 'live';
  if (keyId.startsWith('rzp_test_')) return 'test';
  return 'unknown';
}

const razorpayMode = getRazorpayMode(process.env.RAZORPAY_KEY_ID);

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

let mongoConnectionPromise = null;

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    }).then(connection => {
      console.log('MongoDB connected');
      return connection;
    }).catch(err => {
      mongoConnectionPromise = null;
      throw err;
    });
  }
  return mongoConnectionPromise;
}

app.use('/api', async (_, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (err) {
    console.error('MongoDB failed:', err.message);
    res.status(500).json({ success: false, message: 'Database connection failed.' });
  }
});

const DOMAIN_LABELS = {
  fullstack: 'Full Stack Web Development',
  datascience: 'Data Science & Machine Learning',
  marketing: 'Digital Marketing',
  uiux: 'UI/UX & Product Design',
  devops: 'DevOps & Cloud Engineering',
  analytics: 'Business Analytics',
  cybersecurity: 'Cybersecurity',
  productmgmt: 'Product Management',
};

function validateApplicationPayload(body) {
  const required = ['fullName', 'dateOfBirth', 'email', 'countryCode', 'phone', 'domain', 'startDate', 'duration'];
  const missing = required.filter(field => !body?.[field]?.toString().trim());
  if (missing.length) return { error: `Missing: ${missing.join(', ')}` };

  const { fullName, dateOfBirth, email, countryCode, phone, domain, startDate, duration } = body;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email.' };

  const dob = new Date(dateOfBirth);
  const start = new Date(startDate);
  const durationN = parseInt(duration, 10);
  if (Number.isNaN(dob.getTime())) return { error: 'Invalid date of birth.' };
  if (Number.isNaN(start.getTime())) return { error: 'Invalid start date.' };
  if (!Number.isInteger(durationN) || durationN < 1) return { error: 'Invalid duration.' };

  const end = new Date(start);
  end.setMonth(end.getMonth() + durationN);

  return {
    value: {
      fullName: fullName.trim(),
      dateOfBirth: dob,
      email: email.trim().toLowerCase(),
      countryCode,
      phone: phone.trim(),
      domain: DOMAIN_LABELS[domain] || domain,
      startDate: start,
      endDate: end,
      duration: `${durationN} Month${durationN === 1 ? '' : 's'}`,
    },
  };
}

async function processOffer(applicant) {
  try {
    const pdfPath = await generateOfferLetterPDF({
      fullName: applicant.fullName,
      domain: applicant.domain,
      candidateId: applicant.candidateId,
      startDate: applicant.startDate,
      endDate: applicant.endDate,
      duration: applicant.duration,
    });

    await sendOfferEmail({
      fullName: applicant.fullName,
      email: applicant.email,
      domain: applicant.domain,
      candidateId: applicant.candidateId,
      startDate: applicant.startDate,
      endDate: applicant.endDate,
      duration: applicant.duration,
    }, pdfPath);

    await Applicant.findByIdAndUpdate(applicant._id, { emailSent: true, pdfPath, status: 'contacted' });
    console.log(`Offer complete for ${applicant.candidateId}`);

    if (process.env.VERCEL) {
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    } else {
      setTimeout(() => {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
          console.log(`PDF cleaned: ${path.basename(pdfPath)}`);
        }
      }, 3600000);
    }
  } catch (bgErr) {
    console.error(`Background job failed for ${applicant.candidateId}:`, bgErr.message);
    await Applicant.findByIdAndUpdate(applicant._id, { emailError: bgErr.message }).catch(() => {});
  }
}

async function processOfferInBackground(applicant) {
  setImmediate(() => {
    processOffer(applicant).catch(() => {});
  });
}

async function processCertificateImmediatelyForTesting(applicant) {
  if (!SEND_CERTIFICATE_IMMEDIATELY) return;
  try {
    await sendCertificateForApplicant(applicant);
  } catch (err) {
    console.error(`Immediate test certificate failed for ${applicant.candidateId}:`, err.message);
    await Applicant.findByIdAndUpdate(applicant._id, { certificateEmailError: err.message }).catch(() => {});
  }
}

async function sendCertificateForApplicant(applicant) {
  const { pdfPath, certificateId } = await generateCertificatePDF({
    fullName: applicant.fullName,
    domain: applicant.domain,
    candidateId: applicant.candidateId,
    startDate: applicant.startDate,
    endDate: applicant.endDate,
  });

  await sendCertificateEmail({
    fullName: applicant.fullName,
    email: applicant.email,
    domain: applicant.domain,
    candidateId: applicant.candidateId,
    startDate: applicant.startDate,
    endDate: applicant.endDate,
  }, pdfPath, certificateId);

  await Applicant.findByIdAndUpdate(applicant._id, {
    certificateSent: true,
    certificateSentAt: new Date(),
    certificateId,
    certificatePdfPath: pdfPath,
    certificateEmailError: null,
    status: 'enrolled',
  });

  setTimeout(() => {
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      console.log(`Certificate PDF cleaned: ${path.basename(pdfPath)}`);
    }
  }, 3600000);
}

async function sendDueCertificates() {
  const now = new Date();
  const dueApplicants = await Applicant.find({
    paymentStatus: 'paid',
    certificateSent: { $ne: true },
    endDate: { $lte: now },
  }).limit(25);

  for (const applicant of dueApplicants) {
    try {
      await sendCertificateForApplicant(applicant);
      console.log(`Certificate complete for ${applicant.candidateId}`);
    } catch (err) {
      console.error(`Certificate job failed for ${applicant.candidateId}:`, err.message);
      await Applicant.findByIdAndUpdate(applicant._id, { certificateEmailError: err.message }).catch(() => {});
    }
  }
}

async function savePaidApplication(application, payment) {
  const applicant = new Applicant({
    ...application,
    paymentStatus: 'paid',
    paymentAmount: APPLICATION_FEE_INR,
    paymentCurrency: 'INR',
    razorpayOrderId: payment.razorpay_order_id,
    razorpayPaymentId: payment.razorpay_payment_id,
    razorpaySignature: payment.razorpay_signature,
    paidAt: new Date(),
  });

  await applicant.save();
  console.log(`Saved: ${applicant.candidateId} - ${applicant.fullName}`);

  return applicant;
}

app.post('/api/payment/order', async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ success: false, message: 'Razorpay is not configured on the server.' });
    }

    const { error } = validateApplicationPayload(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const order = await razorpay.orders.create({
      amount: APPLICATION_FEE_INR * 100,
      currency: 'INR',
      receipt: `careerproof_${Date.now()}`,
      notes: { purpose: 'CareerProof application fee' },
    });

    res.json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: 'CareerProof',
      description: 'Application fee',
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({ success: false, message: 'Could not start payment.' });
  }
});

app.post('/api/payment/verify', async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ success: false, message: 'Razorpay is not configured on the server.' });
    }

    const { application, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!application || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification details.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    let payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.status === 'authorized') {
      payment = await razorpay.payments.capture(razorpay_payment_id, APPLICATION_FEE_INR * 100, 'INR');
    }

    if (payment.status !== 'captured' || payment.amount !== APPLICATION_FEE_INR * 100 || payment.currency !== 'INR') {
      return res.status(400).json({ success: false, message: 'Payment was not captured for the expected amount.' });
    }

    const { error, value } = validateApplicationPayload(application);
    if (error) return res.status(400).json({ success: false, message: error });

    const applicant = await savePaidApplication(value, {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    res.status(201).json({
      success: true,
      message: 'Payment successful. Application submitted! Offer letter will be emailed shortly.',
      candidateId: applicant.candidateId,
      name: applicant.fullName,
    });
  } catch (err) {
    if (err.code === 11000) return res.status(500).json({ success: false, message: 'ID collision - retry.' });
    console.error('Payment verify error:', err);
    res.status(500).json({ success: false, message: 'Could not verify payment or save application.' });
  }
});

app.post('/api/apply', async (_, res) => {
  res.status(402).json({
    success: false,
    message: 'Payment is required. Use /api/payment/order and /api/payment/verify.',
  });
});

app.post('/api/certificates/run', async (_, res) => {
  try {
    await sendDueCertificates();
    res.json({ success: true, message: 'Certificate job completed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/applications/:candidateId/process-documents', async (req, res) => {
  try {
    const doc = await Applicant.findOne({ candidateId: req.params.candidateId });
    if (!doc || doc.paymentStatus !== 'paid') {
      return res.status(404).json({ success: false, message: 'No paid application found for this ID.' });
    }

    if (!doc.emailSent) {
      await processOffer(doc);
    }

    if (SEND_CERTIFICATE_IMMEDIATELY && !doc.certificateSent) {
      const latestDoc = await Applicant.findOne({ candidateId: req.params.candidateId });
      await processCertificateImmediatelyForTesting(latestDoc || doc);
    }

    res.json({ success: true, message: 'Documents processed.' });
  } catch (err) {
    console.error(`Document processing failed for ${req.params.candidateId}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'careerproof.html'));
});

app.get('/careerride.html', (_, res) => {
  res.redirect('/careerproof.html');
});

app.get('/api/verify/:candidateId', async (req, res) => {
  try {
    const doc = await Applicant.findOne({ candidateId: req.params.candidateId });
    if (!doc || doc.paymentStatus !== 'paid') {
      return res.status(404).json({ success: false, message: 'No verified student record found for this ID.' });
    }

    const now = new Date();
    const isCompleted = SEND_CERTIFICATE_IMMEDIATELY || (doc.endDate && doc.endDate <= now);
    res.json({
      success: true,
      data: {
        candidateId: doc.candidateId,
        fullName: doc.fullName,
        domain: doc.domain,
        startDate: doc.startDate,
        endDate: doc.endDate,
        duration: doc.duration,
        status: doc.status,
        paymentStatus: doc.paymentStatus,
        offerLetterAvailable: !!doc.emailSent,
        certificateAvailable: !!isCompleted,
        certificateSent: !!doc.certificateSent,
        certificateId: doc.certificateId || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/verify/:candidateId/offer-letter', async (req, res) => {
  try {
    const doc = await Applicant.findOne({ candidateId: req.params.candidateId });
    if (!doc || doc.paymentStatus !== 'paid') {
      return res.status(404).json({ success: false, message: 'No verified student record found for this ID.' });
    }

    const pdfPath = await generateOfferLetterPDF({
      fullName: doc.fullName,
      domain: doc.domain,
      candidateId: doc.candidateId,
      startDate: doc.startDate,
      endDate: doc.endDate,
      duration: doc.duration,
    });

    res.download(pdfPath, `CareerProof_OfferLetter_${doc.candidateId}.pdf`, err => {
      if (err) console.error(`Offer letter download failed for ${doc.candidateId}:`, err.message);
      setTimeout(() => fs.existsSync(pdfPath) && fs.unlinkSync(pdfPath), 60000);
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/verify/:candidateId/certificate', async (req, res) => {
  try {
    const doc = await Applicant.findOne({ candidateId: req.params.candidateId });
    if (!doc || doc.paymentStatus !== 'paid') {
      return res.status(404).json({ success: false, message: 'No verified student record found for this ID.' });
    }
    if (!SEND_CERTIFICATE_IMMEDIATELY && (!doc.endDate || doc.endDate > new Date())) {
      return res.status(403).json({ success: false, message: 'Certificate is available only after internship completion.' });
    }

    const { pdfPath, certificateId } = await generateCertificatePDF({
      fullName: doc.fullName,
      domain: doc.domain,
      candidateId: doc.candidateId,
      startDate: doc.startDate,
      endDate: doc.endDate,
    });

    if (!doc.certificateId) {
      await Applicant.findByIdAndUpdate(doc._id, { certificateId });
    }

    res.download(pdfPath, `CareerProof_Certificate_${certificateId}.pdf`, err => {
      if (err) console.error(`Certificate download failed for ${doc.candidateId}:`, err.message);
      setTimeout(() => fs.existsSync(pdfPath) && fs.unlinkSync(pdfPath), 60000);
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/certificates/reset-test', async (_, res) => {
  try {
    const result = await Applicant.updateMany(
      { candidateId: /^CP-TEST-/ },
      {
        $set: {
          certificateSent: false,
          certificateSentAt: null,
          certificateId: null,
          certificatePdfPath: null,
          certificateEmailError: null,
        },
      }
    );
    res.json({ success: true, matched: result.matchedCount, modified: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/applications', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const [data, total] = await Promise.all([
      Applicant.find().sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit),
      Applicant.countDocuments(),
    ]);
    res.json({ success: true, total, page, pages: Math.ceil(total / limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/applications/:candidateId', async (req, res) => {
  try {
    const doc = await Applicant.findOne({ candidateId: req.params.candidateId });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

if (require.main === module) {
  connectDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`\nCareerProof API  ->  http://localhost:${PORT}`);
        console.log(`MongoDB          ->  ${(process.env.MONGODB_URI || '').slice(0, 42)}...`);
        console.log(`Email provider   ->  ${process.env.EMAIL_PROVIDER || 'gmail'}`);
        console.log(`Razorpay         ->  ${razorpay ? `${razorpayMode} keys configured` : 'missing keys'}\n`);
      });

      sendDueCertificates().catch(err => console.error('Certificate startup job failed:', err.message));
      setInterval(() => {
        sendDueCertificates().catch(err => console.error('Certificate scheduled job failed:', err.message));
      }, 24 * 60 * 60 * 1000);
    })
    .catch(err => {
      console.error('MongoDB failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;
