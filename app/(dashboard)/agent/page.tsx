'use client';

import { useEffect, useState } from 'react';
import {
  AgentDecisionHistory,
  AgentMetricsCard,
  PredictionAccuracyChart,
  RecentAlertsCard,
  AdaptiveThresholdsCard,
} from '@/components/agent/agent-dashboard-cards';

interface AgentData {
  status: string;
  recent_decisions: any[];
  metrics: any;
  adaptive_thresholds: any[];
  recent_alerts: any[];
}

export default function AgentDashboardPage() {
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchAgentData();
    const interval = setInterval(fetchAgentData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchAgentData = async () => {
    try {
      const response = await fetch('/api/agents/monitoring-agent?limit=20');
      if (response.ok) {
        const result = await response.json();
        setAgentData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalysis = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/agents/monitoring-agent?analyze=true');
      if (response.ok) {
        const result = await response.json();
        // Refresh data after analysis
        await fetchAgentData();
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading agent data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            🤖 Autonomous Monitoring Agent
          </h1>
          <p className="text-gray-400">
            AI-powered space weather analysis and decision making
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 font-medium">
              {agentData?.status || 'operational'}
            </span>
          </div>

          {/* Trigger Analysis Button */}
          <button
            onClick={triggerAnalysis}
            disabled={analyzing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {analyzing ? 'Analyzing...' : '🔄 Analyze Now'}
          </button>
        </div>
      </div>

      {/* Metrics Overview */}
      {agentData?.metrics && (
        <AgentMetricsCard metrics={agentData.metrics} />
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Decision History */}
        <AgentDecisionHistory decisions={agentData?.recent_decisions || []} />

        {/* Recent Alerts with AI Reasoning */}
        <RecentAlertsCard alerts={agentData?.recent_alerts || []} />
      </div>

      {/* Prediction Accuracy Charts */}
      <PredictionAccuracyChart />

      {/* Adaptive Thresholds */}
      <AdaptiveThresholdsCard thresholds={agentData?.adaptive_thresholds || []} />
    </div>
  );
}
