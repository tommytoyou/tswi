'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, Eye, Sparkles, TrendingUp } from 'lucide-react';

interface UserSummary {
  userId: string;
  userEmail: string;
  userName: string;
  totalSessions: number;
  totalPageViews: number;
  aiQueriesCount: number;
  totalAiTokens: number;
  lastActive: string;
  mostViewedTabs: Array<{ tab: string; count: number }>;
}

interface OverallStats {
  totalUsers: number;
  totalSessions: number;
  totalPageViews: number;
  totalAiQueries: number;
  totalAiTokens: number;
}

interface ActivitySummaryProps {
  onUserClick?: (userId: string) => void;
}

export function ActivitySummary({ onUserClick }: ActivitySummaryProps) {
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    fetchSummary();
  }, [dateRange]);

  const fetchSummary = async () => {
    try {
      setLoading(true);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      startDate.setDate(startDate.getDate() - days);

      const response = await fetch(
        `/api/admin/activity/summary?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      const data = await response.json();

      if (data.success) {
        setUserSummaries(data.data.userSummaries);
        setOverallStats(data.data.overallStats);
      }
    } catch (error) {
      console.error('Error fetching activity summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats Cards */}
      {overallStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-slate-700 bg-slate-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Active Users</p>
                  <p className="text-3xl font-bold text-blue-400">{formatNumber(overallStats.totalUsers)}</p>
                </div>
                <Users className="h-10 w-10 text-blue-400/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Sessions</p>
                  <p className="text-3xl font-bold text-green-400">{formatNumber(overallStats.totalSessions)}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-green-400/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Page Views</p>
                  <p className="text-3xl font-bold text-purple-400">{formatNumber(overallStats.totalPageViews)}</p>
                </div>
                <Eye className="h-10 w-10 text-purple-400/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">AI Queries</p>
                  <p className="text-3xl font-bold text-amber-400">{formatNumber(overallStats.totalAiQueries)}</p>
                </div>
                <Sparkles className="h-10 w-10 text-amber-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Summary Table */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">User Activity Summary</CardTitle>
              <CardDescription className="text-slate-400">
                Detailed breakdown by user
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSummary}
                className="border-slate-600 text-slate-300"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : userSummaries.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No activity data found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">User</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Sessions</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Page Views</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">AI Queries</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">AI Tokens</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Top Tabs</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {userSummaries.map((user) => (
                    <tr
                      key={user.userId}
                      onClick={() => onUserClick?.(user.userId)}
                      className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-white text-sm">{user.userName}</p>
                          <p className="text-xs text-slate-400">{user.userEmail}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">{formatNumber(user.totalSessions)}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{formatNumber(user.totalPageViews)}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{formatNumber(user.aiQueriesCount)}</td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        {user.totalAiTokens > 0 ? formatNumber(user.totalAiTokens) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.mostViewedTabs.slice(0, 3).map((tab, index) => (
                            <span
                              key={index}
                              className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded"
                            >
                              {tab.tab} ({tab.count})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-slate-400">
                        {new Date(user.lastActive).toLocaleDateString()}
                        <br />
                        <span className="text-xs text-slate-500">
                          {new Date(user.lastActive).toLocaleTimeString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
