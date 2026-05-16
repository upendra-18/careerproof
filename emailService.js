const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

function renderTemplate(templatePath, vars) {
  let html = fs.readFileSync(templatePath, 'utf-8');
  for (const [key, val] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, val ?? '');
  }
  return html;
}

function createTransporter() {
  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
  const emailUser = (process.env.EMAIL_USER || '').trim();
  const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  if (provider === 'resend') {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  }

  if (provider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

async function sendOfferEmail(applicantData, pdfPath) {
  const { fullName, email, domain, candidateId, startDate, endDate } = applicantData;
  const templatePath = path.join(__dirname, 'email_template.html');

  const htmlContent = renderTemplate(templatePath, {
    firstName: fullName.split(' ')[0],
    fullName,
    domain,
    candidateId,
    startDate: formatDate(startDate),
    endDate: endDate ? formatDate(endDate) : '',
    whatsappLink: process.env.WHATSAPP_GROUP_LINK || 'https://chat.whatsapp.com/LczuM4imlqRHiceUQAibDU',
    supportEmail: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'careerproof.services@gmail.com',
    supportPhone: process.env.SUPPORT_PHONE || '+91 9876543210',
  });

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"CareerProof" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `CareerProof Internship Offer Letter - ${candidateId}`,
    html: htmlContent,
    attachments: [
      {
        filename: `CareerProof_OfferLetter_${candidateId.replace(/\//g, '-')}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf',
      },
    ],
  });

  console.log(`Offer email sent to ${email} - Message ID: ${info.messageId}`);
  return info;
}

async function sendCertificateEmail(applicantData, pdfPath, certificateId) {
  const { fullName, email, domain, candidateId, startDate, endDate } = applicantData;
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'careerproof.services@gmail.com';
  const supportPhone = process.env.SUPPORT_PHONE || '+91 9876543210';

  const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#202124;">
  <div style="max-width:640px;margin:0 auto;padding:24px 20px;font-size:14px;line-height:1.45;">
    <p style="margin:0 0 18px;">Dear ${fullName.split(' ')[0]},</p>
    <p style="margin:0 0 2px;"><strong>Congratulations!</strong></p>
    <p style="margin:0 0 22px;">You have successfully completed the CareerProof Internship program.</p>
    <p style="margin:0 0 6px;"><strong>Certificate Details:</strong></p>
    <p style="margin:0 0 22px;">
      - <strong>Name:</strong> ${fullName}<br/>
      - <strong>Student ID:</strong> ${candidateId}<br/>
      - <strong>Credential ID:</strong> ${certificateId}<br/>
      - <strong>Domain:</strong> ${domain}<br/>
      - <strong>Duration:</strong> ${formatDate(startDate)} to ${formatDate(endDate)}
    </p>
    <p style="margin:0 0 22px;">Your internship completion certificate is attached with this email. Keep it for your portfolio and future verification.</p>
    <p style="margin:0 0 22px;">
      For queries, contact us:<br/>
      Email: <a href="mailto:${supportEmail}" style="color:#1a73e8;text-decoration:none;">${supportEmail}</a><br/>
      WhatsApp: ${supportPhone}
    </p>
    <p style="margin:0;"><strong>Best Regards,</strong><br/><strong>Team CareerProof</strong></p>
  </div>
</body>
</html>`;

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"CareerProof" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `CareerProof Internship Certificate - ${certificateId}`,
    html: htmlContent,
    attachments: [
      {
        filename: `CareerProof_Certificate_${certificateId}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf',
      },
    ],
  });

  console.log(`Certificate email sent to ${email} - Message ID: ${info.messageId}`);
  return info;
}

module.exports = { sendOfferEmail, sendCertificateEmail };
