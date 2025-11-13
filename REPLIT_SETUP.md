# Replit Deployment Guide for TSWI

## Overview
This guide covers setting up and deploying the TSWI (Space Weather Intelligence) platform on Replit.

## Required Environment Variables

### Database Configuration
```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/tswi?retryWrites=true&w=majority
MONGODB_DB=tswi
```
- Get MongoDB Atlas connection string from [MongoDB Atlas](https://cloud.mongodb.com)
- Create a free cluster and whitelist Replit's IP addresses (or use 0.0.0.0/0 for development)

### Cesium Configuration
```
NEXT_PUBLIC_CESIUM_ION_TOKEN=your_cesium_ion_access_token
```
- Sign up at [Cesium Ion](https://cesium.com/ion)
- Create a new access token with default asset permissions

### API Configuration
```
NEXT_PUBLIC_APP_URL=https://your-repl-name.your-username.repl.co
```
- This is automatically set by Replit if using REPL_SLUG and REPL_OWNER
- Only set manually if you have a custom domain

### Authentication
```
AUTH_SECRET=your-secret-key-change-in-production
```
- Generate a strong random string for production
- Use: `openssl rand -base64 32` or similar

### AI Services

#### Anthropic Claude API
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```
- Get API key from [Anthropic Console](https://console.anthropic.com)
- Required for agentic AI monitoring and decision-making

#### Hugging Face API
```
HUGGINGFACE_API_TOKEN=your_huggingface_api_token_here
```
- Get token from [Hugging Face](https://huggingface.co/settings/tokens)
- Required for AI model inference

### Cron Job Security
```
CRON_SECRET=your_secure_random_string_here
```
- Generate a strong random string
- Used to authenticate cron job endpoints
- Use: `openssl rand -base64 32`

### Email Notifications (Choose One)

#### Option 1: Resend (Recommended)
```
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM=alerts@tswi.space
```
- Sign up at [Resend](https://resend.com)
- Verify your domain or use sandbox domain for testing

#### Option 2: SendGrid
```
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=alerts@tswi.space
```
- Sign up at [SendGrid](https://sendgrid.com)
- Create an API key with Mail Send permissions

### SMS Notifications (Twilio)
```
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```
- Sign up at [Twilio](https://www.twilio.com)
- Get a phone number and API credentials
- Optional but required for SMS alerts

### Optional Services

#### WebSocket/Push Notifications (Pusher)
```
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_cluster
```
- Optional: For production-grade real-time notifications
- Sign up at [Pusher](https://pusher.com)

#### Monitoring (Sentry)
```
SENTRY_DSN=your_sentry_dsn
```
- Optional: For error tracking
- Sign up at [Sentry](https://sentry.io)

## Setting Up Secrets in Replit

1. Open your Repl
2. Click on "Tools" in the left sidebar
3. Select "Secrets"
4. Add each environment variable as a secret:
   - Key: Variable name (e.g., `MONGODB_URI`)
   - Value: Your actual value

**Important:** Never commit `.env` files with real credentials to git!

## Replit Configuration Files

### .replit
Already configured with:
- Port 5000 for both dev and production
- Node.js 20 runtime
- Automatic build and deployment settings

### Port Configuration
- Local port: 5000
- External port: 80 (mapped automatically by Replit)
- All API endpoints accessible at `/api/*`

## Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
- Add all required secrets in Replit Secrets
- Minimum required for basic functionality:
  - `MONGODB_URI`
  - `MONGODB_DB`
  - `NEXT_PUBLIC_CESIUM_ION_TOKEN`
  - `AUTH_SECRET`

### 3. Build the Application
```bash
npm run build
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Deploy to Production
- Click "Deploy" in Replit
- Choose "Autoscale" deployment
- Your app will be available at: `https://your-repl-name.your-username.repl.co`

## Custom Domain Setup

### Using tswi-ai.com

1. **Add Custom Domain in Replit:**
   - Go to Replit deployment settings
   - Click "Add Custom Domain"
   - Enter: `tswi-ai.com` or `www.tswi-ai.com`

2. **Configure DNS:**
   - Add CNAME record:
     ```
     Type: CNAME
     Name: www (or @)
     Value: your-repl-name.your-username.repl.co
     ```
   - Or add A records provided by Replit

3. **Update Environment Variables:**
   ```
   NEXT_PUBLIC_APP_URL=https://tswi-ai.com
   ```

4. **SSL Certificate:**
   - Replit automatically provisions SSL certificates for custom domains
   - Wait 5-10 minutes for DNS propagation

## Testing the Deployment

### 1. Health Check
```bash
curl https://your-repl-name.your-username.repl.co/api/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-11-13T...",
    "database": "connected"
  }
}
```

### 2. Test Authentication
- Navigate to `/login`
- Use credentials: `admin` / `admin123` (for dev)
- Should redirect to `/dashboard` on success

### 3. Test API Endpoints
```bash
# Solar wind data
curl https://your-repl-name.your-username.repl.co/api/noaa/solar-wind

# Kp index
curl https://your-repl-name.your-username.repl.co/api/noaa/kp-index

# Alerts
curl https://your-repl-name.your-username.repl.co/api/alerts
```

### 4. Test Cron Jobs
```bash
# Trigger data ingestion manually
curl -X GET https://your-repl-name.your-username.repl.co/api/cron/data-ingestion \
  -H "Authorization: Bearer your_cron_secret"
```

## Cron Job Setup on Replit

Replit doesn't have built-in cron support like Vercel. You have several options:

### Option 1: External Cron Service (Recommended)

Use a free cron service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com):

1. Sign up for the service
2. Add cron jobs to call your API endpoints:

**Data Ingestion (Every 1 minute):**
```
URL: https://tswi-ai.com/api/cron/data-ingestion
Method: GET
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: */1 * * * *
```

**Alert Evaluation (Every 1 minute):**
```
URL: https://tswi-ai.com/api/cron/alert-evaluation
Method: GET
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: */1 * * * *
```

**Agent Analysis (Every 5 minutes):**
```
URL: https://tswi-ai.com/api/cron/agent-analysis
Method: GET
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: */5 * * * *
```

**Threshold Adjustment (Every 6 hours):**
```
URL: https://tswi-ai.com/api/cron/threshold-adjustment
Method: GET
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: 0 */6 * * *
```

**Metrics Calculation (Every hour):**
```
URL: https://tswi-ai.com/api/cron/metrics-calculation
Method: GET
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: 0 * * * *
```

### Option 2: GitHub Actions

Create `.github/workflows/cron.yml`:
```yaml
name: Cron Jobs
on:
  schedule:
    - cron: '*/1 * * * *'  # Every minute
jobs:
  data-ingestion:
    runs-on: ubuntu-latest
    steps:
      - name: Call data ingestion
        run: |
          curl -X GET https://tswi-ai.com/api/cron/data-ingestion \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Option 3: Internal Scheduler (Not Recommended for Production)

Use node-cron or similar, but this requires your Repl to always be running.

## Monitoring and Logs

### View Logs in Replit
- Click "Console" in Replit to see server logs
- Logs show:
  - API requests
  - Database connections
  - Cron job executions
  - Errors and warnings

### Production Monitoring
- Add Sentry for error tracking
- Monitor MongoDB Atlas for database performance
- Use Replit Analytics for traffic insights

## Troubleshooting

### Database Connection Issues
- Verify MongoDB URI is correct
- Check IP whitelist in MongoDB Atlas
- Ensure network access is enabled

### Port Issues
- App should run on port 5000 (configured in package.json)
- Replit automatically maps external port 80 to internal 5000

### Authentication Not Working
- Check AUTH_SECRET is set
- Clear cookies and try again
- Verify middleware is not blocking routes

### Cron Jobs Not Running
- Verify CRON_SECRET matches in external cron service
- Check API endpoint is accessible
- Review logs for errors

### API Timeouts
- Increase timeout in cron service settings
- Check MongoDB query performance
- Optimize data fetching

## Performance Optimization

### Database Indexes
Run these commands in MongoDB:
```javascript
// Time series indexes
db.timeseries_noaa_solarwind_mag.createIndex({ ts: -1 })
db.timeseries_noaa_kp_index.createIndex({ ts: -1 })
db.timeseries_noaa_xray_flux.createIndex({ ts: -1 })

// Alert indexes
db.alerts.createIndex({ user_id: 1, enabled: 1 })
db.alert_history.createIndex({ triggered_at: -1 })

// Agent indexes
db.agent_decisions.createIndex({ ts: -1 })
db.agent_metrics.createIndex({ ts: -1 })
```

### Caching
- Consider adding Redis for caching (Upstash Redis works well with Replit)
- Cache frequently accessed data
- Use SWR or React Query on frontend

### CDN
- Replit includes basic CDN
- For production, consider Cloudflare for additional caching

## Security Checklist

- [ ] All environment variables set as Replit Secrets
- [ ] Strong AUTH_SECRET generated
- [ ] CRON_SECRET is complex and secret
- [ ] MongoDB uses strong password
- [ ] MongoDB network access restricted
- [ ] API keys have minimal required permissions
- [ ] CORS configured correctly
- [ ] HTTPS enabled (automatic on Replit)
- [ ] Rate limiting configured (add if needed)
- [ ] Input validation on all API endpoints

## Support and Resources

- [Replit Docs](https://docs.replit.com)
- [Next.js Docs](https://nextjs.org/docs)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com)
- [TSWI GitHub Issues](https://github.com/your-repo/issues)

## Migration from Vercel

Key differences from Vercel:
- No built-in cron jobs (use external service)
- Port 5000 instead of 3000
- Different deployment process
- Environment variables via Replit Secrets
- No edge functions (use regular Next.js API routes)

All Vercel-specific code has been removed or updated for Replit compatibility.
