'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '../../lib/api-client';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  Server,
  Globe,
  User,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Layers
} from 'lucide-react';

interface PendingTunnel {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  localTargetPort: number;
  localTargetHost: string;
  protocol: string;
  status: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  approvedAt?: string;
  rejectionReason?: string;
}

import { useRouter } from 'next/navigation';

export default function AdminApprovalsPage() {
  const router = useRouter();
  const [tunnels, setTunnels] = useState<PendingTunnel[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAdminLogout = () => {
    localStorage.removeItem('turnal_admin_token');
    localStorage.removeItem('turnal_admin_user');
    router.push('/admin/login');
  };

  const getAdminAuthHeaders = () => {
    const adminToken =
      localStorage.getItem('turnal_admin_token') ||
      localStorage.getItem('turnal_token') ||
      'admin_master_super_secret_token_turnal';
    return { Authorization: `Bearer ${adminToken}` };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = getAdminAuthHeaders();
      const [tunnelsRes, statsRes] = await Promise.all([
        fetchApi('/api/admin/tunnels/pending', { headers }),
        fetchApi('/api/admin/stats', { headers })
      ]);

      if (tunnelsRes.error?.code === 'FORBIDDEN' || tunnelsRes.error?.code === 'UNAUTHORIZED') {
        router.push('/admin/login');
        return;
      }

      if (tunnelsRes.success && tunnelsRes.data) {
        setTunnels(tunnelsRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    setFeedbackMessage(null);
    try {
      const res = await fetchApi(`/api/admin/tunnels/${id}/approve`, {
        method: 'POST',
        headers: getAdminAuthHeaders()
      });
      if (res.success) {
        setFeedbackMessage({ type: 'success', text: (res as any).message || 'Tunnel successfully approved & SSL activated!' });
        loadData();
      } else {
        setFeedbackMessage({ type: 'error', text: res.error?.message || 'Failed to approve tunnel' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason (optional):', 'Port or domain policy restricted');
    if (reason === null) return; // cancelled

    setActionLoading(id);
    setFeedbackMessage(null);
    try {
      const res = await fetchApi(`/api/admin/tunnels/${id}/reject`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ reason })
      });
      if (res.success) {
        setFeedbackMessage({ type: 'success', text: 'Tunnel rejected successfully.' });
        loadData();
      } else {
        setFeedbackMessage({ type: 'error', text: res.error?.message || 'Failed to reject tunnel' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchDecision = async (action: 'APPROVE' | 'REJECT') => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setFeedbackMessage(null);
    try {
      const decisions = selectedIds.map(id => ({ tunnelId: id, action }));
      const res = await fetchApi('/api/admin/tunnels/batch-decision', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ decisions })
      });
      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: `Successfully ${action === 'APPROVE' ? 'approved' : 'rejected'} ${selectedIds.length} tunnel requests!`
        });
        setSelectedIds([]);
        loadData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredTunnels = tunnels.filter(t => {
    if (filter === 'PENDING') return t.status === 'PENDING_APPROVAL' || t.status === 'OFFLINE';
    if (filter === 'APPROVED') return t.status === 'ONLINE';
    if (filter === 'REJECTED') return t.status === 'REJECTED';
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === filteredTunnels.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTunnels.map(t => t.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              Admin Control Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tunnel & Port Approvals</h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Inspect incoming client tunnel requests across multiple local ports. Grant selective approval, issue instant SSL routing, or reject unwanted port forwards.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleAdminLogout}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
            >
              <User className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-medium">Total Tunnels</div>
            <div className="text-2xl font-bold text-white mt-1">{stats?.totalTunnels ?? tunnels.length}</div>
          </div>
          <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-4">
            <div className="text-xs text-emerald-400 font-medium">Active & Approved</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">
              {stats?.activeTunnelsCount ?? tunnels.filter(t => t.status === 'ONLINE').length}
            </div>
          </div>
          <div className="bg-amber-950/40 border border-amber-800/40 rounded-2xl p-4">
            <div className="text-xs text-amber-400 font-medium">Pending Approvals</div>
            <div className="text-2xl font-bold text-amber-300 mt-1">
              {tunnels.filter(t => t.status === 'PENDING_APPROVAL' || t.status === 'OFFLINE').length}
            </div>
          </div>
          <div className="bg-rose-950/40 border border-rose-800/40 rounded-2xl p-4">
            <div className="text-xs text-rose-400 font-medium">Rejected Tunnels</div>
            <div className="text-2xl font-bold text-rose-300 mt-1">
              {stats?.rejectedTunnelsCount ?? tunnels.filter(t => t.status === 'REJECTED').length}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm animate-in fade-in duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Filter & Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'ALL' && 'All Requests'}
              {tab === 'PENDING' && 'Pending Approval'}
              {tab === 'APPROVED' && 'Approved / Online'}
              {tab === 'REJECTED' && 'Rejected'}
            </button>
          ))}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-semibold text-slate-500 mr-1">{selectedIds.length} Selected</span>
            <button
              onClick={() => handleBatchDecision('APPROVE')}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve Selected
            </button>
            <button
              onClick={() => handleBatchDecision('REJECT')}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject Selected
            </button>
          </div>
        )}
      </div>

      {/* Requests Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={selectedIds.length === filteredTunnels.length && filteredTunnels.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th className="p-4">User & Project</th>
                <th className="p-4">Local Target Port</th>
                <th className="p-4">Requested Domain / URL</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTunnels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No tunnel requests match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredTunnels.map(tunnel => {
                  const isPending = tunnel.status === 'PENDING_APPROVAL' || tunnel.status === 'OFFLINE';
                  const isApproved = tunnel.status === 'ONLINE';
                  const isRejected = tunnel.status === 'REJECTED';
                  const targetDomain = tunnel.customDomain || `${tunnel.subdomain}.skyranksolution.com`;

                  return (
                    <tr key={tunnel.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={selectedIds.includes(tunnel.id)}
                          onChange={() => toggleSelect(tunnel.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                            {tunnel.userName ? tunnel.userName[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{tunnel.name || tunnel.subdomain}</div>
                            <div className="text-xs text-slate-500">{tunnel.userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-800">
                          <Server className="w-3 h-3 text-slate-500" />
                          localhost:{tunnel.localTargetPort}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-900 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-indigo-600" />
                            https://{targetDomain}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Subdomain: {tunnel.subdomain}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Approved (Online)
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Approval
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {!isApproved && (
                          <button
                            disabled={actionLoading === tunnel.id}
                            onClick={() => handleApprove(tunnel.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {actionLoading === tunnel.id ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                        {!isRejected && (
                          <button
                            disabled={actionLoading === tunnel.id}
                            onClick={() => handleReject(tunnel.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 text-xs font-bold transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        )}
                        {isApproved && (
                          <a
                            href={`https://${targetDomain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Visit
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
