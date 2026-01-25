'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Shield,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  LogOut,
  Sparkles,
  User,
  Building,
  Mail,
  FileText,
  RefreshCw,
  Send,
  Copy,
  Check,
  Download,
  Plus,
  Link2,
  Activity,
  Trash2,
} from 'lucide-react';
import { ActivityFeed } from '@/components/admin/ActivityFeed';
import { ActivitySummary } from '@/components/admin/ActivitySummary';
import { UserActivityModal } from '@/components/admin/UserActivityModal';

interface AccessRequest {
  _id: string;
  email: string;
  name: string;
  company: string;
  use_case: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface User {
  _id: string;
  email: string;
  name: string;
  company: string;
  role: 'user' | 'user_ai';
  created_at: string;
  last_login: string;
}

interface Invite {
  _id: string;
  email: string;
  name: string;
  title: string;
  organization: string;
  inviteCode: string;
  status: 'pending' | 'sent' | 'accepted' | 'expired';
  channel: 'email' | 'linkedin';
  notes: string;
  createdAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
  expiresAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'invites' | 'activity'>('requests');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [inviteStatusFilter, setInviteStatusFilter] = useState<'all' | 'pending' | 'sent' | 'accepted' | 'expired'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    title: '',
    organization: '',
    email: '',
    notes: '',
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`/api/admin/requests?status=${statusFilter}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        throw new Error(data.error);
      }

      setRequests(data.requests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        throw new Error(data.error);
      }

      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchInvites = async () => {
    try {
      const response = await fetch(`/api/admin/invites?status=${inviteStatusFilter}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        throw new Error(data.error);
      }

