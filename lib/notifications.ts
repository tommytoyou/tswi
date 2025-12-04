/**
 * NOTIFICATION DELIVERY SYSTEM
 * Handles email, SMS, webhook, and WebSocket notifications
 */

import type { Alert, AlertHistory, AlertRule, TriggeredAlert, AlertSeverity, NotificationChannel } from './types';

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

// ============================================================================
// ALERT RULE NOTIFICATIONS (New system with multi-channel support)
// ============================================================================

export interface AlertRuleWebhookPayload {
  alert_name: string;
  rule_id: string;
  severity: AlertSeverity;
  triggered_at: string;
  conditions_met: Array<{
    metric: string;
    operator: string;
    threshold: number;
    actual_value: number;
  }>;
  current_values: Record<string, number | null>;
  dashboard_url: string;
}

/**
 * Send webhook notification for AlertRule
 */
export async function sendAlertRuleWebhook(
  webhookUrl: string,
  payload: AlertRuleWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TSWI-Alert-System/1.0',
        'X-TSWI-Event': 'alert.triggered',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    console.log(`[Webhook] Successfully sent to ${webhookUrl}`);
    return { success: true };

  } catch (error: any) {
    console.error('[Webhook] Send failed:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Generate email HTML for AlertRule notification
 */
export function generateAlertRuleEmail(
  rule: AlertRule,
  triggeredAlert: Omit<TriggeredAlert, '_id'>,
  currentMetrics: Record<string, number | null>
): string {
  const severityColors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
  };

  const color = severityColors[rule.severity] || '#3b82f6';
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const metricLabels: Record<string, string> = {
    kp_index: 'Kp Index',
    bz_value: 'Bz (nT)',
    solar_wind_speed: 'Solar Wind Speed (km/s)',
    xray_flux: 'X-Ray Flux (W/m²)',
    proton_flux: 'Proton Flux (pfu)',
  };

  const operatorLabels: Record<string, string> = {
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    eq: '=',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Space Weather Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">

  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">🛰️ Space Weather Alert</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">TSWI Monitoring System</p>
  </div>

  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 30px;">

    <!-- Severity Badge -->
    <div style="margin-bottom: 20px;">
      <span style="background: ${color}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
        ${rule.severity} Severity
      </span>
    </div>

    <!-- Alert Name -->
    <h2 style="color: #111827; margin: 20px 0 10px;">${rule.name}</h2>
    ${rule.description ? `<p style="color: #6b7280; margin: 0 0 20px;">${rule.description}</p>` : ''}

    <!-- Conditions Met -->
    <h3 style="color: #374151; font-size: 16px; margin: 25px 0 15px;">Triggered Conditions:</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      ${triggeredAlert.conditions_met.map(c => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 8px; color: #6b7280; font-size: 14px;">${metricLabels[c.metric] || c.metric}</td>
          <td style="padding: 12px 8px; color: #111827; font-weight: 600; text-align: right;">
            ${c.metric === 'xray_flux' ? c.actual_value.toExponential(2) : c.actual_value.toFixed(1)}
            <span style="color: #9ca3af; font-weight: normal;"> (threshold: ${operatorLabels[c.operator]} ${c.metric === 'xray_flux' ? c.threshold.toExponential(0) : c.threshold})</span>
          </td>
        </tr>
      `).join('')}
    </table>

    <!-- Current Conditions -->
    <h3 style="color: #374151; font-size: 16px; margin: 25px 0 15px;">Current Space Weather:</h3>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
      ${Object.entries(currentMetrics).filter(([k]) => k !== 'fetched_at').map(([metric, value]) => `
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
          <div style="color: #6b7280; font-size: 12px;">${metricLabels[metric] || metric}</div>
          <div style="color: #111827; font-size: 16px; font-weight: 600; margin-top: 4px;">
            ${value === null ? 'N/A' : (metric === 'xray_flux' ? value.toExponential(2) : value.toFixed(1))}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Timestamp -->
    <p style="color: #9ca3af; font-size: 13px; margin: 25px 0 0;">
      Triggered at: ${new Date(triggeredAlert.triggered_at).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
      })}
    </p>

    <!-- Action Buttons -->
    <div style="margin-top: 30px; text-align: center;">
      <a href="${dashboardUrl}"
         style="display: inline-block; background: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        View Dashboard
      </a>
    </div>

  </div>

  <!-- Footer -->
  <div style="text-align: center; margin-top: 30px; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>You received this alert because you configured "${rule.name}" to notify via email.</p>
    <p style="margin: 10px 0;">
      <a href="${dashboardUrl}/alerts" style="color: #3b82f6; text-decoration: none;">Manage Alert Rules</a>
    </p>
    <p style="margin: 10px 0 0;">TSWI Space Weather Intelligence Platform</p>
  </div>

</body>
</html>
  `.trim();
}

/**
 * Send email notification for AlertRule
 */
export async function sendAlertRuleEmail(
  email: string,
  rule: AlertRule,
  triggeredAlert: Omit<TriggeredAlert, '_id'>,
  currentMetrics: Record<string, number | null>
): Promise<{ success: boolean; error?: string }> {
  const html = generateAlertRuleEmail(rule, triggeredAlert, currentMetrics);

  const success = await sendEmail({
    to: email,
    subject: `[${rule.severity.toUpperCase()}] Space Weather Alert: ${rule.name}`,
    html,
    text: `${rule.name} - ${rule.severity} severity alert triggered. ${triggeredAlert.conditions_met.map(c => `${c.metric}: ${c.actual_value}`).join(', ')}`,
  });

  return { success };
}

/**
 * Send notifications for a triggered AlertRule through all configured channels
 */
export async function sendAlertRuleNotifications(
  rule: AlertRule,
  triggeredAlert: Omit<TriggeredAlert, '_id'>,
  currentMetrics: Record<string, number | null>
): Promise<{
  channels_attempted: NotificationChannel[];
  channels_succeeded: NotificationChannel[];
  errors: Record<string, string>;
}> {
  const channels = rule.notification_channels || [];
  const channelsAttempted: NotificationChannel[] = [];
  const channelsSucceeded: NotificationChannel[] = [];
  const errors: Record<string, string> = {};

  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  for (const channel of channels) {
    channelsAttempted.push(channel);

    if (channel === 'webhook' && rule.webhook_url) {
      const payload: AlertRuleWebhookPayload = {
        alert_name: rule.name,
        rule_id: rule._id || '',
        severity: rule.severity,
        triggered_at: triggeredAlert.triggered_at.toISOString(),
        conditions_met: triggeredAlert.conditions_met,
        current_values: currentMetrics,
        dashboard_url: dashboardUrl,
      };

      const result = await sendAlertRuleWebhook(rule.webhook_url, payload);
      if (result.success) {
        channelsSucceeded.push('webhook');
      } else {
        errors['webhook'] = result.error || 'Unknown error';
      }
    }

    if (channel === 'email' && rule.email) {
      const result = await sendAlertRuleEmail(rule.email, rule, triggeredAlert, currentMetrics);
      if (result.success) {
        channelsSucceeded.push('email');
      } else {
        errors['email'] = result.error || 'Email service unavailable';
      }
    }
  }

  return { channels_attempted: channelsAttempted, channels_succeeded: channelsSucceeded, errors };
}
