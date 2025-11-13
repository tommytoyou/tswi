/**
 * NOTIFICATION DELIVERY SYSTEM
 * Handles email, SMS, webhook, and WebSocket notifications
 */

import type { Alert, AlertHistory } from './types';

// ============================================================================
// EMAIL NOTIFICATIONS
// ============================================================================

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email notification (using Resend or SendGrid)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.warn('[Email] No API key configured, skipping email send');
    return false;
  }

  try {
    // Try Resend first (simpler API)
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'alerts@tswi.space',
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend API error: ${response.status}`);
      }

      console.log(`[Email] Sent to ${options.to}`);
      return true;
    }

    // Fallback to SendGrid
    if (process.env.SENDGRID_API_KEY) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: options.to }],
            subject: options.subject,
          }],
          from: {
            email: process.env.EMAIL_FROM || 'alerts@tswi.space',
            name: 'TSWI Alerts',
          },
          content: [
            { type: 'text/html', value: options.html },
            { type: 'text/plain', value: options.text || '' },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`SendGrid API error: ${response.status}`);
      }

      console.log(`[Email] Sent to ${options.to}`);
      return true;
    }

    return false;

  } catch (error) {
    console.error('[Email] Send failed:', error);
    return false;
  }
}

/**
 * Generate email template for space weather alert
 */
export function generateAlertEmail(alert: Alert, history: AlertHistory): string {
  const priorityColors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
  };

  const color = priorityColors[history.priority];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Space Weather Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">🛰️ Space Weather Alert</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">TSWI Monitoring System</p>
  </div>

  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 30px;">

    <!-- Priority Badge -->
    <div style="margin-bottom: 20px;">
      <span style="background: ${color}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
        ${history.priority} Priority
      </span>
    </div>

    <!-- Alert Name -->
    <h2 style="color: #111827; margin: 20px 0 10px;">${alert.name}</h2>

    <!-- AI Reasoning -->
    <div style="background: #f3f4f6; border-left: 4px solid ${color}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #374151; font-size: 15px;">${history.ai_reasoning}</p>
    </div>

    <!-- Conditions Met -->
    <h3 style="color: #374151; font-size: 16px; margin: 25px 0 15px;">Conditions Met:</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      ${Object.entries(history.conditions_met).map(([key, value]: [string, any]) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 8px; color: #6b7280; font-size: 14px;">${formatConditionKey(key)}</td>
          <td style="padding: 12px 8px; color: #111827; font-weight: 600; text-align: right;">
            ${value.actual !== undefined ? value.actual : 'Met'}
            ${value.threshold !== undefined ? `<span style="color: #9ca3af; font-weight: normal;"> (threshold: ${value.threshold})</span>` : ''}
          </td>
        </tr>
      `).join('')}
    </table>

    <!-- AI Confidence -->
    <div style="margin: 20px 0;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">AI Confidence:</p>
      <div style="background: #e5e7eb; border-radius: 10px; height: 8px; overflow: hidden;">
        <div style="background: ${color}; height: 100%; width: ${(history.ai_confidence * 100).toFixed(0)}%;"></div>
      </div>
      <p style="margin: 5px 0 0; color: #9ca3af; font-size: 12px; text-align: right;">${(history.ai_confidence * 100).toFixed(0)}%</p>
    </div>

    <!-- Timestamp -->
    <p style="color: #9ca3af; font-size: 13px; margin: 20px 0 0;">
      Triggered at: ${new Date(history.triggered_at).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
      })}
    </p>

    <!-- Action Buttons -->
    <div style="margin-top: 30px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
         style="display: inline-block; background: #667eea; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        View Dashboard
      </a>
    </div>

  </div>

  <!-- Footer -->
  <div style="text-align: center; margin-top: 30px; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>You're receiving this because you have an active alert configured.</p>
    <p style="margin: 10px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/alerts" style="color: #667eea; text-decoration: none;">Manage Alerts</a>
    </p>
    <p style="margin: 10px 0 0;">TSWI Space Weather Intelligence Platform</p>
  </div>

</body>
</html>
  `.trim();
}

function formatConditionKey(key: string): string {
  const labels: Record<string, string> = {
    bz_lt: 'Bz (southward)',
    kp_ge: 'Kp Index',
    speed_gt: 'Solar Wind Speed',
    dst_le: 'Dst Index',
    proton_gt: 'Proton Flux',
    flare_class_ge: 'Solar Flare Class',
    tec_gradient_gt: 'TEC Gradient',
  };
  return labels[key] || key;
}

// ============================================================================
// WEBHOOK NOTIFICATIONS
// ============================================================================

interface WebhookPayload {
  alert: Alert;
  history: AlertHistory;
  timestamp: string;
}

/**
 * Send webhook notification
 */
export async function sendWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TSWI-Alert-System/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }

    console.log(`[Webhook] Sent to ${url}`);
    return true;

  } catch (error) {
    console.error('[Webhook] Send failed:', error);
    return false;
  }
}

// ============================================================================
// SMS NOTIFICATIONS (Twilio)
// ============================================================================

interface SMSOptions {
  to: string;
  body: string;
}

/**
 * Send SMS notification via Twilio
 */
export async function sendSMS(options: SMSOptions): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[SMS] Twilio not configured, skipping SMS send');
    return false;
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
        body: new URLSearchParams({
          To: options.to,
          From: fromNumber,
          Body: options.body,
        }).toString(),
      }
    );

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.status}`);
    }

    console.log(`[SMS] Sent to ${options.to}`);
    return true;

  } catch (error) {
    console.error('[SMS] Send failed:', error);
    return false;
  }
}

/**
 * Generate SMS message for alert
 */
export function generateAlertSMS(alert: Alert, history: AlertHistory): string {
  return `[TSWI ${history.priority.toUpperCase()}] ${alert.name}: ${history.ai_reasoning.substring(0, 140)}... View: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;
}

// ============================================================================
// NOTIFICATION DISPATCHER
// ============================================================================

/**
 * Send notification via appropriate channel
 */
export async function sendAlertNotification(
  alert: Alert,
  history: AlertHistory
): Promise<boolean> {
  try {
    switch (alert.channel) {
      case 'email':
        const emailHtml = generateAlertEmail(alert, history);
        return await sendEmail({
          to: alert.target,
          subject: `[${history.priority.toUpperCase()}] Space Weather Alert: ${alert.name}`,
          html: emailHtml,
          text: history.ai_reasoning,
        });

      case 'webhook':
        return await sendWebhook(alert.target, {
          alert,
          history,
          timestamp: new Date().toISOString(),
        });

      case 'sms':
        const smsBody = generateAlertSMS(alert, history);
        return await sendSMS({
          to: alert.target,
          body: smsBody,
        });

      default:
        console.warn(`[Notification] Unknown channel: ${alert.channel}`);
        return false;
    }
  } catch (error) {
    console.error('[Notification] Send failed:', error);
    return false;
  }
}
