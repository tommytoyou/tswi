import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AlertsPage() {
  // TODO: Fetch alerts from API
  const mockAlerts = [
    {
      id: '1',
      name: 'Storm Watch',
      conditions: 'Bz < -5 nT, Speed > 550 km/s',
      status: 'active' as const,
      lastTriggered: new Date('2025-11-01T08:30:00Z'),
    },
    {
      id: '2',
      name: 'HF Caution',
      conditions: 'Kp >= 5',
      status: 'active' as const,
      lastTriggered: null,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Alert Rules</h1>
          <p className="text-slate-400 mt-1">Manage custom space weather alerts</p>
        </div>
        <Button>+ New Alert</Button>
      </div>

      {/* Alert Rules List */}
      <div className="space-y-4">
        {mockAlerts.map((alert) => (
          <Card key={alert.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{alert.name}</CardTitle>
                  <CardDescription className="mt-2">
                    {alert.conditions}
                  </CardDescription>
                </div>
                <Badge variant={alert.status === 'active' ? 'default' : 'secondary'}>
                  {alert.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  {alert.lastTriggered
                    ? `Last triggered: ${alert.lastTriggered.toLocaleString()}`
                    : 'Never triggered'}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Test</Button>
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button variant="destructive" size="sm">Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TODO: Add alert creation modal */}
      {/* TODO: Add evidence drawer for triggered alerts */}
      {/* TODO: Add alert history timeline */}
    </div>
  );
}
