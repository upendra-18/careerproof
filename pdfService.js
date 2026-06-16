const fs          = require('fs');
const path        = require('path');
const PDFDocument = require('pdfkit');
const QRCode      = require('qrcode');

// ─── Asset resolver ──────────────────────────────────────────────────────────
// Tries multiple possible root locations so assets always load regardless of
// whether pdfService.js is called from services/, root, or a Vercel lambda.
function resolveAsset(filename) {
  const candidates = [
    path.join(__dirname, '..', 'assets', filename),   // services/../assets  (normal)
    path.join(__dirname, 'assets', filename),           // services/assets     (flat)
    path.join(process.cwd(), 'assets', filename),       // cwd/assets          (Render)
    path.join('/tmp', 'assets', filename),              // /tmp/assets         (Vercel)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  console.warn(`⚠️  Asset not found: ${filename} (tried ${candidates.length} locations)`);
  return null;
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function getPublicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
}
function buildVerificationUrl(candidateId) {
  return `${getPublicBaseUrl()}/verify.html?id=${encodeURIComponent(candidateId)}`;
}
function formatDate(value, fallback = '') {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}
function getOutputDir() {
  const outDir = process.env.VERCEL
    ? path.join('/tmp', 'generated_pdfs')
    : path.join(__dirname, '..', 'generated_pdfs');
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}
function safeFileName(v) {
  return v.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
}
async function createQrBuffer(candidateId) {
  const dataUrl = await QRCode.toDataURL(buildVerificationUrl(candidateId), {
    errorCorrectionLevel: 'M', margin: 1, width: 180,
    color: { dark: '#111111', light: '#ffffff' },
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

// ─── Brand / logo helpers ────────────────────────────────────────────────────
function addBrand(doc, x = 54, y = 42) {
  doc.font('Helvetica-Bold').fontSize(28).fillColor('#141b3d').text('Career', x, y);
  const cw = doc.widthOfString('Career');
  doc.fillColor('#00a977').text('Proof', x + cw, y);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
    .text('SKILLS THAT GET YOU HIRED', x, y + 32, { characterSpacing: 1.4 });
}

/**
 * addIsoMark — renders the real ISO-9001 badge image.
 * Falls back to a clean drawn version only when the image file is absent.
 */
function addIsoMark(doc, x, y, size) {
  const imgPath = resolveAsset('iso-9001.png');

  if (imgPath) {
    // ✅ Real ISO badge
    doc.image(imgPath, x, y, { fit: [size, size], align: 'center', valign: 'center' });
    return;
  }

  // ── Fallback: drawn ISO badge ────────────────────────────────────────────
  doc.save();
  const cx = x + size / 2, cy = y + size / 2, r = size / 2 - 1;
  // outer ring
  doc.circle(cx, cy, r).lineWidth(2.5).strokeColor('#005eb8').stroke();
  // inner ring
  doc.circle(cx, cy, r * 0.55).lineWidth(1.2).strokeColor('#005eb8').stroke();
  // top arc label
  doc.font('Helvetica-Bold').fontSize(size * 0.13).fillColor('#005eb8')
    .text('ISO CERTIFIED', x, y + size * 0.14, { width: size, align: 'center' });
  // main text
  doc.font('Helvetica-Bold').fontSize(size * 0.28).fillColor('#005eb8')
    .text('ISO', x, y + size * 0.34, { width: size, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(size * 0.18).fillColor('#1a1a1a')
    .text('9001:2015', x, y + size * 0.57, { width: size, align: 'center' });
  doc.restore();
}

/**
 * addAicteMark — renders the real AICTE logo image.
 * Falls back to a clean drawn version only when the image file is absent.
 */
function addAicteMark(doc, x, y, size) {
  const imgPath = resolveAsset('aicte-logo.png');

  if (imgPath) {
    // ✅ Real AICTE logo
    doc.image(imgPath, x, y, { fit: [size, size], align: 'center', valign: 'center' });
    return;
  }

  // ── Fallback: drawn AICTE badge ──────────────────────────────────────────
  doc.save();
  const cx = x + size / 2, cy = y + size / 2, r = size / 2 - 1;
  doc.circle(cx, cy, r).fillAndStroke('#ffd45a', '#b8860b');
  doc.circle(cx, cy, r * 0.68).fillAndStroke('#ffe88b', '#ef9b1b');
  doc.font('Helvetica-Bold').fontSize(size * 0.16).fillColor('#d71920')
    .text('AICTE', x, y + size * 0.37, { width: size, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(size * 0.07).fillColor('#1f2937')
    .text('All India Council for', x, y + size * 0.18, { width: size, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(size * 0.07).fillColor('#1f2937')
    .text('Technical Education', x, y + size * 0.27, { width: size, align: 'center' });
  doc.font('Helvetica').fontSize(size * 0.065).fillColor('#444444')
    .text('Yogah Karmasu Kaushalam', x, y + size * 0.56, { width: size, align: 'center' });
  doc.restore();
}

function addSignature(doc, name, role, x, y, width, imageName) {
  const imgPath = imageName ? resolveAsset(imageName) : null;
  const imageHeight = 52;
  const lineY   = y + imageHeight + 2;
  if (imgPath) {
    doc.image(imgPath, x + 4, y, { fit: [width - 8, imageHeight], align: 'center', valign: 'bottom' });
  } else {
    doc.font('Times-Italic').fontSize(22).fillColor('#080808')
      .text(name, x, y + 16, { width, align: 'center' });
  }
  doc.moveTo(x, lineY).lineTo(x + width, lineY).lineWidth(1).strokeColor('#111111').stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
    .text(name, x, lineY + 5,  { width, align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor('#666666')
    .text(role, x, lineY + 18, { width, align: 'center' });
}

function addCertificateBrand(doc, y) {
  const sp = 12;
  doc.font('Helvetica-Bold').fontSize(16);
  const cw = doc.widthOfString('CAREER', { characterSpacing: sp });
  const pw = doc.widthOfString('PROOF',  { characterSpacing: sp });
  const sx = doc.page.width / 2 - (cw + pw + 8) / 2;
  doc.fillColor('#141b3d').text('CAREER', sx,        y, { characterSpacing: sp });
  doc.fillColor('#00a977').text('PROOF',  sx + cw + 8, y, { characterSpacing: sp });
}

function textBlock(doc, text, x, y, width, opts = {}) {
  doc.text(text, x, y, { width, align: opts.align || 'justify', lineGap: opts.lineGap ?? 2 });
  return doc.y;
}

async function writePdf(doc, pdfPath) {
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// generateOfferLetterPDF
// ─────────────────────────────────────────────────────────────────────────────
async function generateOfferLetterPDF(applicantData) {
  const { fullName, domain, candidateId, startDate, endDate, duration } = applicantData;
  const outDir   = getOutputDir();
  const fileName = `CareerProof_OfferLetter_${safeFileName(fullName)}_${candidateId.replace(/\//g, '-')}.pdf`;
  const pdfPath  = path.join(outDir, fileName);
  const qrBuffer = await createQrBuffer(candidateId);

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const W = doc.page.width, cX = 54, cW = W - 108;

  // Header
  doc.rect(0, 0, W, 68).fill('#f7fffb');
  addBrand(doc, cX, 25);
  doc.image(qrBuffer, W - 126, 28, { width: 60 });
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#333333')
    .text('VERIFY STUDENT ID', W - 138, 90, { width: 90, align: 'center' });

  // Title
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#111111')
    .text('INTERNSHIP OFFER LETTER', cX, 95, { width: cW, align: 'center' });
  doc.moveTo(78, 133).lineTo(W - 78, 133).lineWidth(1.2).strokeColor('#222222').stroke();

  // Meta
  doc.font('Helvetica-Bold').fontSize(8.8).fillColor('#111111')
    .text(formatDate(new Date()), cX, 154)
    .text(`STUDENT ID: ${candidateId}`, 320, 154, { width: 220, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9.5).text(`Name: ${fullName}`, cX, 182);

  // Body
  doc.font('Helvetica').fontSize(8.9).fillColor('#222222');
  textBlock(doc, `Dear ${fullName},`, cX, 208, cW, { align: 'left', lineGap: 0 });
  textBlock(doc, `We are pleased to offer you the ${domain} Intern position at CareerProof. Your application has been reviewed and accepted by our recruitment team under the terms mentioned in this document.`, cX, 232, cW, { lineGap: 0 });
  textBlock(doc, `As a ${domain} Intern, you will participate in practical learning tasks, real-world project work, documentation, and portfolio-building activities. You are expected to communicate professionally, submit tasks on time, and maintain consistent conduct throughout the internship.`, cX, 278, cW, { lineGap: 0 });

  // Table
  const rows = [
    ['Domain / Role', `${domain} Intern`],
    ['Start Date',    formatDate(startDate)],
    ['End Date',      formatDate(endDate, 'To be confirmed')],
    ['Duration',      duration],
    ['Mode',          'Remote / Online'],
  ];
  let rowY = 350;
  for (const [label, value] of rows) {
    doc.rect(cX, rowY, 150, 21).fillAndStroke('#f7f7f7', '#dedede');
    doc.rect(cX + 150, rowY, cW - 150, 21).fillAndStroke('#ffffff', '#dedede');
    doc.font('Helvetica-Bold').fontSize(8.6).fillColor('#111111').text(label, cX + 10, rowY + 6, { width: 130 });
    doc.font('Helvetica').fontSize(8.6).text(value, cX + 160, rowY + 6, { width: cW - 170 });
    rowY += 21;
  }

  doc.font('Helvetica').fontSize(8.5).fillColor('#222222');
  textBlock(doc, 'Performance will be evaluated on task completion, consistency, professionalism, communication, and adherence to project milestones. Mentors will provide guidance, but a proactive working approach is expected.', cX, 472, cW, { lineGap: 0 });
  textBlock(doc, `This internship is valid from ${formatDate(startDate)} to ${formatDate(endDate, 'completion date')}. Failure to join, communicate, or begin assigned work may result in withdrawal of this offer.`, cX, 520, cW, { lineGap: 0 });

  // Notice box
  doc.rect(cX, 566, cW, 34).fill('#f5f7ff');
  doc.rect(cX, 566, 4, 34).fill('#141b3d');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
    .text('Important:', cX + 14, 576, { continued: true });
  doc.font('Helvetica').fontSize(8.5)
    .text(' Timely task submission and professional conduct are mandatory to receive the internship completion certificate.', { width: cW - 28 });

  doc.font('Helvetica-Bold').fontSize(8.6).fillColor('#333333')
    .text('We congratulate you on your selection and look forward to your active participation in the CareerProof Internship Program.', cX, 612, { width: cW });

  // Signatures row: left sig | ISO badge | right sig
  addSignature(doc, 'Adithya Mishra', 'Authorized Signatory', 64,  648, 190, 'signature-adithya.png');
  addIsoMark  (doc, 272, 651, 52);   // ISO badge — real image
  addSignature(doc, 'Sneha Patel',    'Program Director',      344, 648, 190, 'signature-sneha.png');

  // Footer
  doc.font('Helvetica').fontSize(9).fillColor('#555555')
    .text('CareerProof Internship Program', cX, 762)
    .text(process.env.SUPPORT_EMAIL || 'careerproof.services@gmail.com', 225, 762, { width: 180, align: 'center' })
    .text('India', 470, 762, { width: 70, align: 'right' });

  await writePdf(doc, pdfPath);
  console.log(`📄  Offer letter generated: ${fileName}`);
  return pdfPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateCertificatePDF
// ─────────────────────────────────────────────────────────────────────────────
async function generateCertificatePDF(applicantData) {
  const { fullName, domain, candidateId, startDate, endDate } = applicantData;
  const outDir        = getOutputDir();
  const certificateId = `CP-CERT-${candidateId.replace(/^CP-/, '').replace(/-/g, '')}`;
  const fileName      = `CareerProof_Certificate_${safeFileName(fullName)}_${candidateId.replace(/\//g, '-')}.pdf`;
  const pdfPath       = path.join(outDir, fileName);
  const qrBuffer      = await createQrBuffer(candidateId);

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const PW = doc.page.width, PH = doc.page.height;

  // Background
  doc.rect(0, 0, PW, PH).fill('#ffffff');
  doc.rect(0, 0, 34, PH).fill('#fff2f8');
  doc.rect(PW - 34, 0, 34, PH).fill('#fff2f8');
  doc.rect(24, 24, PW - 48, PH - 48).lineWidth(2).strokeColor('#151515').stroke();
  doc.rect(30, 30, PW - 60, PH - 60).lineWidth(1).strokeColor('#c8a44d').stroke();

  // Watermark
  const wLogo = resolveAsset('logo-removebg-preview.png');
  if (wLogo) {
    doc.save();
    doc.opacity(0.18).image(wLogo, PW / 2 - 180, 116, { width: 360 });
    doc.opacity(1); doc.restore();
  }

  // ── AICTE logo (top-left) — real image ───────────────────────────────────
  addAicteMark(doc, 54, 48, 76);

  // QR code (top-right)
  doc.image(qrBuffer, PW - 120, 48, { width: 64 });
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#141b3d')
    .text('VERIFY', PW - 125, 116, { width: 74, align: 'center' });

  // Certificate text
  addCertificateBrand(doc, 46);
  doc.font('Times-Roman').fontSize(18).fillColor('#444444')
    .text('T H I S  A C K N O W L E D G E S  T H A T', 0, 102, { width: PW, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(34).fillColor('#141b3d')
    .text(fullName.toUpperCase(), 90, 142, { width: PW - 180, align: 'center' });
  doc.font('Times-Roman').fontSize(16).fillColor('#555555')
    .text('has successfully completed the', 0, 192, { width: PW, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#111111')
    .text('C E R T I F I C A T E  O F  I N T E R N S H I P', 0, 230, { width: PW, align: 'center' });
  doc.font('Times-Roman').fontSize(15).fillColor('#333333')
    .text(`Has worked as a ${domain} Intern with us from ${formatDate(startDate)} to ${formatDate(endDate)}, demonstrating sincerity, enthusiasm, discipline, and strong professional skills. We wish them the best in their future endeavors.`,
      108, 278, { width: PW - 216, align: 'center', lineGap: 4 });

  // Signatures row: left | ISO badge (centre) |  right
  addSignature(doc, 'Adithya Mishra', 'Authorized Signatory', 70,       390, 240, 'signature-adithya.png');
  addIsoMark  (doc, PW / 2 - 50,       374, 100);   // ISO badge — real image
  addSignature(doc, 'Sneha Patel',     'CareerProof',          PW - 310, 390, 240, 'signature-sneha.png');

  // Footer
  doc.font('Helvetica').fontSize(10).fillColor('#333333')
    .text(`Issue Date: ${new Date().toLocaleDateString('en-IN')}`, 54, 560)
    .text(`Credential ID: ${certificateId}`, PW - 300, 560, { width: 246, align: 'right' });

  await writePdf(doc, pdfPath);
  console.log(`📜  Certificate generated: ${fileName}`);
  return { pdfPath, certificateId };
}

module.exports = { generateOfferLetterPDF, generateCertificatePDF };
