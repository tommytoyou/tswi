'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Eye, MousePointer, LogIn, LogOut, Sparkles, Activity, Search } from 'lucide-react';
import type { UserActivity } from '@/lib/types';

interface ActivityFeedProps {
  autoRefresh?: boolean;
}

export function ActivityFeed({ autoRefresh = false }: ActivityFeedProps) {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  // Fetch initial activities
  useEffect(() => {
    fetchActivities();
  }, []);

  // Setup SSE for real-time updates
  useEffect(() => {
    if (!autoRefresh) return;

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/api/admin/activity/realtime');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'activity') {
            // Prepend new activity to the list
            setActivities(prev => [data.data, ...prev].slice(0, 50)); // Keep only last 50
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource?.close();
      };
    } catch (error) {
      console.error('Error setting up SSE:', error);
    }

    return () => {
      eventSource?.close();
    };
  }, [autoRefresh]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/activity?limit=50');
      const data = await response.json();

      if (data.success) {
        setActivities(data.data.activities);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter activities
  const filteredActivities = activities.filter(activity => {
    const matchesSearch = filter === '' ||
      activity.userName.toLowerCase().includes(filter.toLowerCase()) ||
      activity.userEmail.toLowerCase().includes(filter.toLowerCase());

    const matchesEventType = eventTypeFilter === 'all' || activity.eventType === eventTypeFilter;

    return matchesSearch && matchesEventType;
  });

  // Get icon for event type
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'page_view':
        return <Eye className="h-4 w-4" />;
      case 'tab_switch':
        return <MousePointer className="h-4 w-4" />;
      case 'login':
        return <LogIn className="h-4 w-4" />;
      case 'logout':
        return <LogOut className="h-4 w-4" />;
      case 'ai_query':
        return <Sparkles className="h-4 w-4" />;
      case 'feature_interaction':
        return <Activity className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  // Get color for event type
  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'page_view':
        return 'text-blue-400';
      case 'tab_switch':
        return 'text-purple-400';
      case 'login':
        return 'text-green-400';
      case 'logout':
        return 'text-red-400';
      case 'ai_query':
        return 'text-amber-400';
      case 'feature_interaction':
        return 'text-cyan-400';
      default:
        return 'text-slate-400';
    }
  };

  // Format event details
  const getEventDetails = (activity: UserActivity) => {
    const { eventType, eventData } = activity;

    switch (eventType) {
      case 'page_view':
        return `Viewed ${eventData.page || 'page'}`;
      case 'tab_switch':
        return `Switched to ${eventData.tab || 'tab'}`;
      case 'login':
        return 'Logged in';
      case 'logout':
        return 'Logged out';
      case 'ai_query':
        return `AI query${eventData.aiTokensUsed ? ` (${eventData.aiTokensUsed} tokens)` : ''}`;
      case 'feature_interaction':
        return `Used ${eventData.feature || 'feature'}`;
      default:
        return eventType;
    }
  };

  return (
    <Card className="border-slate-700 bg-slate-900/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time Activity Feed
            </CardTitle>
            <CardDescription className="text-slate-400">
              Live user activity stream
              {autoRefresh && <span className="ml-2 text-green-400">(Live)</span>}
            </CardDescription>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search users..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Events</option>
            <option value="page_view">Page Views</option>
            <option value="tab_switch">Tab Switches</option>
            <option value="login">Logins</option>
            <option value="logout">Logouts</option>
            <option value="ai_query">AI Queries</option>
            <option value="feature_interaction">Feature Interactions</option>
          </select>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No activity found</div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredActivities.map((activity, index) => (
              <div
                key={activity._id || index}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                <div className={`${getEventColor(activity.eventType)}`}>
                  {getEventIcon(activity.eventType)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">
                      {activity.userName}
                    </span>
                    <span className="text-xs text-slate-400">
                      {activity.userEmail}
                    </span>
                  </div>
                  <div className="text-sm text-slate-300">
                    {getEventDetails(activity)}
                  </div>
                </div>

                <div className="text-xs text-slate-500 whitespace-nowrap">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
