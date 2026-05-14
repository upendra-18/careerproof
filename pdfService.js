const fs         = require('fs');
const path       = require('path');
const QRCode     = require('qrcode');

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = require('@sparticuz/chromium');
    const puppeteer = require('puppeteer-core');
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  const puppeteer = require('puppeteer');
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

/**
 * Renders an HTML template string with {{variable}} placeholders.
 */
function renderTemplate(templatePath, vars) {
  let html = fs.readFileSync(templatePath, 'utf-8');
  for (const [key, val] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, val ?? '');
  }
  return html;
}

function fileToDataUrl(filePath, mimeType) {
  if (!fs.existsSync(filePath)) return '';
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

function getPublicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
}

function buildVerificationUrl(candidateId) {
  return `${getPublicBaseUrl()}/verify.html?id=${encodeURIComponent(candidateId)}`;
}

async function createQrDataUrl(candidateId) {
  return QRCode.toDataURL(buildVerificationUrl(candidateId), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 160,
    color: {
      dark: '#111111',
      light: '#ffffff',
    },
  });
}

/**
 * Generates an internship offer letter PDF and saves it to disk.
 * Returns the absolute path of the generated file.
 */
async function generateOfferLetterPDF(applicantData) {
  const {
    fullName,
    domain,
    candidateId,
    startDate,
    endDate,
    duration,
  } = applicantData;

  const templatePath = path.join(__dirname, 'offer_letter.html');
  const verificationUrl = buildVerificationUrl(candidateId);
  const qrCodeDataUrl = await createQrDataUrl(candidateId);

  const html = renderTemplate(templatePath, {
    fullName,
    domain,
    candidateId,
    verificationUrl,
    qrCodeDataUrl,
    date:      new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }),
    startDate: new Date(startDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }),
    endDate:   endDate
      ? new Date(endDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })
      : '—',
    duration,
  });

  // Ensure output directory exists
  const outDir = process.env.VERCEL ? path.join('/tmp', 'generated_pdfs') : path.join(__dirname, 'generated_pdfs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const safeName  = fullName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
  const fileName  = `CareerProof_OfferLetter_${safeName}_${candidateId.replace(/\//g,'-')}.pdf`;
  const pdfPath   = path.join(outDir, fileName);

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path:   pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '0px', right: '0px' },
    });
  } finally {
    await browser.close();
  }

  console.log(`📄  PDF generated: ${fileName}`);
  return pdfPath;
}

async function generateCertificatePDF(applicantData) {
  const {
    fullName,
    domain,
    candidateId,
    startDate,
    endDate,
  } = applicantData;

  const templatePath = path.join(__dirname, 'certificate_template.html');
  const issueDate = new Date();
  const certificateId = `CP-CERT-${candidateId.replace(/^CP-/, '').replace(/-/g, '')}`;
  const verificationUrl = buildVerificationUrl(candidateId);
  const qrCodeDataUrl = await createQrDataUrl(candidateId);
  const backgroundLogoDataUrl = fileToDataUrl(path.join(__dirname, 'assets', 'logo-removebg-preview.png'), 'image/png');

  const html = renderTemplate(templatePath, {
    fullName,
    domain,
    candidateId,
    certificateId,
    verificationUrl,
    qrCodeDataUrl,
    backgroundLogoDataUrl,
    issueDate: issueDate.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }),
    startDate: new Date(startDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }),
    endDate: endDate
      ? new Date(endDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })
      : issueDate.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }),
  });

  const outDir = process.env.VERCEL ? path.join('/tmp', 'generated_pdfs') : path.join(__dirname, 'generated_pdfs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const safeName = fullName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
  const fileName = `CareerProof_Certificate_${safeName}_${candidateId.replace(/\//g,'-')}.pdf`;
  const pdfPath = path.join(outDir, fileName);

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
    });
  } finally {
    await browser.close();
  }

  console.log(`Certificate PDF generated: ${fileName}`);
  return { pdfPath, certificateId };
}

module.exports = { generateOfferLetterPDF, generateCertificatePDF };
