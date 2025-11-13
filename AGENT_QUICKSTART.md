# 🚀 Agent System Quick Start

Get the autonomous AI monitoring agent running in 5 minutes.

## Step 1: Environment Variables

Add to `.env.local`:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-key-here
CRON_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Optional (for notifications)
RESEND_API_KEY=re_your-key-here
EMAIL_FROM=alerts@yourdomain.com
```

## Step 2: Deploy to Vercel

```bash
vercel deploy --prod
```

That's it! The system is now:
- ✅ Ingesting NOAA data every minute
- ✅ Running AI analysis every 5 minutes
- ✅ Evaluating alerts in real-time
- ✅ Self-tuning thresholds every 6 hours
- ✅ Calculating performance metrics hourly

## Step 3: View Agent Dashboard

Navigate to: `https://your-app.vercel.app/agent`

You'll see:
- 🤖 Agent decision history
- 📊 Performance metrics
- 📈 Prediction accuracy
- 🎯 Adaptive thresholds
- 🚨 Recent alerts

## Testing

### Trigger Manual Analysis

```bash
curl "https://your-app.vercel.app/api/agents/monitoring-agent?analyze=true"
```

### Check Agent Status

```bash
curl "https://your-app.vercel.app/api/agents/monitoring-agent"
```

### View Decision History

```bash
curl "https://your-app.vercel.app/api/agents/decisions?limit=10"
```

## Create Your First Alert

1. Go to `/alerts` page
2. Click "Create Alert"
3. Set conditions (e.g., Kp ≥ 5)
4. Choose email/SMS/webhook
5. Activate alert

The agent will:
- Monitor conditions every minute
- Generate AI reasoning when triggered
- Send notification via your chosen channel
- Track accuracy and adjust thresholds
- Learn from false positives

## Troubleshooting

**Cron jobs not running?**
```bash
# Check Vercel dashboard → Functions → Cron Jobs
# Verify CRON_SECRET is set in environment variables
```

**AI returns fallback reasoning?**
```bash
# Check ANTHROPIC_API_KEY is valid
# Verify API quota: https://console.anthropic.com
```

**Notifications not sending?**
```bash
# Email: Check RESEND_API_KEY or SENDGRID_API_KEY
# SMS: Verify Twilio credentials
# Webhook: Test URL is accessible
```

## What's Happening Behind the Scenes

### Every Minute
- Fresh NOAA data fetched (solar wind, Kp, X-ray, events)
- All active alerts evaluated
- Notifications sent when conditions met

### Every 5 Minutes
- AI agent analyzes current space weather
- Generates reasoning and risk assessment
- Stores decision with confidence score
- Broadcasts to connected WebSocket clients

### Every 6 Hours
- False positive rates calculated
- Thresholds adjusted automatically
- Target: 5% false positive rate

### Every Hour
- Performance metrics computed
- Precision, recall, F1 score tracked
- Prediction accuracy analyzed

## Next Steps

1. **Create alerts** for your specific use case
2. **Monitor the dashboard** to see agent decisions
3. **Provide feedback** on false positives (helps learning)
4. **Review metrics** weekly to track improvement
5. **Customize thresholds** if needed (see `AGENT_SYSTEM.md`)

## Key Metrics to Watch

- **Precision**: > 80% (few false positives)
- **Recall**: > 70% (catching most events)
- **F1 Score**: > 75% (balanced performance)
- **Agent Confidence**: > 0.7 (trust in decisions)

## Cost Estimate

- **Anthropic API**: ~$15-25/month (5-min cadence)
- **Resend (email)**: Free (100/day) or $20/month (50K)
- **Twilio (SMS)**: ~$0.0075 per SMS
- **Vercel**: Free (Hobby) or $20/month (Pro)
- **MongoDB**: Free (M0) or $57/month (M10)

**Total: $100-150/month for production usage**

## Advanced Usage

See [`AGENT_SYSTEM.md`](./AGENT_SYSTEM.md) for:
- Architecture details
- Database schemas
- API reference
- Performance tuning
- Custom AI prompts
- Future enhancements

---

**Questions?** Check the full documentation in `AGENT_SYSTEM.md`
