'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Eye, MousePointer, LogIn, LogOut, Sparkles, Activity } from 'lucide-react';
import type { UserActivity } from '@/lib/types';

interface UserActivityModalProps {
  userId: string | null;
  onClose: () => void;
}

export function UserActivityModal({ userId, onClose }: UserActivityModalProps) {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionStats, setSessionStats] = useState<{
    sessions: number;
    avgDuration: number;
  } | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserActivity();
    }
  }, [userId]);

  const fetchUserActivity = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/activity?userId=${userId}&limit=200`);
      const data = await response.json();

      if (data.success) {
        setActivities(data.data.activities);
        calculateSessionStats(data.data.activities);
      }
    } catch (error) {
      console.error('Error fetching user activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSessionStats = (activities: UserActivity[]) => {
    const sessions = new Set(activities.map(a => a.sessionId));
    // Simple duration calculation - more sophisticated in production
    setSessionStats({
      sessions: sessions.size,
      avgDuration: 0, // Would need session start/end times
    });
  };

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
        return eventData.aiQuery ? `"${eventData.aiQuery}"` : 'AI query';
      case 'feature_interaction':
        return `Used ${eventData.feature || 'feature'}`;
      default:
        return eventType;
    }
  };

  // Group activities by session
  const groupBySession = () => {
    const sessions: Record<string, UserActivity[]> = {};
    activities.forEach(activity => {
      if (!sessions[activity.sessionId]) {
        sessions[activity.sessionId] = [];
      }
      sessions[activity.sessionId].push(activity);
    });
    return Object.entries(sessions);
  };

  if (!userId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="border-slate-700 bg-slate-900 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">
                User Activity Details
              </CardTitle>
              <CardDescription className="text-slate-400">
                {activities[0]?.userName} ({activities[0]?.userEmail})
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-600 text-slate-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {sessionStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Total Sessions</p>
                <p className="text-xl font-bold text-white">{sessionStats.sessions}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Total Activities</p>
                <p className="text-xl font-bold text-white">{activities.length}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">AI Queries</p>
                <p className="text-xl font-bold text-white">
                  {activities.filter(a => a.eventType === 'ai_query').length}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Page Views</p>
                <p className="text-xl font-bold text-white">
                  {activities.filter(a => a.eventType === 'page_view').length}
                </p>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="overflow-y-auto flex-1 mt-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No activity found</div>
          ) : (
            <div className="space-y-6">
              {groupBySession().map(([sessionId, sessionActivities], sessionIndex) => (
                <div key={sessionId} className="border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-300">
                      Session {sessionIndex + 1}
                    </h4>
                    <span className="text-xs text-slate-500">
                      {sessionActivities.length} events
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sessionActivities.map((activity, index) => (
                      <div
                        key={activity._id || index}
                        className="flex items-start gap-3 p-2 rounded bg-slate-800/30"
                      >
                        <div className={`${getEventColor(activity.eventType)} mt-1`}>
                          {getEventIcon(activity.eventType)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-300">
                            {getEventDetails(activity)}
                          </div>
                          {activity.eventData.aiTokensUsed && (
                            <div className="text-xs text-amber-400 mt-1">
                              {activity.eventData.aiTokensUsed} tokens
                              {activity.eventData.aiResponseTime && (
                                <span className="ml-2 text-slate-500">
                                  ({activity.eventData.aiResponseTime}ms)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 whitespace-nowrap">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
