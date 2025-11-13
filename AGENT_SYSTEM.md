# 🤖 Autonomous AI Monitoring Agent System

## Overview

The TSWI platform now includes a fully autonomous AI agent that continuously monitors space weather conditions, makes intelligent decisions about alerts, and learns from its performance over time.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AGENTIC AI SYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ Data         │   │ AI Agent     │   │ Decision     │  │
│  │ Ingestion    │──▶│ Analysis     │──▶│ Engine       │  │
│  │ (1 min)      │   │ (5 min)      │   │ (real-time)  │  │
│  └──────────────┘   └──────────────┘   └──────────────┘  │
│         │                   │                   │          │
│         ▼                   ▼                   ▼          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ MongoDB      │   │ LLM          │   │ Alert        │  │
│  │ Cache        │   │ Reasoning    │   │ Evaluation   │  │
│  └──────────────┘   └──────────────┘   └──────────────┘  │
│                                                 │          │
│                                                 ▼          │
│                                         ┌──────────────┐  │
│                                         │ Notification │  │
│                                         │ Delivery     │  │
│                                         └──────────────┘  │
│                                                 │          │
│                          ┌──────────────────────┼─────────┤
│                          ▼                      ▼         │
│                    ┌──────────┐          ┌──────────┐    │
│                    │ Email    │          │ SMS      │    │
│                    │ Webhook  │          │ WS/SSE   │    │
│                    └──────────┘          └──────────┘    │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Self-Tuning Threshold Adjustment (6 hours)       │   │
│  │ • Tracks false positive rates                    │   │
│  │ • Adjusts thresholds to minimize FP              │   │
│  │ • Target: 5% false positive rate                 │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Performance Metrics (hourly)                      │   │
│  │ • Precision, Recall, F1 Score                     │   │
│  │ • Prediction accuracy tracking                    │   │
│  │ • Confidence monitoring                           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Autonomous Monitoring Agent

**Location:** `lib/agent.ts`

The core agent that:
- Analyzes space weather data every 5 minutes
- Uses Claude AI for intelligent reasoning
- Assesses risk levels (critical/high/medium/low)
- Makes autonomous decisions about alerting
- Provides natural language explanations for decisions

**AI Integration:**
- **Primary:** Anthropic Claude 3.5 Sonnet (via API)
- **Fallback:** Rule-based heuristics when API unavailable
- **Reasoning:** Contextual analysis with 15-minute data lookback

### 2. Decision Engine

**Location:** `app/api/agents/monitoring-agent/route.ts`

Priority classification system:
- **CRITICAL**: Bz < -10 nT, Kp ≥ 7, X-class flares
- **HIGH**: Bz < -5 nT, Kp ≥ 5, M-class flares
- **MEDIUM**: Bz < -3 nT, Kp ≥ 4
- **LOW**: Normal conditions

### 3. Alert Evaluation Engine

**Location:** `app/api/cron/alert-evaluation/route.ts`

- Runs every 1 minute
- Checks all active user alerts
- Evaluates conditions against real-time data
- Generates AI reasoning for each trigger
- Implements 30-minute cooldown to prevent spam

### 4. Self-Tuning Thresholds

**Location:** `app/api/cron/threshold-adjustment/route.ts`

Adaptive system that:
- Tracks false positive rates per parameter
- Adjusts thresholds every 6 hours
- Targets 5% false positive rate
- Stores adjustment history for analysis

**Example:** If Bz alerts have 15% false positive rate, threshold becomes more strict (e.g., -5 nT → -6 nT)

### 5. Notification System

**Location:** `lib/notifications.ts`

Multi-channel delivery:
- **Email** (Resend or SendGrid)
  - Beautiful HTML templates
  - AI reasoning included
  - Priority badges
  - Confidence indicators
- **SMS** (Twilio)
  - Concise 160-char messages
  - Critical alerts only option
- **Webhook**
  - JSON payload with full context
  - Retry with exponential backoff
- **WebSocket/SSE**
  - Real-time browser push
  - No page refresh needed

### 6. Prediction Accuracy Tracking

**Location:** `lib/agent.ts` - `trackPredictionAccuracy()`

Compares Surya predictions vs actual events:
- Stores predicted vs actual values
- Calculates error magnitude
- Scores accuracy (0-1 scale)
- Groups by prediction source
- Identifies best-performing models

### 7. Agent Dashboard

**Location:** `app/(dashboard)/agent/page.tsx`

