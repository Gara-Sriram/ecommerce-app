import nodemailer from 'nodemailer';

/**
 * Email Service
 *
 * Uses Nodemailer with Gmail SMTP (free, 500 emails/day).
 * To use:
 *   1. Enable 2FA on your Gmail account
 *   2. Go to Google Account → Security → App Passwords
 *   3. Create an App Password for "Mail"
 *   4. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env
 *
 * If env vars are not set → emails are logged to console (dev mode)
 *
 * In production: swap SMTP credentials for SendGrid / SES without any
 * code change — just update the createTransport config. This is the
 * "transport abstraction" pattern used in enterprise Node.js apps.
 */

// ── Transporter setup ─────────────────────────────────────────────────────
let transporter;

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    // Production: real Gmail SMTP
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD, // App Password, NOT your Gmail password
        },
    });
    console.log('📧 Email service: Gmail SMTP');
} else {
    // Development: log emails to console instead of sending
    console.warn('📧 Email service: Console mode (set GMAIL_USER + GMAIL_APP_PASSWORD in .env for real emails)');
    transporter = {
        sendMail: async (options) => {
            console.log('\n─────────── 📧 EMAIL (DEV MODE) ───────────');
            console.log('To:', options.to);
            console.log('Subject:', options.subject);
            console.log('Body:', options.text || options.html);
            console.log('────────────────────────────────────────────\n');
            return { messageId: 'dev-' + Date.now() };
        }
    };
}

const FROM_ADDRESS = process.env.GMAIL_USER
    ? `"ShopEase" <${process.env.GMAIL_USER}>`
    : '"ShopEase" <noreply@shopease.com>';

// ── Email Templates ───────────────────────────────────────────────────────

/**
 * Send OTP for email verification
 * Called during registration
 */
export const sendEmailVerificationOTP = async (email, otp, name) => {
    await transporter.sendMail({
        from: FROM_ADDRESS,
        to: email,
        subject: `${otp} — Verify your ShopEase account`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                <h2 style="color:#1a1a2e;margin:0 0 8px;">Welcome to ShopEase, ${name}! 👋</h2>
                <p style="color:#6b7280;margin:0 0 24px;">Please verify your email to complete registration.</p>
                <div style="background:#f3f4f6;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
                    <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">Your verification code</p>
                    <div style="font-size:40px;font-weight:900;letter-spacing:10px;color:#1a1a2e;">${otp}</div>
                    <p style="margin:8px 0 0;color:#9ca3af;font-size:13px;">Expires in <strong>10 minutes</strong></p>
                </div>
                <p style="color:#6b7280;font-size:13px;margin:0;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
        `,
        text: `Your ShopEase verification code is: ${otp}\nExpires in 10 minutes.`
    });
};

/**
 * Send OTP for password reset
 */
export const sendPasswordResetOTP = async (email, otp, name) => {
    await transporter.sendMail({
        from: FROM_ADDRESS,
        to: email,
        subject: `${otp} — ShopEase Password Reset`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                <h2 style="color:#1a1a2e;margin:0 0 8px;">Password Reset 🔐</h2>
                <p style="color:#6b7280;margin:0 0 24px;">Hi ${name}, we received a request to reset your password.</p>
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
                    <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">Password reset code</p>
                    <div style="font-size:40px;font-weight:900;letter-spacing:10px;color:#dc2626;">${otp}</div>
                    <p style="margin:8px 0 0;color:#9ca3af;font-size:13px;">Expires in <strong>10 minutes</strong></p>
                </div>
                <p style="color:#6b7280;font-size:13px;margin:0;">⚠️ If you didn't request this, someone may be trying to access your account. <strong>Ignore this email</strong> — your password will NOT change.</p>
            </div>
        `,
        text: `Your ShopEase password reset code is: ${otp}\nExpires in 10 minutes.`
    });
};

/**
 * Send account lockout alert
 */
export const sendAccountLockedAlert = async (email, name, lockDurationMinutes) => {
    await transporter.sendMail({
        from: FROM_ADDRESS,
        to: email,
        subject: '⚠️ ShopEase — Account Temporarily Locked',
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                <h2 style="color:#dc2626;margin:0 0 8px;">⚠️ Account Locked</h2>
                <p style="color:#374151;margin:0 0 16px;">Hi ${name}, your account has been temporarily locked due to multiple failed login attempts.</p>
                <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0;color:#dc2626;font-weight:600;">Locked for: ${lockDurationMinutes} minutes</p>
                    <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">You can try again after the lockout period.</p>
                </div>
                <p style="color:#6b7280;font-size:13px;margin:0;">If this wasn't you, your password may be compromised. Consider resetting it immediately.</p>
            </div>
        `,
        text: `Your ShopEase account has been locked for ${lockDurationMinutes} minutes due to multiple failed login attempts.`
    });
};

/**
 * Send order confirmation email
 */
export const sendOrderConfirmation = async (email, name, orderId, items, total) => {
    const itemRows = items.map(i =>
        `<tr><td style="padding:8px">${i.name} (${i.size})</td><td style="padding:8px;text-align:right">×${i.quantity}</td><td style="padding:8px;text-align:right">$${i.price}</td></tr>`
    ).join('');

    await transporter.sendMail({
        from: FROM_ADDRESS,
        to: email,
        subject: `✅ Order Confirmed — #${orderId.slice(-8).toUpperCase()}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                <h2 style="color:#1a1a2e;margin:0 0 4px;">Order Confirmed! 🎉</h2>
                <p style="color:#6b7280;margin:0 0 24px;">Hi ${name}, we've received your order.</p>
                <p style="font-size:13px;color:#9ca3af;margin:0 0 8px;">Order ID: <strong>#${orderId.slice(-8).toUpperCase()}</strong></p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
                    <thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Price</th></tr></thead>
                    <tbody>${itemRows}</tbody>
                    <tfoot><tr style="border-top:2px solid #e5e7eb"><td colspan="2" style="padding:8px;font-weight:700">Total</td><td style="padding:8px;text-align:right;font-weight:700">$${total}</td></tr></tfoot>
                </table>
                <p style="color:#6b7280;font-size:13px;">We'll send you another email when your order ships. Thank you for shopping with ShopEase! 🛍️</p>
            </div>
        `,
        text: `Order #${orderId.slice(-8).toUpperCase()} confirmed! Total: $${total}. Thank you for shopping with ShopEase!`
    });
};
