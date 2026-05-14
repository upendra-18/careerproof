const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

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
  const outDir = process.env.VERCEL ? path.join('/tmp', 'generated_pdfs') : path.join(__dirname, 'generated_pdfs');
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

function safeFileName(value) {
  return value.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
}

async function createQrBuffer(candidateId) {
  const dataUrl = await QRCode.toDataURL(buildVerificationUrl(candidateId), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 180,
    color: { dark: '#111111', light: '#ffffff' },
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

function addBrand(doc, x = 54, y = 42) {
  doc.font('Helvetica-Bold').fontSize(28).fillColor('#141b3d').text('Career', x, y, { continued: true });
  doc.fillColor('#00a977').text('Proof');
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text('SKILLS THAT GET YOU HIRED', x, y + 32, {
    characterSpacing: 1.4,
  });
}

function addIsoMark(doc, x, y, size) {
  doc.save();
  doc.circle(x + size / 2, y + size / 2, size / 2).lineWidth(2).strokeColor('#005eb8').stroke();
  doc.circle(x + size / 2, y + size / 2, size * 0.31).lineWidth(1).strokeColor('#005eb8').stroke();
  doc.font('Helvetica-Bold').fontSize(size * 0.26).fillColor('#005eb8').text('ISO', x, y + size * 0.35, { width: size, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(size * 0.18).text('9001', x, y + size * 0.66, { width: size, align: 'center' });
  doc.restore();
}

function addAicteMark(doc, x, y, size) {
  doc.save();
  doc.circle(x + size / 2, y + size / 2, size / 2).fillAndStroke('#ffd45a', '#111111');
  doc.circle(x + size / 2, y + size / 2, size * 0.36).fillAndStroke('#ffe88b', '#ef9b1b');
  doc.font('Helvetica-Bold').fontSize(size * 0.15).fillColor('#d71920').text('AICTE', x, y + size * 0.38, { width: size, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(size * 0.055).fillColor('#1f2937').text('All India Council for Technical Education', x + size * 0.1, y + size * 0.2, { width: size * 0.8, align: 'center' });
  doc.font('Helvetica').fontSize(size * 0.055).text('Yogah Karmasu Kaushalam', x, y + size * 0.57, { width: size, align: 'center' });
  doc.circle(x + size / 2, y + size * 0.76, size * 0.11).fillAndStroke('#0877bd', '#111111');
  doc.restore();
}

function addSignature(doc, name, role, x, y, width) {
  doc.font('Times-Italic').fontSize(30).fillColor('#080808').text(name, x, y, { width, align: 'center' });
  doc.moveTo(x, y + 38).lineTo(x + width, y + 38).lineWidth(1).strokeColor('#111111').stroke();
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text(name, x, y + 44, { width, align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor('#666666').text(role, x, y + 60, { width, align: 'center' });
}

function textBlock(doc, text, x, y, width, options = {}) {
  doc.text(text, x, y, {
    width,
    align: options.align || 'justify',
    lineGap: options.lineGap ?? 2,
  });
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

async function generateOfferLetterPDF(applicantData) {
  const { fullName, domain, candidateId, startDate, endDate, duration } = applicantData;
  const outDir = getOutputDir();
  const fileName = `CareerProof_OfferLetter_${safeFileName(fullName)}_${candidateId.replace(/\//g, '-')}.pdf`;
  const pdfPath = path.join(outDir, fileName);
  const qrBuffer = await createQrBuffer(candidateId);

  const doc = new PDFDocument({ size: 'A4', margin: 54 });
  doc.rect(0, 0, doc.page.width, 82).fill('#f7fffb');
  doc.fillColor('#151515');
  addBrand(doc);
  doc.image(qrBuffer, doc.page.width - 138, 35, { width: 76 });
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#333333').text('VERIFY STUDENT ID', doc.page.width - 154, 113, { width: 108, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(28).fillColor('#111111').text('INTERNSHIP OFFER LETTER', 54, 118, { width: 486, align: 'center' });
  doc.moveTo(74, 160).lineTo(doc.page.width - 74, 160).lineWidth(1.4).strokeColor('#222222').stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
    .text(formatDate(new Date()), 54, 184)
    .text(`STUDENT ID: ${candidateId}`, 320, 184, { width: 220, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(11).text(`Name: ${fullName}`, 54, 218);

  doc.font('Helvetica').fontSize(10.5).fillColor('#222222');
  let y = 248;
  y = textBlock(doc, `Dear ${fullName},`, 54, y, 486, { align: 'left' }) + 12;
  y = textBlock(doc, `We are pleased to inform you that your application for the ${domain} Intern position has been reviewed and accepted by our recruitment team. We are glad to extend this official internship offer under the terms mentioned in this document.`, 54, y, 486) + 10;
  y = textBlock(doc, `This communication is in reference to your application submitted to CareerProof. Your profile was evaluated against multiple selection criteria, and our team found your learning interest, technical orientation, and problem-solving approach aligned with the standards and ongoing project requirements of this internship program.`, 54, y, 486) + 10;
  y = textBlock(doc, `As a ${domain} Intern, you will actively participate in practical learning tasks, real-world project work, documentation, and portfolio-building activities. Your responsibilities will include completing assigned tasks, maintaining proper communication, submitting work within deadlines, and demonstrating consistent professional conduct throughout the internship tenure.`, 54, y, 486) + 14;

  const rows = [
    ['Domain / Role', `${domain} Intern`],
    ['Start Date', formatDate(startDate)],
    ['End Date', formatDate(endDate, 'To be confirmed')],
    ['Duration', duration],
    ['Mode', 'Remote / Online'],
  ];
  let rowY = y;
  for (const [label, value] of rows) {
    doc.rect(54, rowY, 150, 25).fillAndStroke('#f7f7f7', '#dedede');
    doc.rect(204, rowY, 336, 25).fillAndStroke('#ffffff', '#dedede');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(label, 64, rowY + 8, { width: 130 });
    doc.font('Helvetica').fontSize(10).text(value, 214, rowY + 8, { width: 310 });
    rowY += 25;
  }

  doc.font('Helvetica').fontSize(10.2).fillColor('#222222');
  y = rowY + 14;
  y = textBlock(doc, 'Performance evaluation will be based on task completion, consistency, professionalism, communication, and adherence to project milestones. While mentors and coordinators will provide guidance, a proactive and self-driven working approach is expected from every intern.', 54, y, 486) + 10;
  y = textBlock(doc, `The internship tenure is valid from ${formatDate(startDate)} to ${formatDate(endDate, 'completion date')}. Failure to join, communicate, or commence assigned responsibilities within this period may result in withdrawal of this offer without further notice.`, 54, y, 486) + 8;

  doc.rect(54, y, 486, 42).fill('#f5f7ff');
  doc.rect(54, y, 4, 42).fill('#141b3d');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Important:', 70, y + 10, { continued: true });
  doc.font('Helvetica').fontSize(10).text(' Timely task submission and professional conduct are mandatory to receive the internship completion certificate at the end of the internship period.', { width: 446 });

  y += 55;
  textBlock(doc, 'We congratulate you on your selection and look forward to your active participation in the CareerProof Internship Program.', 54, y, 486);

  addSignature(doc, 'Aniket Manwalkar', 'Authorized Signatory', 60, 686, 210);
  addIsoMark(doc, 292, 674, 74);
  addSignature(doc, 'Syeda Quadri', 'Program Director', 335, 686, 210);

  doc.font('Helvetica').fontSize(9).fillColor('#555555')
    .text('CareerProof Internship Program', 54, 805)
    .text(process.env.SUPPORT_EMAIL || 'careerproof.services@gmail.com', 225, 805, { width: 180, align: 'center' })
    .text('India', 470, 805, { width: 70, align: 'right' });

  await writePdf(doc, pdfPath);
  console.log(`PDF generated: ${fileName}`);
  return pdfPath;
}

async function generateCertificatePDF(applicantData) {
  const { fullName, domain, candidateId, startDate, endDate } = applicantData;
  const outDir = getOutputDir();
  const certificateId = `CP-CERT-${candidateId.replace(/^CP-/, '').replace(/-/g, '')}`;
  const fileName = `CareerProof_Certificate_${safeFileName(fullName)}_${candidateId.replace(/\//g, '-')}.pdf`;
  const pdfPath = path.join(outDir, fileName);
  const qrBuffer = await createQrBuffer(candidateId);
  const logoPath = path.join(__dirname, 'assets', 'logo-removebg-preview.png');

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 44 });
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
  doc.rect(0, 0, 34, doc.page.height).fill('#fff2f8');
  doc.rect(doc.page.width - 34, 0, 34, doc.page.height).fill('#fff2f8');
  doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).lineWidth(2).strokeColor('#151515').stroke();
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(1).strokeColor('#c8a44d').stroke();

  if (fs.existsSync(logoPath)) {
    doc.save();
    doc.opacity(0.18).image(logoPath, doc.page.width / 2 - 180, 116, { width: 360 });
    doc.opacity(1);
    doc.restore();
  }

  addAicteMark(doc, 54, 48, 76);
  doc.image(qrBuffer, doc.page.width - 120, 48, { width: 64 });
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#141b3d').text('VERIFY', doc.page.width - 125, 116, { width: 74, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#141b3d').text('C A R E E R', 0, 46, { width: doc.page.width, align: 'center', continued: true });
  doc.fillColor('#00a977').text(' P R O O F');
  doc.font('Times-Roman').fontSize(18).fillColor('#444444').text('T H I S  A C K N O W L E D G E S  T H A T', 0, 102, { width: doc.page.width, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(34).fillColor('#141b3d').text(fullName.toUpperCase(), 90, 142, { width: doc.page.width - 180, align: 'center' });
  doc.font('Times-Roman').fontSize(16).fillColor('#555555').text('has successfully completed the', 0, 192, { width: doc.page.width, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#111111').text('C E R T I F I C A T E  O F  I N T E R N S H I P', 0, 230, { width: doc.page.width, align: 'center' });

  const statement = `Has worked as a ${domain} Intern with us from ${formatDate(startDate)} to ${formatDate(endDate)}, demonstrating sincerity, enthusiasm, discipline, and strong professional skills. We wish them the best in their future endeavors.`;
  doc.font('Times-Roman').fontSize(15).fillColor('#333333').text(statement, 108, 278, { width: doc.page.width - 216, align: 'center', lineGap: 4 });

  addSignature(doc, 'Aniket Manwalkar', 'Authorized Signatory', 70, 390, 240);
  addIsoMark(doc, doc.page.width / 2 - 50, 374, 100);
  addSignature(doc, 'Syeda Quadri', 'CareerProof', doc.page.width - 310, 390, 240);

  doc.font('Helvetica').fontSize(10).fillColor('#333333')
    .text(`Issue Date: ${new Date().toLocaleDateString('en-IN')}`, 54, 560)
    .text(`Credential ID: ${certificateId}`, doc.page.width - 300, 560, { width: 246, align: 'right' });

  await writePdf(doc, pdfPath);
  console.log(`Certificate PDF generated: ${fileName}`);
  return { pdfPath, certificateId };
}

module.exports = { generateOfferLetterPDF, generateCertificatePDF };