Real-time monitoring UI showing:
- **Agent Status**: Operational health
- **Decision History**: Recent AI decisions with reasoning
- **Performance Metrics**: Precision, recall, F1 score
- **Alert History**: Recent triggers with AI explanations
- **Prediction Charts**: Predicted vs actual comparison
- **Adaptive Thresholds**: Current values and adjustment history

## Cron Jobs (Vercel)

**Configuration:** `vercel.json`

| Job | Schedule | Purpose |
|-----|----------|---------|
| `data-ingestion` | Every 1 min | Fetch latest NOAA data |
| `alert-evaluation` | Every 1 min | Check alert conditions |
| `agent-analysis` | Every 5 min | AI decision making |
| `threshold-adjustment` | Every 6 hours | Self-tune thresholds |
| `metrics-calculation` | Every hour | Performance analytics |

## Database Collections

### New Collections Added

**1. `agent_decisions`**
```typescript
{
  ts: Date,
  decision_type: 'alert_evaluation' | 'threshold_adjustment' | 'event_classification' | 'recommendation',
  priority: 'critical' | 'high' | 'medium' | 'low',
  reasoning: string,        // AI-generated explanation
  confidence: number,       // 0-1 score
  data_snapshot: object,    // Data at decision time
  action_taken: string,
  outcome: 'pending' | 'success' | 'false_positive' | 'missed_event',
  user_feedback: string?,
  created_at: Date
}
```

**2. `alert_history`**
```typescript
{
  alert_id: string,
  user_id: string,
  triggered_at: Date,
  priority: 'critical' | 'high' | 'medium' | 'low',
  conditions_met: object,
  ai_reasoning: string,     // Why agent decided to alert
  ai_confidence: number,
  data_snapshot: object,
  notification_sent: boolean,
  notification_channel: 'email' | 'webhook' | 'sms' | 'websocket',
  user_acknowledged: boolean,
  false_positive: boolean,
  user_feedback: string?,
  created_at: Date
}
```

**3. `prediction_accuracy`**
```typescript
{
  prediction_ts: Date,
  predicted_event: string,
  predicted_value: number,
  predicted_time: Date,
  actual_event: string?,
  actual_value: number?,
  actual_time: Date?,
  error_magnitude: number,
  error_timing_min: number,
  accuracy_score: number,   // 0-1 score
  prediction_source: string, // 'surya', 'statistical'
  created_at: Date
}
```

**4. `adaptive_thresholds`**
```typescript
{
  parameter: string,        // 'kp', 'bz', 'speed'
  current_threshold: number,
  initial_threshold: number,
  adjustment_history: [{
    ts: Date,
    old_value: number,
    new_value: number,
    reason: string,
    false_positive_rate: number
  }],
  false_positive_rate: number,
  target_false_positive_rate: number, // Default: 0.05 (5%)
  last_adjusted_at: Date,
  created_at: Date
}
```

**5. `agent_metrics`**
```typescript
{
  ts: Date,
  period: 'hourly' | 'daily' | 'weekly',
  total_alerts: number,
  critical_alerts: number,
  false_positives: number,
  missed_events: number,
  true_positives: number,
  precision: number,        // TP / (TP + FP)
  recall: number,           // TP / (TP + FN)
  f1_score: number,
  avg_confidence: number,
  avg_prediction_accuracy: number,
  threshold_adjustments: number,
  created_at: Date
}
```

## API Endpoints

### Agent APIs

**GET `/api/agents/monitoring-agent`**
- Query params: `analyze=true`, `limit=N`
- Returns: Agent status, recent decisions, metrics, thresholds

**POST `/api/agents/monitoring-agent`**
- Provide feedback on agent decisions
- Mark alerts as false positives
- Update agent configuration

**GET `/api/agents/decisions`**
- Query params: `limit`, `priority`, `type`, `since`
- Returns: Decision history with statistics

**GET `/api/agents/metrics`**
- Query params: `period=hourly|daily|weekly`, `limit`
- Returns: Performance metrics over time

**GET `/api/agents/predictions`**
- Query params: `limit`, `source`
- Returns: Prediction accuracy records

### Cron APIs

**GET `/api/cron/data-ingestion`**
- Requires: `Authorization: Bearer ${CRON_SECRET}`
- Fetches latest NOAA data

**GET `/api/cron/alert-evaluation`**
- Requires: `Authorization: Bearer ${CRON_SECRET}`
- Evaluates all active alerts

