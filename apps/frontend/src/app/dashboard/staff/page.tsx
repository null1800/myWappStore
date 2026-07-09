'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Trash2, RotateCcw, Clock, Loader2, Users, MailX } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface StaffUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { fullName: string | null; email: string };
}

export default function StaffPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/staff');
      setUsers(data.data.users ?? []);
      setInvitations(data.data.pendingInvitations ?? []);
    } catch {
      toast.error('Failed to load staff members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post('/staff/invite', { email: inviteEmail, role: 'STAFF' });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const deactivate = async (userId: string, email: string) => {
    if (!confirm(`Deactivate ${email}? They will be signed out immediately.`)) return;
    try {
      await api.delete(`/staff/${userId}`);
      toast.success(`${email} has been deactivated.`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to deactivate.');
    }
  };

  const reactivate = async (userId: string, email: string) => {
    try {
      await api.post(`/staff/${userId}/reactivate`);
      toast.success(`${email} has been reactivated.`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to reactivate.');
    }
  };

  const revokeInvite = async (id: string, email: string) => {
    try {
      await api.delete(`/staff/invitations/${id}`);
      toast.success(`Invitation for ${email} revoked.`);
      load();
    } catch {
      toast.error('Failed to revoke invitation.');
    }
  };

  const roleBadge = (role: string) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      role === 'OWNER'
        ? 'bg-purple-100 text-purple-700'
        : 'bg-blue-100 text-blue-700'
    }`}>
      {role}
    </span>
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Staff Management</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Invite team members and manage their access.
        </p>
      </div>

      {/* Invite form */}
      <div className="card p-5">
        <h2 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[var(--brand)]" />
          Invite a Staff Member
        </h2>
        <form onSubmit={sendInvite} className="flex gap-3">
          <input
            type="email"
            className="input flex-1"
            placeholder="email@example.com"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button type="submit" disabled={inviting} className="btn-primary px-5 py-2 flex items-center gap-2 shrink-0">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Send Invite
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" /></div>
      ) : (
        <>
          {/* Current team */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--brand)]" />
                Team ({users.length})
              </h2>
            </div>
            {users.length === 0 ? (
              <p className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">No team members yet.</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {users.map((u) => (
                  <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {u.fullName ?? u.email}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {roleBadge(u.role)}
                      {!u.isActive && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Inactive</span>
                      )}
                      {u.role !== 'OWNER' && (
                        u.isActive ? (
                          <button
                            onClick={() => deactivate(u.id, u.email)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivate(u.id, u.email)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Reactivate"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Pending Invitations ({invitations.length})
                </h2>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {invitations.map((inv) => (
                  <div key={inv.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{inv.email}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Invited by {inv.invitedBy.fullName ?? inv.invitedBy.email} ·{' '}
                        expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeInvite(inv.id, inv.email)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Revoke invitation"
                    >
                      <MailX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
