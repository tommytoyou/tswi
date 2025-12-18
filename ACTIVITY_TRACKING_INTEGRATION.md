# Activity Tracking Integration Guide

This document explains how to integrate activity tracking into your AI API routes and frontend components.

## Overview

The activity tracking system automatically tracks:
- Page views (automatic via dashboard layout)
- Tab switches (manual via hook)
- Login/logout (automatic)
- AI queries (manual via hook or backend helper)
- Feature interactions (manual via hook)

## Frontend Integration

### Automatic Tracking

The dashboard layout (`app/(dashboard)/layout.tsx`) automatically tracks:
- Login events when user authenticates
- Page view events when navigating between pages
- Logout events (if using the hook's `trackLogout` method)

### Manual Tracking

Use the `useActivityTracker` hook to track custom events:

```typescript
import { useActivityTracker } from '@/hooks/useActivityTracker';

export function MyComponent() {
  const { trackTabSwitch, trackFeatureInteraction, trackAIQuery } = useActivityTracker();

  // Track when user switches tabs
  const handleTabChange = (tabName: string) => {
    trackTabSwitch(tabName);
    // ... your tab switch logic
  };

  // Track feature usage
  const handleExport = () => {
    trackFeatureInteraction('data_export', { format: 'csv' });
    // ... your export logic
  };

  // Track AI query from frontend
  const handleAIQuery = async (query: string) => {
    const startTime = Date.now();
    const response = await fetch('/api/ai/surya-prediction');
    const responseTime = Date.now() - startTime;

    trackAIQuery(query, tokensUsed, 'surya-1.0', responseTime);
  };
}
```

## Backend Integration

### Tracking AI Queries from API Routes

Use the `trackAIQuery` helper in your AI API routes:

```typescript
import { trackAIQuery } from '@/lib/activity-tracker';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Your AI logic here
    const prediction = await generatePrediction();
    const responseTime = Date.now() - startTime;

    // Track the AI query
    await trackAIQuery({
      query: 'Solar flare prediction request',
      tokensUsed: 150, // If applicable
      model: 'surya-1.0',
      responseTime,
      metadata: {
        predictionType: 'solar_flare',
        confidence: prediction.confidence,
      },
    });

    return NextResponse.json({ success: true, data: prediction });
  } catch (error) {
    // Handle error
  }
}
```

### Example: Updating Existing AI Routes

Here's how to update the surya-prediction route:

```typescript
// app/api/ai/surya-prediction/route.ts
import { trackAIQuery } from '@/lib/activity-tracker';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Existing authentication check
    const authError = await requireAIAccess();
    if (authError) return authError;

    // Your existing prediction logic...
    const predictions = generateEnhancedPredictions(...);

    // Track the AI query
    const responseTime = Date.now() - startTime;
    await trackAIQuery({
      query: 'Solar flare probability prediction',
      model: 'NOAA SWPC Enhanced',
      responseTime,
      metadata: {
        forecast_horizon_hours: 2,
        prediction_count: predictions.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: { ...existingData },
    });
  } catch (error) {
    // Handle error
  }
}
```

## Admin Panel Usage

### Accessing Activity Data

1. Navigate to `/admin` and click the "Activity" tab
2. View the Activity Summary dashboard showing:
   - Total active users
   - Total sessions
   - Page views
   - AI queries
   - Per-user breakdown

3. View the Real-time Activity Feed showing live user actions

4. Click on any user row in the summary table to view detailed activity timeline

### API Endpoints

For custom integrations, you can use these admin API endpoints:

```typescript
// Get paginated activity logs
GET /api/admin/activity?userId=xxx&eventType=ai_query&startDate=xxx&endDate=xxx&limit=50&page=1

// Get aggregated summary
GET /api/admin/activity/summary?startDate=xxx&endDate=xxx

// Real-time SSE feed
GET /api/admin/activity/realtime
```

## Database Schema

Activities are stored in the `user_activity` collection with this structure:

```typescript
{
  _id: ObjectId,
  userId: string,
  userEmail: string,
  userName: string,
  eventType: 'page_view' | 'tab_switch' | 'login' | 'logout' | 'ai_query' | 'feature_interaction',
  eventData: {
    page?: string,
    tab?: string,
    feature?: string,
    aiTokensUsed?: number,
    aiQuery?: string,
    aiModel?: string,
    aiResponseTime?: number,
    metadata?: Record<string, any>
  },
  sessionId: string,
  timestamp: Date,
  userAgent?: string,
  ip?: string
}
```

## Indexes

The following indexes are automatically created:
- `{ userId: 1, timestamp: -1 }` - User activity timeline
- `{ timestamp: -1 }` - Recent activity
- `{ eventType: 1, timestamp: -1 }` - Activity by type
- `{ sessionId: 1 }` - Session-based queries
- `{ userId: 1, eventType: 1, timestamp: -1 }` - Composite queries

## Privacy & Security

- IP addresses are anonymized (last octet removed)
- AI queries are truncated to 100 characters
- Only admins can access activity data
- User authentication required for tracking
- Failed tracking attempts fail silently without disrupting user experience

## Performance Considerations

- Activity tracking uses fire-and-forget pattern
- Failed tracking doesn't affect main application flow
- Real-time feed limited to last 50 events
- Debouncing applied to tab switches (500ms) and feature interactions (1s)
- MongoDB indexes optimize query performance