**GET `/api/cron/agent-analysis`**
- Requires: `Authorization: Bearer ${CRON_SECRET}`
- Triggers AI analysis

**GET `/api/cron/threshold-adjustment`**
- Requires: `Authorization: Bearer ${CRON_SECRET}`
- Adjusts thresholds based on FP rates

**GET `/api/cron/metrics-calculation`**
- Requires: `Authorization: Bearer ${CRON_SECRET}`
- Calculates performance metrics

### WebSocket/SSE

**GET `/api/ws/alerts`**
- Server-Sent Events stream
- Real-time alert broadcasts
- Heartbeat every 30 seconds

**POST `/api/ws/alerts`**
- Broadcast alert to connected clients
- Called by alert evaluation cron

## Environment Variables

### Required

```bash
# MongoDB
MONGODB_URI=mongodb+srv://...
MONGODB_DB=tswi

# AI Reasoning (Anthropic Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Cron Security
CRON_SECRET=your_secure_random_string

# App URL (for cron jobs to call APIs)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Optional (Notifications)

```bash
# Email (choose one)
RESEND_API_KEY=re_...
# or
SENDGRID_API_KEY=SG....
EMAIL_FROM=alerts@tswi.space

# SMS
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# WebSocket (for production)
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=us2
```

## Setup Instructions

### 1. Install Dependencies

No additional packages needed! System uses existing dependencies:
- `@huggingface/inference` (already installed)
- `mongodb` (already installed)
- `zod` (already installed)

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### 3. Deploy to Vercel

```bash
vercel deploy
```

Vercel will automatically:
- Set up cron jobs from `vercel.json`
- Enable edge runtime for SSE
- Configure environment variables

### 4. Test Cron Jobs

Manually trigger cron jobs (for testing):

```bash
# Data ingestion
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/data-ingestion

# Agent analysis
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/agent-analysis

# Alert evaluation
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/alert-evaluation
```

### 5. Access Agent Dashboard

Navigate to: `https://your-app.vercel.app/agent`

## Usage Examples

### 1. Create Alert with AI Monitoring

```typescript
// User creates alert via UI
POST /api/alerts
{
  "name": "Severe Geomagnetic Storm Warning",
  "conditions": {
    "kp_ge": 7,
    "bz_lt": -10
  },
  "channel": "email",
  "target": "user@example.com",
  "status": "active"
}

// Agent automatically:
// 1. Evaluates condition every minute
// 2. Generates AI reasoning when triggered
// 3. Sends email with context
// 4. Tracks false positives
// 5. Adjusts threshold if needed
```

### 2. Trigger Immediate Analysis

```typescript
// Frontend button click
const response = await fetch('/api/agents/monitoring-agent?analyze=true');
const { decision } = await response.json();

console.log(decision.priority);    // "high"
console.log(decision.reasoning);   // "HIGH: Moderate southward Bz (-6.2 nT)..."
console.log(decision.confidence);  // 0.87
```

### 3. Provide Feedback on Alert

```typescript
// User marks alert as false positive
POST /api/agents/monitoring-agent
{
  "action": "feedback",
  "decision_id": "...",
  "alert_id": "...",
  "feedback": {
    "outcome": "false_positive",
    "comment": "System recovered quickly, no actual impact"
  }
}

// Agent learns from feedback:
// - Updates decision outcome
// - Marks alert history as false positive
// - Threshold adjustment job will account for this
```

### 4. Query Decision History

```typescript
// Fetch recent critical decisions
GET /api/agents/decisions?priority=critical&limit=10

// Response includes statistics
{
  "decisions": [...],
  "stats": {
    "total": 47,
    "by_priority": { "critical": 5, "high": 12, ... },
    "avg_confidence": 0.82
  }
}
```

## Performance Tuning

