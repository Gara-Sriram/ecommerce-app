import { Resend } from 'resend';
import nodemailer from 'nodemailer';

/**
 * Email Service — Priority order:
 *
 * 1. RESEND_API_KEY set      → Use Resend HTTP API (works on ALL platforms including Render free tier)
 * 2. GMAIL_USER + PASSWORD   → Use Gmail SMTP (works on dedicated servers, NOT on Render free tier)
 * 3. Neither set             → Log to console (dev mode / OTP visible in Render logs)
 *
 * WHY Resend instead of Gmail on Render:
 * Render free tier blocks all outbound SMTP ports (25, 465, 587) to prevent spam abuse.
 * Resend uses HTTPS (port 443) which is never blocked → always works.
 *
 * Setup Resend (free, 3 mins):
 *   1. Sign up at https://resend.com (free, no credit card)
 *   2. Dashboard → API Keys → Create API Key
 *   3. Add to .env: RESEND_API_KEY=re_xxxxxxxxxx
 *   4. Add to Render: Environment → RESEND_API_KEY
 *
 * Free tier: 3000 emails/month, 100/day.
 * From address on free tier: onboarding@resend.dev (works for testing)
 * For custom from address: verify your domain in Resend dashboard.
 */

// ── Determine which transport to use ─────────────────────────────────────
let sendEmail; // Unified send function

if (process.env.MAILING_SCRIPT_URL) {
    // ── Option 1: Google Apps Script Webhook (Free, bypasses SMTP blocks, sends to anyone) ──
    console.log('📧 Email service: Google Apps Script Webhook ✅ (Sends to any email)');

    sendEmail = async ({ to, subject, html }) => {
        const response = await fetch(process.env.MAILING_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, subject, html })
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(`Google Apps Script Email Error: ${result.error}`);
        }
        return result;
    };

} else if (process.env.RESEND_API_KEY) {
    // ── Option 2: Resend (HTTP API) ──
    const resend = new Resend(process.env.RESEND_API_KEY);
    const FROM = process.env.RESEND_FROM_EMAIL || 'ShopEase <onboarding@resend.dev>';

    console.log('📧 Email service: Resend HTTP API ✅ (works on Render free tier)');

    sendEmail = async ({ to, subject, html, text }) => {
        const { data, error } = await resend.emails.send({ from: FROM, to, subject, html, text });
        if (error) throw new Error(`Resend error: ${error.message}`);
        return data;
    };

} else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    // ── Option 2: Gmail SMTP (works on dedicated servers, NOT on Render free tier) ──
    console.log('📧 Email service: Gmail SMTP (note: may fail on Render free tier)');

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        family: 4,              // Force IPv4
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    const FROM = `"ShopEase" <${process.env.GMAIL_USER}>`;

    sendEmail = async ({ to, subject, html, text }) => {
        return transporter.sendMail({ from: FROM, to, subject, html, text });
    };

} else {
    // ── Option 3: Console fallback (dev mode) ──
    console.warn('📧 Email service: Console mode — OTP will appear in server logs');
    sendEmail = async ({ to, subject, text, _otp }) => {
        console.log('\n══════════ 📧 EMAIL (CONSOLE MODE) ══════════');
        console.log(`To:      ${to}`);
        console.log(`Subject: ${subject}`);
        if (_otp) console.log(`OTP:     ★ ${_otp} ★  (copy this to verify)`);
        else      console.log(`Body:    ${text}`);
        console.log('═════════════════════════════════════════════\n');
    };
}

// ── Email Templates ───────────────────────────────────────────────────────

export const sendEmailVerificationOTP = async (email, otp, name) => {
    await sendEmail({
        to: email,
        subject: `${otp} — Verify your ShopEase account`,
        _otp: otp, // Used by console fallback only
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

export const sendPasswordResetOTP = async (email, otp, name) => {
    await sendEmail({
        to: email,
        subject: `${otp} — ShopEase Password Reset`,
        _otp: otp,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                <h2 style="color:#1a1a2e;margin:0 0 8px;">Password Reset 🔐</h2>
                <p style="color:#6b7280;margin:0 0 24px;">Hi ${name}, we received a request to reset your password.</p>
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
                    <p style="margin:0 0 8px;color:#6b7280;font-size:14px;">Password reset code</p>
                    <div style="font-size:40px;font-weight:900;letter-spacing:10px;color:#dc2626;">${otp}</div>
                    <p style="margin:8px 0 0;color:#9ca3af;font-size:13px;">Expires in <strong>10 minutes</strong></p>
                </div>
                <p style="color:#6b7280;font-size:13px;margin:0;">If you didn't request this, ignore this email — your password won't change.</p>
            </div>
        `,
        text: `Your ShopEase password reset code is: ${otp}\nExpires in 10 minutes.`
    });
};

export const sendAccountLockedAlert = async (email, name, lockDurationMinutes) => {
    await sendEmail({
        to: email,
        subject: '⚠️ ShopEase — Account Temporarily Locked',
        html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                <h2 style="color:#dc2626;margin:0 0 8px;">⚠️ Account Locked</h2>
                <p style="color:#374151;margin:0 0 16px;">Hi ${name}, your account has been temporarily locked due to multiple failed login attempts.</p>
                <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0;color:#dc2626;font-weight:600;">Locked for: ${lockDurationMinutes} minutes</p>
                </div>
                <p style="color:#6b7280;font-size:13px;">If this wasn't you, consider resetting your password.</p>
            </div>
        `,
        text: `Your ShopEase account has been locked for ${lockDurationMinutes} minutes.`
    });
};

export const sendOrderConfirmation = async (email, name, orderId, items, total) => {
    const itemRows = items.map(i =>
        `<tr><td style="padding:8px">${i.name} (${i.size})</td><td style="padding:8px;text-align:right">×${i.quantity}</td><td style="padding:8px;text-align:right">$${i.price}</td></tr>`
    ).join('');

    await sendEmail({
        to: email,
        subject: `✅ Order Confirmed — #${orderId.slice(-8).toUpperCase()}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                <h2 style="color:#1a1a2e;margin:0 0 4px;">Order Confirmed! 🎉</h2>
                <p style="color:#6b7280;margin:0 0 24px;">Hi ${name}, we've received your order.</p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
                    <thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Price</th></tr></thead>
                    <tbody>${itemRows}</tbody>
                    <tfoot><tr style="border-top:2px solid #e5e7eb"><td colspan="2" style="padding:8px;font-weight:700">Total</td><td style="padding:8px;text-align:right;font-weight:700">$${total}</td></tr></tfoot>
                </table>
                <p style="color:#6b7280;font-size:13px;">Thank you for shopping with ShopEase! 🛍️</p>
            </div>
        `,
        text: `Order #${orderId.slice(-8).toUpperCase()} confirmed! Total: $${total}.`
    });
};
