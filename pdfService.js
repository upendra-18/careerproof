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
  doc.font('Times-Italic').fontSize(24).fillColor('#080808').text(name, x, y, { width, align: 'center' });
  doc.moveTo(x, y + 38).lineTo(x + width, y + 38).lineWidth(1).strokeColor('#111111').stroke();
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text(name, x, y + 44, { width, align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor('#666666').text(role, x, y + 60, { width, align: 'center' });
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

  doc.font('Helvetica-Bold').fontSize(24).fillColor('#111111').text('INTERNSHIP OFFER LETTER', 54, 128, { width: 486, align: 'center' });
  doc.moveTo(74, 166).lineTo(doc.page.width - 74, 166).lineWidth(1.4).strokeColor('#222222').stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
    .text(formatDate(new Date()), 54, 192)
    .text(`STUDENT ID: ${candidateId}`, 320, 192, { width: 220, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(12).text(`Name: ${fullName}`, 54, 224);

  const paragraphs = [
    `Dear ${fullName},`,
    `We are pleased to inform you that your application for the ${domain} Intern position has been reviewed and accepted by our recruitment team. We are glad to extend this official internship offer under the terms mentioned in this document.`,
    `As a ${domain} Intern, you will actively participate in practical learning tasks, real-world project work, documentation, and portfolio-building activities. Your responsibilities include completing assigned tasks, maintaining proper communication, submitting work within deadlines, and demonstrating professional conduct throughout the internship tenure.`,
    `Performance evaluation will be based on task completion, consistency, professionalism, communication, and adherence to project milestones.`,
    `The internship tenure is valid from ${formatDate(startDate)} to ${formatDate(endDate, 'completion date')}. Timely task submission and professional conduct are mandatory to receive the internship completion certificate.`,
    'We congratulate you on your selection and look forward to your active participation in the CareerProof Internship Program.',
  ];

  let y = 254;
  doc.font('Helvetica').fontSize(11).fillColor('#222222');
  for (const paragraph of paragraphs) {
    doc.text(paragraph, 54, y, { width: 486, align: 'justify', lineGap: 3 });
    y = doc.y + 12;
  }

  const rows = [
    ['Domain / Role', `${domain} Intern`],
    ['Start Date', formatDate(startDate)],
    ['End Date', formatDate(endDate, 'To be confirmed')],
    ['Duration', duration],
    ['Mode', 'Remote / Online'],
  ];
  let rowY = y + 4;
  for (const [label, value] of rows) {
    doc.rect(54, rowY, 150, 26).fillAndStroke('#f7f7f7', '#dedede');
    doc.rect(204, rowY, 336, 26).fillAndStroke('#ffffff', '#dedede');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(label, 64, rowY + 8, { width: 130 });
    doc.font('Helvetica').fontSize(10).text(value, 214, rowY + 8, { width: 310 });
    rowY += 26;
  }

  addSignature(doc, 'Aniket Manwalkar', 'Authorized Signatory', 54, 670, 170);
  addIsoMark(doc, 252, 640, 74);
  addSignature(doc, 'Syeda Quadri', 'Program Director', 370, 670, 170);

  doc.font('Helvetica').fontSize(9).fillColor('#555555')
    .text('CareerProof Internship Program', 54, 760)
    .text(process.env.SUPPORT_EMAIL || 'careerproof.services@gmail.com', 225, 760, { width: 180, align: 'center' })
    .text('India', 470, 760, { width: 70, align: 'right' });

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
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(2).strokeColor('#151515').stroke();
  doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).lineWidth(1).strokeColor('#c8a44d').stroke();

  if (fs.existsSync(logoPath)) {
    doc.save();
    doc.opacity(0.2).image(logoPath, 192, 70, { width: 470 });
    doc.opacity(1);
    doc.restore();
  }

  addAicteMark(doc, 58, 50, 92);
  doc.image(qrBuffer, doc.page.width - 142, 58, { width: 78 });
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#141b3d').text('VERIFY', doc.page.width - 148, 139, { width: 90, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(24).fillColor('#141b3d').text('CAREER', 0, 70, { width: doc.page.width, align: 'center', continued: true });
  doc.fillColor('#00a977').text('PROOF');
  doc.font('Times-Roman').fontSize(20).fillColor('#444444').text('THIS ACKNOWLEDGES THAT', 0, 152, { width: doc.page.width, align: 'center', characterSpacing: 3 });
  doc.font('Helvetica-Bold').fontSize(34).fillColor('#141b3d').text(fullName.toUpperCase(), 90, 200, { width: doc.page.width - 180, align: 'center' });
  doc.font('Times-Roman').fontSize(18).fillColor('#555555').text('has successfully completed the', 0, 252, { width: doc.page.width, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(25).fillColor('#111111').text('CERTIFICATE OF INTERNSHIP', 0, 292, { width: doc.page.width, align: 'center', characterSpacing: 4 });

  const statement = `Has worked as a ${domain} Intern with us from ${formatDate(startDate)} to ${formatDate(endDate)}, demonstrating sincerity, enthusiasm, discipline, and strong professional skills. We wish them the best in their future endeavors.`;
  doc.font('Times-Roman').fontSize(17).fillColor('#333333').text(statement, 115, 340, { width: doc.page.width - 230, align: 'center', lineGap: 5 });

  addSignature(doc, 'Aniket Manwalkar', 'Authorized Signatory', 92, 465, 190);
  addIsoMark(doc, doc.page.width / 2 - 58, 438, 116);
  addSignature(doc, 'Syeda Quadri', 'CareerProof', doc.page.width - 282, 465, 190);

  doc.font('Helvetica').fontSize(10).fillColor('#333333')
    .text(`Issue Date: ${formatDate(new Date())}`, 72, 552)
    .text(`Credential ID: ${certificateId}`, doc.page.width - 280, 552, { width: 210, align: 'right' });

  await writePdf(doc, pdfPath);
  console.log(`Certificate PDF generated: ${fileName}`);
  return { pdfPath, certificateId };
}

module.exports = { generateOfferLetterPDF, generateCertificatePDF };