### Adjusting Cron Frequencies

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/agent-analysis",
      "schedule": "*/2 * * * *"  // Change to every 2 min
    }
  ]
}
```

### Customizing AI Prompts

Edit `lib/agent.ts`:

```typescript
const systemPrompt = `You are an expert space weather analyst...
  // Customize instructions, thresholds, decision criteria
`;
```

### Adjusting False Positive Target

Edit `app/api/cron/threshold-adjustment/route.ts`:

```typescript
const targetRate = 0.05; // Change from 5% to desired rate
```

## Monitoring & Observability

### Agent Health

Check agent status:
```
GET /api/agents/monitoring-agent
```

Monitor for:
- Recent decision timestamps (should be ~5 min apart)
- Confidence scores (should be > 0.6)
- Error rates in system_logs collection

### Cron Job Logs

View in Vercel Dashboard:
- Functions → Cron Jobs
- Check execution logs
- Monitor failure rates

### Performance Metrics

Dashboard shows:
- **Precision**: Accuracy of alerts (low false positives)
- **Recall**: Coverage of events (low missed events)
- **F1 Score**: Balance between precision and recall
- **Prediction Accuracy**: How well forecasts match reality

Target metrics:
- Precision > 80%
- Recall > 70%
- F1 Score > 75%
- Prediction Accuracy > 70%

## Troubleshooting

### Issue: Cron jobs not running

**Check:**
1. Vercel deployment includes `vercel.json`
2. `CRON_SECRET` is set in environment variables
3. Cron logs in Vercel dashboard

### Issue: AI reasoning returns fallback

**Check:**
1. `ANTHROPIC_API_KEY` is valid
2. API quota not exceeded
3. Network connectivity to Anthropic API

### Issue: Notifications not sending

**Check:**
1. Email: `RESEND_API_KEY` or `SENDGRID_API_KEY` set
2. SMS: Twilio credentials valid
3. Webhook: Target URL is accessible
4. Check `alert_history.notification_sent` field

### Issue: Thresholds not adjusting

**Check:**
1. Threshold adjustment cron running every 6 hours
2. Sufficient alert history (at least 7 days)
3. False positive rate deviates from target (5%)

## Future Enhancements

### Planned Features

1. **Multi-Model Ensemble**
   - Combine Surya, statistical, and physics-based models
   - Weight by historical accuracy

2. **Natural Language Alert Creation**
   - "Alert me when there's a severe storm affecting North America"
   - LLM parses intent into structured conditions

3. **Proactive Recommendations**
   - Agent suggests new alerts based on user's operations
   - "You have assets in polar regions, consider monitoring TEC gradients"

4. **Causal Inference**
   - Explain event chains: "Bz south → Kp rise → HF blackout"
   - Predict downstream impacts

5. **Agent Conversation Interface**
   - Chat with agent about space weather
   - Ask questions: "Why did Kp spike at 2pm?"
   - Get explanations in natural language

6. **Advanced Learning**
   - Fine-tune models on local data
   - Personalized risk scoring per user
   - Industry-specific thresholds (aviation, power, satellites)

## Architecture Decisions

### Why Claude (Anthropic) for AI?

- Superior reasoning capabilities
- Long context windows (200K tokens)
- Excellent at structured output
- Function calling support (future)
- Ethical AI principles

### Why Vercel Cron?

- Native integration with Next.js
- Reliable scheduling
- Free tier includes cron
- Edge-optimized execution

### Why MongoDB Time Series?

- Automatic data expiration (TTL)
- Optimized for time-based queries
- Built-in downsampling
- Efficient storage for sensor data

### Why Server-Sent Events vs WebSocket?

- SSE simpler to implement
- Works with Vercel Edge Runtime
- No need for persistent connections
- Can upgrade to Pusher/Ably for production

## Security Considerations

1. **Cron Authentication**: All cron endpoints require `CRON_SECRET` header
2. **API Key Storage**: Never commit `.env.local` to git
3. **User Data**: Alert targets (emails, phone numbers) stored per user
4. **Rate Limiting**: Consider adding rate limits to public APIs
5. **Input Validation**: All API inputs validated with Zod schemas

## Cost Estimates

### Anthropic Claude API
- ~$3 per 1M input tokens
- ~$15 per 1M output tokens
- Estimated: $10-30/month for 5-min analysis cadence

### Email (Resend)
- Free: 100 emails/day
- Pro: $20/month for 50K emails

### SMS (Twilio)
- $0.0075 per SMS
- Budget $50/month for moderate usage

### Vercel
- Hobby: Free (includes cron)
- Pro: $20/month (more cron executions)

### MongoDB Atlas
- M0 Free: 512MB (sufficient for MVP)
- M10: $57/month (1-2GB, recommended for production)

**Total estimated monthly cost: $100-200 for production usage**

## License

This agentic AI system is part of the TSWI platform. See main README for license information.

## Support

For issues or questions:
1. Check agent dashboard for error messages
2. Review Vercel function logs
3. Inspect MongoDB collections for data issues
4. Open GitHub issue with reproduction steps

---

**Built with** ❤️ **using Claude Code**
