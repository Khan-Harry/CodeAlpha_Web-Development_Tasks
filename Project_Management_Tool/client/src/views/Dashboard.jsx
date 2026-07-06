import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, LogOut, Bell, Check, Folder, Calendar } from 'lucide-react';

export default function Dashboard({ user, token, logout, notifications, setNotifications }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const response = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newProjectName.trim(), description: newProjectDesc.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(prev => [data, ...prev]);
        setNewProjectName('');
        setNewProjectDesc('');
        setShowCreateModal(false);
      }
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  const markAllNotifsRead = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/notifications/read', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      }
    } catch (err) {
      console.error('Error reading notifications:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Navigation Header */}
      <header className="glass" style={{
        height: '70px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        margin: '20px 40px 10px 40px',
        borderRadius: '12px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)'
          }} />
          <h1 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Alpha Board</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Notifications Trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="btn-text"
              style={{ padding: '8px', borderRadius: '50%', color: showNotifPanel ? '#fff' : '#94a3b8' }}
            >
              <Bell size={20} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            {/* Notification Panel dropdown */}
            {showNotifPanel && (
              <div className="glass notification-panel" style={{
                position: 'absolute', top: '45px', right: 0, width: '320px',
                maxHeight: '400px', overflowY: 'auto', zIndex: 1000, padding: '16px',
                background: 'rgba(15, 10, 30, 0.95)', border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.9rem' }}>Notifications</h4>
                  {unreadCount > 0 && (
                    <button onClick={markAllNotifsRead} style={{ fontSize: '0.75rem', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '2px' }} className="btn-text">
                      <Check size={12} /> Mark all read
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {notifications.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>No notifications yet</p>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`notification-item ${!n.is_read ? 'unread' : ''}`} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <p style={{ fontSize: '0.8rem', margin: 0 }}>{n.content}</p>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                          {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#cbd5e1' }}>@{user.username}</span>
            <button onClick={logout} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <main style={{ flexGrow: 1, padding: '20px 40px 40px 40px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '2rem', marginBottom: '4px' }}>Projects</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Select a project board to begin collaborating.</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <FolderPlus size={16} /> New Project
          </button>
        </div>

        {/* Project List Grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
            <p style={{ color: '#94a3b8' }}>Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 40px', textAlign: 'center', marginTop: '20px' }}>
            <Folder size={48} style={{ color: '#64748b', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No projects yet</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '360px', marginBottom: '24px' }}>
              Create your first group project to start assigning tasks and communicating.
            </p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Create Project
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {projects.map(project => (
              <div
                key={project.id}
                className="glass"
                onClick={() => navigate(`/project/${project.id}`)}
                style={{
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.25)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.boxShadow = 'var(--card-shadow)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '1.2rem', color: '#fff', fontWeight: '700' }}>{project.name}</h3>
                  <span className="badge" style={{
                    fontSize: '0.65rem',
                    background: project.role === 'owner' ? 'rgba(168,85,247,0.15)' : 'rgba(99,102,241,0.15)',
                    color: project.role === 'owner' ? '#a855f7' : '#6366f1'
                  }}>
                    {project.role}
                  </span>
                </div>
                
                <p style={{
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  marginBottom: '20px',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  minHeight: '57px'
                }}>
                  {project.description || 'No description provided.'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                  <Calendar size={12} />
                  <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '480px', padding: '32px', position: 'relative' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>New Group Project</h3>
            <form onSubmit={handleCreateProject}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="project-name">Project Name</label>
                <input
                  id="project-name"
                  type="text"
                  placeholder="e.g. Website Redesign"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '28px' }}>
                <label htmlFor="project-desc">Description</label>
                <textarea
                  id="project-desc"
                  placeholder="Briefly describe the project goals..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
