'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Activity,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Mail,
  Webhook,
} from 'lucide-react';

// Types
type NotificationChannel = 'email' | 'webhook';

interface AlertCondition {
  metric: 'kp_index' | 'bz_value' | 'solar_wind_speed' | 'xray_flux' | 'proton_flux';
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  value: number;
}

interface AlertRule {
  _id: string;
  name: string;
  description?: string;
  conditions: AlertCondition[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notification_channels: NotificationChannel[];
  webhook_url?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

interface TriggeredAlert {
  _id: string;
  rule_id: string;
  rule_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions_met: Array<{
    metric: string;
    operator: string;
    threshold: number;
    actual_value: number;
  }>;
  data_snapshot: Record<string, any>;
  triggered_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
}

interface CurrentMetrics {
  kp_index: number | null;
  bz_value: number | null;
  solar_wind_speed: number | null;
  xray_flux: number | null;
  proton_flux: number | null;
  fetched_at: string;
}

// Constants
const METRICS = [
  { value: 'kp_index', label: 'Kp Index', unit: '' },
  { value: 'bz_value', label: 'Bz Value', unit: 'nT' },
  { value: 'solar_wind_speed', label: 'Solar Wind Speed', unit: 'km/s' },
  { value: 'xray_flux', label: 'X-ray Flux', unit: 'W/m²' },
  { value: 'proton_flux', label: 'Proton Flux', unit: 'pfu' },
];

const OPERATORS = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
];

const SEVERITIES = [
  { value: 'low', label: 'Low', color: 'bg-blue-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
};

const formatOperator = (op: string) => {
  switch (op) {
    case 'gt': return '>';
    case 'gte': return '>=';
    case 'lt': return '<';
    case 'lte': return '<=';
    case 'eq': return '=';
    default: return op;
  }
};

const formatMetricValue = (metric: string, value: number | null) => {
  if (value === null) return 'N/A';
  if (metric === 'xray_flux') return value.toExponential(2);
  if (metric === 'solar_wind_speed') return `${value.toFixed(0)} km/s`;
  if (metric === 'bz_value') return `${value.toFixed(1)} nT`;
  if (metric === 'proton_flux') return `${value.toFixed(1)} pfu`;
  return value.toFixed(1);
};

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<TriggeredAlert[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<CurrentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [historyStats, setHistoryStats] = useState<{ by_severity: Record<string, number>; unacknowledged: number } | null>(null);

  // Form state
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    conditions: [{ metric: 'kp_index' as const, operator: 'gte' as const, value: 5 }],
    severity: 'medium' as const,
    enabled: true,
    notification_channels: [] as NotificationChannel[],
    webhook_url: '',
    email: '',
  });