      setInvites(data.invites);
    } catch (error) {
      console.error('Error fetching invites:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchRequests(), fetchUsers(), fetchInvites()]);
      setLoading(false);
    };
    fetchData();
  }, [statusFilter, inviteStatusFilter]);

  const handleApprove = async (id: string, withAI: boolean = false) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: withAI ? 'user_ai' : 'user' }),
      });

      if (response.ok) {
        await Promise.all([fetchRequests(), fetchUsers()]);
      }
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/requests/${id}/reject`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchRequests();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this access request?')) return;

    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/requests/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRequests(requests.filter(r => r._id !== id));
      }
    } catch (error) {
      console.error('Error deleting request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAI = async (userId: string, currentRole: string) => {
    setActionLoading(userId);
    try {
      const newRole = currentRole === 'user_ai' ? 'user' : 'user_ai';
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Error toggling AI access:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user? They will lose all access.')) return;

    setActionLoading(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setUsers(users.filter(u => u._id !== userId));
      }
    } catch (error) {
      console.error('Error removing user:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('create-invite');
    try {
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      if (response.ok) {
        await fetchInvites();
        setInviteForm({ name: '', title: '', organization: '', email: '', notes: '' });
        setShowInviteForm(false);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create invite');
      }
    } catch (error) {
      console.error('Error creating invite:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendInviteEmail = async (inviteId: string) => {
    setActionLoading(inviteId);
    try {
      const response = await fetch(`/api/admin/invites/${inviteId}/send`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchInvites();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Error sending invite:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyLinkedIn = async (invite: Invite) => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.tswi-ai.com';
    const inviteUrl = `${appUrl}/invite/${invite.inviteCode}`;
    const message = `${invite.name} - You've been granted early access to TSWI (Tactical Space Weather Intelligence). Real-time space weather monitoring for satellite operations. ${inviteUrl}`;

    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(invite._id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Title', 'Organization', 'Email', 'Status', 'Created', 'Sent', 'Accepted'];
    const rows = invites.map(inv => [
      inv.name,
      inv.title || '',
      inv.organization,
      inv.email,
      inv.status,
      new Date(inv.createdAt).toLocaleString(),
      inv.sentAt ? new Date(inv.sentAt).toLocaleString() : '',
      inv.acceptedAt ? new Date(inv.acceptedAt).toLocaleString() : '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tswi-invites-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const pendingInvitesCount = invites.filter((i) => i.status === 'pending' || i.status === 'sent').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-amber-400" />
            <div>
              <h1 className="text-xl font-bold text-white">TSWI Admin</h1>
              <p className="text-sm text-slate-400">Access Management</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-slate-700 bg-slate-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Pending Requests</p>
                  <p className="text-3xl font-bold text-amber-400">{pendingCount}</p>
                </div>
                <Clock className="h-10 w-10 text-amber-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Users</p>
                  <p className="text-3xl font-bold text-green-400">{users.length}</p>
                </div>
                <Users className="h-10 w-10 text-green-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">AI Access Users</p>
                  <p className="text-3xl font-bold text-purple-400">
                    {users.filter((u) => u.role === 'user_ai').length}
                  </p>
                </div>
                <Sparkles className="h-10 w-10 text-purple-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Active Invites</p>
                  <p className="text-3xl font-bold text-blue-400">{pendingInvitesCount}</p>
                </div>
                <Send className="h-10 w-10 text-blue-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <Button
            variant={activeTab === 'requests' ? 'default' : 'outline'}
            onClick={() => setActiveTab('requests')}
            className={activeTab === 'requests' ? 'bg-blue-600' : 'border-slate-600 text-slate-300'}
          >
            <Clock className="h-4 w-4 mr-2" />
            Access Requests
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-amber-500 text-black rounded-full">
                {pendingCount}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'outline'}
            onClick={() => setActiveTab('users')}
            className={activeTab === 'users' ? 'bg-blue-600' : 'border-slate-600 text-slate-300'}
          >
            <Users className="h-4 w-4 mr-2" />
            Manage Users
          </Button>
          <Button
            variant={activeTab === 'invites' ? 'default' : 'outline'}
            onClick={() => setActiveTab('invites')}
            className={activeTab === 'invites' ? 'bg-blue-600' : 'border-slate-600 text-slate-300'}
          >
            <Send className="h-4 w-4 mr-2" />
            Invites
            {pendingInvitesCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                {pendingInvitesCount}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === 'activity' ? 'default' : 'outline'}
            onClick={() => setActiveTab('activity')}
            className={activeTab === 'activity' ? 'bg-blue-600' : 'border-slate-600 text-slate-300'}
          >
            <Activity className="h-4 w-4 mr-2" />
            Activity
          </Button>
        </div>

        {/* Content */}
        {activeTab === 'requests' && (
          <Card className="border-slate-700 bg-slate-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Access Requests</CardTitle>
                  <CardDescription className="text-slate-400">
                    Review and approve user access requests
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="all">All</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchRequests()}
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
              ) : requests.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No requests found</div>
              ) : (
                <div className="space-y-4">
                  {requests.map((request) => (
                    <div
                      key={request._id}
                      className="border border-slate-700 rounded-lg p-4 bg-slate-800/30"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-white">{request.name}</span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                request.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : request.status === 'approved'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {request.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Mail className="h-4 w-4" />
                            {request.email}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Building className="h-4 w-4" />
                            {request.company}
                          </div>
                          <div className="flex items-start gap-2 text-sm text-slate-400">
                            <FileText className="h-4 w-4 mt-0.5" />
                            <span className="line-clamp-2">{request.use_case}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            Submitted: {new Date(request.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          {request.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(request._id, false)}
                                disabled={actionLoading === request._id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(request._id, true)}
                                disabled={actionLoading === request._id}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                <Sparkles className="h-4 w-4 mr-1" />
                                Approve + AI
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(request._id)}
                                disabled={actionLoading === request._id}
                                className="border-red-600 text-red-400 hover:bg-red-600/20"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteRequest(request._id)}
                            disabled={actionLoading === request._id}
                            className="border-red-600 text-red-400 hover:bg-red-600/20"
                            title="Delete request"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'users' && (
          <Card className="border-slate-700 bg-slate-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Manage Users</CardTitle>
                  <CardDescription className="text-slate-400">
                    View and manage user access levels
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchUsers()}
                  className="border-slate-600 text-slate-300"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-400">Loading...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No users found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                          User
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                          Company
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                          Role
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                          Last Login
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user._id} className="border-b border-slate-800">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-white">{user.name}</p>
                              <p className="text-sm text-slate-400">{user.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{user.company}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                user.role === 'user_ai'
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}
                            >
                              {user.role === 'user_ai' ? 'AI Access' : 'Basic'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-400">
                            {new Date(user.last_login).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleAI(user._id, user.role)}
                                disabled={actionLoading === user._id}
                                className={
                                  user.role === 'user_ai'
                                    ? 'border-blue-600 text-blue-400'
                                    : 'border-purple-600 text-purple-400'
                                }
                              >
                                <Sparkles className="h-4 w-4 mr-1" />
                                {user.role === 'user_ai' ? 'Remove AI' : 'Add AI'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveUser(user._id)}
                                disabled={actionLoading === user._id}
                                className="border-red-600 text-red-400 hover:bg-red-600/20"
                                title="Remove user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'invites' && (
          <div className="space-y-6">
            {/* Create Invite Form */}
            <Card className="border-slate-700 bg-slate-900/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Create Invite</CardTitle>
                    <CardDescription className="text-slate-400">
                      Send invitations to specific individuals
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInviteForm(!showInviteForm)}
                    className="border-slate-600 text-slate-300"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {showInviteForm ? 'Cancel' : 'New Invite'}
                  </Button>
                </div>
              </CardHeader>
              {showInviteForm && (
                <CardContent>
                  <form onSubmit={handleCreateInvite} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-slate-300">Name *</Label>
                        <Input
                          id="name"
                          value={inviteForm.name}
                          onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                          placeholder="Gen. John Smith"
                          required
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="title" className="text-slate-300">Title</Label>
                        <Input
                          id="title"
                          value={inviteForm.title}
                          onChange={(e) => setInviteForm({ ...inviteForm, title: e.target.value })}
                          placeholder="Commanding General"
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="organization" className="text-slate-300">Organization *</Label>
                        <Input
                          id="organization"
                          value={inviteForm.organization}
                          onChange={(e) => setInviteForm({ ...inviteForm, organization: e.target.value })}
                          placeholder="U.S. Space Force"
                          required
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-300">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                          placeholder="john.smith@spaceforce.mil"
                          required
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-slate-300">Notes (internal)</Label>
                      <Input
                        id="notes"
                        value={inviteForm.notes}
                        onChange={(e) => setInviteForm({ ...inviteForm, notes: e.target.value })}
                        placeholder="Met at conference, interested in CME tracking"
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={actionLoading === 'create-invite'}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Invite
                    </Button>
                  </form>
                </CardContent>
              )}
            </Card>

            {/* Invites List */}
            <Card className="border-slate-700 bg-slate-900/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Invitations</CardTitle>
                    <CardDescription className="text-slate-400">
                      Manage and track invitation status
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={inviteStatusFilter}
                      onChange={(e) => setInviteStatusFilter(e.target.value as typeof inviteStatusFilter)}
                      className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
                    >
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="sent">Sent</option>
                      <option value="accepted">Accepted</option>
                      <option value="expired">Expired</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      className="border-slate-600 text-slate-300"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchInvites()}
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
                ) : invites.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No invites found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Recipient
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Organization
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Created
                          </th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {invites.map((invite) => (
                          <tr key={invite._id} className="border-b border-slate-800">
                            <td className="py-3 px-4">
                              <div>
                                <p className="font-medium text-white">{invite.name}</p>
                                {invite.title && (
                                  <p className="text-xs text-slate-500">{invite.title}</p>
                                )}
                                <p className="text-sm text-slate-400">{invite.email}</p>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-300">{invite.organization}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  invite.status === 'pending'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : invite.status === 'sent'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : invite.status === 'accepted'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {invite.status}
                              </span>
                              {invite.notes && (
                                <p className="text-xs text-slate-500 mt-1 max-w-[150px] truncate" title={invite.notes}>
                                  {invite.notes}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-400">
                              {new Date(invite.createdAt).toLocaleDateString()}
                              {invite.sentAt && (
                                <p className="text-xs text-slate-500">
                                  Sent: {new Date(invite.sentAt).toLocaleDateString()}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex justify-end gap-2">
                                {(invite.status === 'pending' || invite.status === 'sent') && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSendInviteEmail(invite._id)}
                                      disabled={actionLoading === invite._id}
                                      className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
                                    >
                                      <Mail className="h-4 w-4 mr-1" />
                                      {invite.status === 'sent' ? 'Resend' : 'Send Email'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCopyLinkedIn(invite)}
                                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                    >
                                      {copiedId === invite._id ? (
                                        <>
                                          <Check className="h-4 w-4 mr-1 text-green-400" />
                                          Copied
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-4 w-4 mr-1" />
                                          LinkedIn
                                        </>
                                      )}
                                    </Button>
                                  </>
                                )}
                                {invite.status === 'accepted' && (
                                  <span className="text-green-400 flex items-center gap-1 text-sm">
                                    <CheckCircle className="h-4 w-4" />
                                    Registered
                                  </span>
                                )}
                                {invite.status === 'expired' && (
                                  <span className="text-red-400 text-sm">Expired</span>
                                )}
                              </div>
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
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6">
            <ActivitySummary onUserClick={(userId) => setSelectedUserId(userId)} />
            <ActivityFeed autoRefresh={true} />
          </div>
        )}
      </main>

      {/* User Activity Modal */}
      {selectedUserId && (
        <UserActivityModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
