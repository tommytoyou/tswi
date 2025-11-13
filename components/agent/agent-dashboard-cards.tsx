'use client';

import { useEffect, useState } from 'react';

// ============================================================================
// AGENT METRICS CARD
// ============================================================================

interface AgentMetricsProps {
  metrics: any;
}

export function AgentMetricsCard({ metrics }: AgentMetricsProps) {
  if (!metrics) return null;

  const MetricBox = ({ label, value, suffix = '', trend }: any) => (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-white">
          {value}{suffix}
        </div>
        {trend && (
          <div className={`text-sm ${
            trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Performance Metrics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricBox
          label="Total Alerts"
          value={metrics.total_alerts}
        />
        <MetricBox
          label="Precision"
          value={(metrics.precision * 100).toFixed(1)}
          suffix="%"
        />
        <MetricBox
          label="Recall"
          value={(metrics.recall * 100).toFixed(1)}
          suffix="%"
        />
        <MetricBox
          label="F1 Score"
          value={(metrics.f1_score * 100).toFixed(1)}
          suffix="%"
        />
        <MetricBox
          label="Avg Confidence"
          value={(metrics.avg_confidence * 100).toFixed(1)}
          suffix="%"
        />
        <MetricBox
          label="Prediction Accuracy"
          value={(metrics.avg_prediction_accuracy * 100).toFixed(1)}
          suffix="%"
        />
        <MetricBox
          label="False Positives"
          value={metrics.false_positives}
        />
        <MetricBox
          label="Critical Alerts"
          value={metrics.critical_alerts}
        />
      </div>
    </div>
  );
}

// ============================================================================
// AGENT DECISION HISTORY
// ============================================================================

interface DecisionHistoryProps {
  decisions: any[];
}

export function AgentDecisionHistory({ decisions }: DecisionHistoryProps) {
  const priorityColors = {
    critical: 'bg-red-500/20 border-red-500 text-red-400',
    high: 'bg-orange-500/20 border-orange-500 text-orange-400',
    medium: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
    low: 'bg-blue-500/20 border-blue-500 text-blue-400',
  };

  const outcomeColors = {
    pending: 'text-gray-400',
    success: 'text-green-400',
    false_positive: 'text-red-400',
    missed_event: 'text-orange-400',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Decision History</h2>
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {decisions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No decisions yet</p>
        ) : (
          decisions.map((decision, idx) => (
            <div
              key={idx}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded border ${
                    priorityColors[decision.priority as keyof typeof priorityColors]
                  }`}>
                    {decision.priority.toUpperCase()}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {decision.decision_type?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">
                    {new Date(decision.ts).toLocaleTimeString()}
                  </div>
                  {decision.outcome && (
                    <div className={`text-xs font-medium ${
                      outcomeColors[decision.outcome as keyof typeof outcomeColors]
                    }`}>
                      {decision.outcome?.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-2">
                {decision.reasoning}
              </p>

              <div className="flex items-center justify-between text-xs">
                <div className="text-gray-500">
                  Action: {decision.action_taken}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-gray-400">Confidence:</div>
                  <div className="bg-gray-700 rounded-full h-2 w-24 overflow-hidden">
                    <div
                      className="bg-purple-500 h-full"
                      style={{ width: `${(decision.confidence || 0) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-gray-300 font-medium">
                    {((decision.confidence || 0) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// RECENT ALERTS CARD
// ============================================================================

interface RecentAlertsProps {
  alerts: any[];
}

export function RecentAlertsCard({ alerts }: RecentAlertsProps) {
  const priorityColors = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-blue-500 text-white',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Recent Alerts</h2>
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {alerts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No alerts triggered</p>
        ) : (
          alerts.map((alert, idx) => (
            <div
              key={idx}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <span className={`px-3 py-1 text-xs font-bold rounded ${
                  priorityColors[alert.priority as keyof typeof priorityColors]
                }`}>
                  {alert.priority.toUpperCase()}
                </span>
                <div className="text-xs text-gray-500">
                  {new Date(alert.triggered_at).toLocaleString()}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-sm font-medium text-white mb-1">
                  AI Reasoning:
                </div>
                <p className="text-gray-300 text-sm">
                  {alert.ai_reasoning}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <div className={`px-2 py-1 rounded ${
                    alert.notification_sent
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {alert.notification_sent ? '✓ Sent' : '✗ Failed'}
                  </div>
                  <div className="text-gray-400">
                    via {alert.notification_channel}
                  </div>
                </div>
                {alert.false_positive && (
                  <div className="px-2 py-1 bg-red-500/20 text-red-400 rounded">
                    False Positive
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PREDICTION ACCURACY CHART
// ============================================================================

export function PredictionAccuracyChart() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredictionData();
  }, []);

  const fetchPredictionData = async () => {
    try {
      const response = await fetch('/api/agents/predictions?limit=30');
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch prediction data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Prediction vs Reality</h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading chart...</div>
        </div>
      </div>
    );
  }

  const accuracyRecords = data?.accuracy_records || [];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Prediction vs Reality</h2>
        <div className="text-sm text-gray-400">
          Avg Accuracy: {(data?.stats?.avg_accuracy_score * 100 || 0).toFixed(1)}%
        </div>
      </div>

      {/* Simple bar chart */}
      <div className="space-y-3">
        {accuracyRecords.slice(0, 10).map((record: any, idx: number) => (
          <div key={idx} className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2 text-sm">
              <div className="text-gray-400">
                {new Date(record.prediction_ts).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-gray-300">
                  Predicted: <span className="font-bold">{record.predicted_value?.toFixed(1)}</span>
                </div>
                <div className="text-gray-300">
                  Actual: <span className="font-bold">{record.actual_value?.toFixed(1)}</span>
                </div>
                <div className={`font-bold ${
                  (record.accuracy_score || 0) > 0.8 ? 'text-green-400' :
                  (record.accuracy_score || 0) > 0.6 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {((record.accuracy_score || 0) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${
                  (record.accuracy_score || 0) > 0.8 ? 'bg-green-500' :
                  (record.accuracy_score || 0) > 0.6 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${(record.accuracy_score || 0) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats by source */}
      {data?.stats?.by_source && (
        <div className="mt-6 pt-6 border-t border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-3">By Source</h3>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(data.stats.by_source).map(([source, stats]: [string, any]) => (
              <div key={source} className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">{source}</div>
                <div className="text-xl font-bold text-white">
                  {(stats.avg_accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  {stats.count} predictions
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADAPTIVE THRESHOLDS CARD
// ============================================================================

interface AdaptiveThresholdsProps {
  thresholds: any[];
}

export function AdaptiveThresholdsCard({ thresholds }: AdaptiveThresholdsProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Adaptive Thresholds</h2>
      <p className="text-gray-400 text-sm mb-4">
        Self-tuning thresholds adjusted based on false positive rates
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {thresholds.length === 0 ? (
          <p className="text-gray-500 col-span-3 text-center py-8">
            No thresholds configured yet
          </p>
        ) : (
          thresholds.map((threshold, idx) => (
            <div
              key={idx}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
            >
              <div className="text-sm text-gray-400 mb-2">
                {threshold.parameter.toUpperCase()}
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <div className="text-2xl font-bold text-white">
                  {threshold.current_threshold?.toFixed(1)}
                </div>
                {threshold.initial_threshold !== threshold.current_threshold && (
                  <div className="text-sm text-gray-500">
                    (was {threshold.initial_threshold?.toFixed(1)})
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400 mb-2">
                False Positive Rate: {(threshold.false_positive_rate * 100).toFixed(1)}%
                <span className="text-gray-500"> (target: {(threshold.target_false_positive_rate * 100).toFixed(0)}%)</span>
              </div>
              {threshold.adjustment_history && threshold.adjustment_history.length > 0 && (
                <div className="text-xs text-gray-500">
                  Last adjusted: {new Date(threshold.last_adjusted_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
