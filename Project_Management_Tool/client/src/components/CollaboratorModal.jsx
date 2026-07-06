import React, { useState } from 'react';
import { X, UserPlus, Users } from 'lucide-react';

export default function CollaboratorModal({ isOpen, onClose, projectId, token, onAddMember, currentMembers = [] }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: username.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add collaborator');
      }

      setSuccess(`Added @${username} successfully!`);
      setUsername('');
      if (onAddMember) {
        onAddMember(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass" style={{ width: '100%', maxWidth: '480px', padding: '32px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, color: '#94a3b8' }} className="btn-text">
          <X size={20} />
        </button>

        <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={24} style={{ color: '#a855f7' }} />
          Add Collaborator
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '24px' }}>
          Invite team members to collaborate on this project board.
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#a7f3d0', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flexGrow: 1 }}>
              <input
                type="text"
                placeholder="Enter exact username (e.g. bob)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ padding: '0 20px' }}>
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>

        <h4 style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
          <Users size={18} />
          Current Members ({currentMembers.length})
        </h4>
        <div style={{ maxHeight: '160px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 0', border: '1px solid rgba(255,255,255,0.05)' }}>
          {currentMembers.map((member) => (
            <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>@{member.username}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{member.email}</div>
              </div>
              <div className="badge" style={{ fontSize: '0.65rem', background: member.role === 'owner' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)', color: member.role === 'owner' ? '#a855f7' : '#94a3b8', border: '1px solid rgba(255,255,255,0.05)' }}>
                {member.role}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