  // Fetch rules
  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/history?limit=20');
      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
        setHistoryStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }, []);

  // Check alerts
  const checkAlerts = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/alerts/check');
      const data = await res.json();
      if (data.success) {
        setCurrentMetrics(data.current_metrics);
        // Refresh history if any alerts were triggered
        if (data.saved_count > 0) {
          await fetchHistory();
        }
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    } finally {
      setChecking(false);
    }
  }, [fetchHistory]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRules(), fetchHistory(), checkAlerts()]);
      setLoading(false);
    };
    loadData();
  }, [fetchRules, fetchHistory, checkAlerts]);

  // Toggle rule enabled
  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const res = await fetch('/api/alerts/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: ruleId, enabled }),
      });
      if (res.ok) {
        setRules(rules.map(r => r._id === ruleId ? { ...r, enabled } : r));
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  // Delete rule
  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const res = await fetch(`/api/alerts/rules?id=${ruleId}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(rules.filter(r => r._id !== ruleId));
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch('/api/alerts/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: alertId, acknowledged: true }),
      });
      if (res.ok) {
        setHistory(history.map(h => h._id === alertId ? { ...h, acknowledged: true, acknowledged_at: new Date().toISOString() } : h));
        if (historyStats) {
          setHistoryStats({ ...historyStats, unacknowledged: Math.max(0, historyStats.unacknowledged - 1) });
        }
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  // Toggle notification channel
  const toggleNotificationChannel = (channel: NotificationChannel) => {
    setNewRule(prev => ({
      ...prev,
      notification_channels: prev.notification_channels.includes(channel)
        ? prev.notification_channels.filter(c => c !== channel)
        : [...prev.notification_channels, channel],
    }));
  };

  // Create rule
  const createRule = async () => {
    if (!newRule.name.trim()) return;

    // Validate notification settings
    if (newRule.notification_channels.includes('webhook') && !newRule.webhook_url.trim()) {
      alert('Please provide a webhook URL');
      return;
    }
    if (newRule.notification_channels.includes('email') && !newRule.email.trim()) {
      alert('Please provide an email address');
      return;
    }

    try {
      const payload = {
        ...newRule,
        webhook_url: newRule.webhook_url.trim() || undefined,
        email: newRule.email.trim() || undefined,
      };

      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setRules([data.data, ...rules]);
        setShowCreateForm(false);
        setNewRule({
          name: '',
          description: '',
          conditions: [{ metric: 'kp_index', operator: 'gte', value: 5 }],
          severity: 'medium',
          enabled: true,
          notification_channels: [],
          webhook_url: '',
          email: '',
        });
      }
    } catch (error) {
      console.error('Error creating rule:', error);
    }
  };

  // Add condition to new rule
  const addCondition = () => {
    setNewRule({
      ...newRule,
      conditions: [...newRule.conditions, { metric: 'kp_index', operator: 'gte', value: 5 }],
    });
  };

  // Remove condition from new rule
  const removeCondition = (index: number) => {
    if (newRule.conditions.length <= 1) return;
    setNewRule({
      ...newRule,
      conditions: newRule.conditions.filter((_, i) => i !== index),
    });
  };

  // Update condition
  const updateCondition = (index: number, field: keyof AlertCondition, value: any) => {
    const updated = [...newRule.conditions];
    updated[index] = { ...updated[index], [field]: value };
    setNewRule({ ...newRule, conditions: updated });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-400 animate-pulse" />
          <h1 className="text-3xl font-bold text-white">Loading alerts...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Bell className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Alert Rules</h1>
            <p className="text-slate-400 mt-1">Manage custom space weather alerts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={checkAlerts}
            disabled={checking}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            Check Now
          </Button>
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Current Metrics Status */}
      {currentMetrics && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-400" />
              Current Conditions
            </CardTitle>
            <CardDescription>
              Last checked: {new Date(currentMetrics.fetched_at).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {METRICS.map(m => (
                <div key={m.value} className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400">{m.label}</div>
                  <div className="text-lg font-mono text-white mt-1">
                    {formatMetricValue(m.value, currentMetrics[m.value as keyof CurrentMetrics] as number | null)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Rule Form */}
      {showCreateForm && (
        <Card className="bg-slate-900/50 border-blue-500/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Create New Alert Rule</span>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Geomagnetic Storm Watch"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={newRule.severity}
                  onValueChange={(v: any) => setNewRule({ ...newRule, severity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${s.color}`} />
                          {s.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="What does this alert monitor?"
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Conditions (all must be met)</Label>
                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              {newRule.conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-lg">
                  <Select
                    value={condition.metric}
                    onValueChange={(v: any) => updateCondition(index, 'metric', v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METRICS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={condition.operator}
                    onValueChange={(v: any) => updateCondition(index, 'operator', v)}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="any"
                    className="w-32"
                    value={condition.value}
                    onChange={(e) => updateCondition(index, 'value', parseFloat(e.target.value) || 0)}
                  />
                  {newRule.conditions.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeCondition(index)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Notification Settings */}
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <Label>Notification Channels (optional)</Label>
                <p className="text-xs text-slate-500">Get notified when this rule triggers</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => toggleNotificationChannel('webhook')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    newRule.notification_channels.includes('webhook')
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Webhook className="h-4 w-4" />
                  Webhook
                </button>
                <button
                  type="button"
                  onClick={() => toggleNotificationChannel('email')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    newRule.notification_channels.includes('email')
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
              </div>

              {newRule.notification_channels.includes('webhook') && (
                <div className="space-y-2">
                  <Label htmlFor="webhook_url">Webhook URL</Label>
                  <Input
                    id="webhook_url"
                    type="url"
                    placeholder="https://your-server.com/webhook"
                    value={newRule.webhook_url}
                    onChange={(e) => setNewRule({ ...newRule, webhook_url: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">
                    We&apos;ll POST a JSON payload when this alert triggers
                  </p>
                </div>
              )}

              {newRule.notification_channels.includes('email') && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={newRule.email}
                    onChange={(e) => setNewRule({ ...newRule, email: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">
                    Requires RESEND_API_KEY to be configured
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newRule.enabled}
                  onCheckedChange={(v) => setNewRule({ ...newRule, enabled: v })}
                />
                <Label>Enable immediately</Label>
              </div>
              <Button onClick={createRule} disabled={!newRule.name.trim()}>
                Create Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert Rules List */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Active Rules ({rules.filter(r => r.enabled).length} of {rules.length})
        </h2>
        {rules.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="py-8 text-center text-slate-400">
              No alert rules configured. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule._id} className={`bg-slate-900/50 ${rule.enabled ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => toggleRule(rule._id, v)}
                    />
                    <div>
                      <CardTitle className="text-lg">{rule.name}</CardTitle>
                      {rule.description && (
                        <CardDescription className="mt-1">{rule.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getSeverityColor(rule.severity)}>
                      {rule.severity}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedRule(expandedRule === rule._id ? null : rule._id)}
                    >
                      {expandedRule === rule._id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
                  {rule.conditions.map((c, i) => (
                    <span key={i} className="bg-slate-800 px-2 py-1 rounded font-mono">
                      {METRICS.find(m => m.value === c.metric)?.label} {formatOperator(c.operator)} {c.metric === 'xray_flux' ? c.value.toExponential(0) : c.value}
                    </span>
                  ))}
                  {/* Notification indicators */}
                  {rule.notification_channels && rule.notification_channels.length > 0 && (
                    <span className="ml-2 flex items-center gap-1 text-xs text-slate-500">
                      {rule.notification_channels.includes('webhook') && (
                        <span className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded" title={rule.webhook_url}>
                          <Webhook className="h-3 w-3" />
                        </span>
                      )}
                      {rule.notification_channels.includes('email') && (
                        <span className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded" title={rule.email}>
                          <Mail className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {expandedRule === rule._id && (
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                    {/* Notification details */}
                    {rule.notification_channels && rule.notification_channels.length > 0 && (
                      <div className="text-xs text-slate-400 space-y-1">
                        <p className="text-slate-500 font-medium">Notifications:</p>
                        {rule.notification_channels.includes('webhook') && rule.webhook_url && (
                          <p className="flex items-center gap-2">
                            <Webhook className="h-3 w-3" />
                            <span className="font-mono truncate max-w-xs">{rule.webhook_url}</span>
                          </p>
                        )}
                        {rule.notification_channels.includes('email') && rule.email && (
                          <p className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            <span>{rule.email}</span>
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        Created: {new Date(rule.created_at).toLocaleString()}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteRule(rule._id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Alert History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Recent Alerts
          </h2>
          {historyStats && historyStats.unacknowledged > 0 && (
            <Badge variant="destructive">
              {historyStats.unacknowledged} unacknowledged
            </Badge>
          )}
        </div>
        {history.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="py-8 text-center text-slate-400">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No alerts triggered yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((alert) => (
              <Card key={alert._id} className={`bg-slate-900/50 ${alert.acknowledged ? 'border-slate-700 opacity-60' : 'border-orange-500/30'}`}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      <div>
                        <div className="font-medium text-white">{alert.rule_name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(alert.triggered_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-400 space-x-2">
                        {alert.conditions_met.map((c, i) => (
                          <span key={i} className="bg-slate-800 px-2 py-1 rounded font-mono">
                            {c.metric}: {formatMetricValue(c.metric, c.actual_value)}
                          </span>
                        ))}
                      </div>
                      {!alert.acknowledged && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => acknowledgeAlert(alert._id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Ack
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-500 pt-4">
        <p>Alert rules are checked against real-time data. Use the &quot;Check Now&quot; button to force an immediate evaluation.</p>
      </div>
    </div>
  );
}
