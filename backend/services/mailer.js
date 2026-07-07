import nodemailer from 'nodemailer';

// Uses a Gmail account + App Password (not the regular account password —
// Google requires a 16-character App Password for SMTP when 2FA is on:
// Google Account > Security > 2-Step Verification > App Passwords).
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

export async function sendPasswordResetEmail(toEmail, resetUrl) {
  const t = getTransporter();
  if (!t) {
    console.error('Email not configured (EMAIL_USER / EMAIL_APP_PASSWORD missing) — skipping send.');
    return;
  }
  await t.sendMail({
    from: `"Stone Tracker" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Reset your Stone Tracker password',
    text: `We received a request to reset your Stone Tracker password.\n\nReset it here (link expires in 1 hour): ${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#1a73e8;">Reset your password</h2>
        <p>We received a request to reset your Stone Tracker password.</p>
        <p style="margin:24px 0;">
          <a href="${resetUrl}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:10px 20px;border-radius:24px;display:inline-block;">Reset Password</a>
        </p>
        <p style="color:#5f6368;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export default getTransporter;
