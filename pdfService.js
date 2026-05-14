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
  doc.font('Helvetica-Bold').fontSize(28).fillColor('#141b3d').text('Career', x, y);
  const careerWidth = doc.widthOfString('Career');
  doc.fillColor('#00a977').text('Proof', x + careerWidth, y);
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
  const pageWidth = doc.page.width;
  const contentX = 54;
  const contentWidth = pageWidth - 108;

  doc.rect(0, 0, pageWidth, 78).fill('#f7fffb');
  doc.fillColor('#151515');
  addBrand(doc, contentX, 34);
  doc.image(qrBuffer, pageWidth - 126, 34, { width: 66 });
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#333333').text('VERIFY STUDENT ID', pageWidth - 138, 102, { width: 90, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(26).fillColor('#111111').text('INTERNSHIP OFFER LETTER', contentX, 112, { width: contentWidth, align: 'center' });
  doc.moveTo(76, 151).lineTo(pageWidth - 76, 151).lineWidth(1.4).strokeColor('#222222').stroke();
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111')
    .text(formatDate(new Date()), contentX, 176)
    .text(`STUDENT ID: ${candidateId}`, 320, 176, { width: 220, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(10.5).text(`Name: ${fullName}`, contentX, 207);

  doc.font('Helvetica').fontSize(9.6).fillColor('#222222');
  textBlock(doc, `Dear ${fullName},`, contentX, 236, contentWidth, { align: 'left', lineGap: 1 });
  textBlock(doc, `We are pleased to offer you the ${domain} Intern position at CareerProof. Your application has been reviewed and accepted by our recruitment team under the terms mentioned in this document.`, contentX, 262, contentWidth, { lineGap: 1 });
  textBlock(doc, `As a ${domain} Intern, you will participate in practical learning tasks, real-world project work, documentation, and portfolio-building activities. You are expected to communicate professionally, submit tasks on time, and maintain consistent conduct throughout the internship.`, contentX, 313, contentWidth, { lineGap: 1 });

  const rows = [
    ['Domain / Role', `${domain} Intern`],
    ['Start Date', formatDate(startDate)],
    ['End Date', formatDate(endDate, 'To be confirmed')],
    ['Duration', duration],
    ['Mode', 'Remote / Online'],
  ];
  let rowY = 392;
  for (const [label, value] of rows) {
    doc.rect(contentX, rowY, 150, 24).fillAndStroke('#f7f7f7', '#dedede');
    doc.rect(contentX + 150, rowY, contentWidth - 150, 24).fillAndStroke('#ffffff', '#dedede');
    doc.font('Helvetica-Bold').fontSize(9.4).fillColor('#111111').text(label, contentX + 10, rowY + 7, { width: 130 });
    doc.font('Helvetica').fontSize(9.4).text(value, contentX + 160, rowY + 7, { width: contentWidth - 170 });
    rowY += 24;
  }

  doc.font('Helvetica').fontSize(9.3).fillColor('#222222');
  textBlock(doc, 'Performance will be evaluated on task completion, consistency, professionalism, communication, and adherence to project milestones. Mentors will provide guidance, but a proactive working approach is expected.', contentX, 526, contentWidth, { lineGap: 1 });
  textBlock(doc, `This internship is valid from ${formatDate(startDate)} to ${formatDate(endDate, 'completion date')}. Failure to join, communicate, or begin assigned work may result in withdrawal of this offer.`, contentX, 580, contentWidth, { lineGap: 1 });

  doc.rect(contentX, 632, contentWidth, 38).fill('#f5f7ff');
  doc.rect(contentX, 632, 4, 38).fill('#141b3d');
  doc.font('Helvetica-Bold').fontSize(9.4).fillColor('#111111').text('Important:', contentX + 14, 642, { continued: true });
  doc.font('Helvetica').fontSize(9.4).text(' Timely task submission and professional conduct are mandatory to receive the internship completion certificate.', { width: contentWidth - 28 });

  doc.font('Helvetica-Bold').fontSize(9.4).fillColor('#333333').text('We congratulate you on your selection and look forward to your active participation in the CareerProof Internship Program.', contentX, 688, { width: contentWidth });

  addSignature(doc, 'Aniket Manwalkar', 'Authorized Signatory', 58, 723, 210);
  addIsoMark(doc, 292, 708, 78);
  addSignature(doc, 'Syeda Quadri', 'Program Director', 335, 723, 210);

  doc.font('Helvetica').fontSize(9).fillColor('#555555')
    .text('CareerProof Internship Program', contentX, 820)
    .text(process.env.SUPPORT_EMAIL || 'careerproof.services@gmail.com', 225, 820, { width: 180, align: 'center' })
    .text('India', 470, 820, { width: 70, align: 'right' });

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
