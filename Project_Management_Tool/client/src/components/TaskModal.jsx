import React, { useState, useEffect } from 'react';
import { X, Calendar, User, MessageSquare, AlignLeft, Trash2, Send } from 'lucide-react';

export default function TaskModal({ isOpen, onClose, task, projectId, token, projectMembers = [], onUpdateTask, onDeleteTask, wsComments = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(task.priority || 'medium');
      setAssignedTo(task.assigned_to || '');
      setDueDate(task.due_date || '');
      fetchComments();
    }
  }, [task]);

  // Sync WebSocket comments when they arrive from parent
  useEffect(() => {
    if (wsComments && wsComments.length > 0 && task) {
      const matchingComments = wsComments.filter(c => Number(c.task_id) === Number(task.id));
      if (matchingComments.length > 0) {
        setComments(prev => {
          // Avoid duplicate comments
          const prevIds = new Set(prev.map(c => c.id));
          const newOnes = matchingComments.filter(c => !prevIds.has(c.id));
          return [...prev, ...newOnes];
        });
      }
    }
  }, [wsComments, task]);

  if (!isOpen || !task) return null;

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const response = await fetch(`http://localhost:5000/api/comments/task/${task.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleUpdateField = async (fieldName, value) => {
    try {
      const updatedValues = {
        title: fieldName === 'title' ? value : title,
        description: fieldName === 'description' ? value : description,
        status: fieldName === 'status' ? value : status,
        priority: fieldName === 'priority' ? value : priority,
        assigned_to: fieldName === 'assigned_to' ? (value ? Number(value) : null) : (assignedTo ? Number(assignedTo) : null),
        due_date: fieldName === 'due_date' ? (value || null) : (dueDate || null)
      };

      const response = await fetch(`http://localhost:5000/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedValues)
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      const data = await response.json();
      if (onUpdateTask) {
        onUpdateTask(data);
      }
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`http://localhost:5000/api/comments/task/${task.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newComment.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [...prev, data]);
        setNewComment('');
        
        // Notify parent of update to refresh comment indicators on card
        if (onUpdateTask) {
          onUpdateTask({ ...task, comments_count: (task.comments_count || 0) + 1 });
        }
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        if (onDeleteTask) {
          onDeleteTask(task.id);
        }
        onClose();
      }
    } catch (err) {
      console.error('Delete task error:', err);
    }
  };

  const formatTime = (timeStr) => {
    const d = new Date(timeStr);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass" style={{
        width: '100%', maxWidth: '800px', height: '90vh', maxHeight: '720px',
        padding: '32px', display: 'flex', flexDirection: 'column', position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ flexGrow: 1, paddingRight: '40px' }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => handleUpdateField('title', e.target.value)}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                fontSize: '1.6rem',
                fontWeight: '700',
                padding: '4px 8px',
                color: '#fff',
                width: '100%',
                borderRadius: '4px'
              }}
              onFocus={(e) => e.target.style.border = '1px solid var(--border-color)'}
              onBlurCapture={(e) => e.target.style.border = '1px solid transparent'}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={handleDelete} className="btn-danger" style={{ padding: '8px 12px' }} title="Delete Task">
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="btn-text" style={{ color: '#94a3b8' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Two-Column Scrollable Area */}
        <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', gap: '32px' }}>
          {/* Left Column: Details & Comments */}
          <div style={{ flex: '5', display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: '8px' }}>
            
            {/* Description */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                <AlignLeft size={16} /> Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={(e) => handleUpdateField('description', e.target.value)}
                placeholder="Add a detailed description for this task..."
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  minHeight: '100px',
                  resize: 'vertical',
                  fontSize: '0.9rem',
                  lineHeight: '1.5'
                }}
              />
            </div>

            {/* Comments Area */}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '16px' }}>
                <MessageSquare size={16} style={{ color: '#a855f7' }} /> Comments
              </h4>

              {/* Add Comment */}
              <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.2)', fontSize: '0.85rem' }}
                />
                <button className="btn-primary" type="submit" style={{ padding: '0 16px' }}>
                  <Send size={14} />
                </button>
              </form>

              {/* Comments Thread */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1, paddingBottom: '16px' }}>
                {loadingComments ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>No comments yet. Start the conversation!</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#c084fc' }}>@{c.author_name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatTime(c.created_at)}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4', wordBreak: 'break-word' }}>{c.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Attributes */}
          <div style={{ flex: '3', display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '24px' }}>
            
            {/* Status Selection */}
            <div>
              <label htmlFor="task-status">Status</label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  handleUpdateField('status', e.target.value);
                }}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Priority Selection */}
            <div>
              <label htmlFor="task-priority">Priority</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  handleUpdateField('priority', e.target.value);
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Assignee Selection */}
            <div>
              <label htmlFor="task-assignee" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> Assignee
              </label>
              <select
                id="task-assignee"
                value={assignedTo}
                onChange={(e) => {
                  setAssignedTo(e.target.value);
                  handleUpdateField('assigned_to', e.target.value);
                }}
              >
                <option value="">Unassigned</option>
                {projectMembers.map(m => (
                  <option key={m.id} value={m.id}>@{m.username}</option>
                ))}
              </select>
            </div>

            {/* Due Date Selection */}
            <div>
              <label htmlFor="task-due-date" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} /> Due Date
              </label>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  handleUpdateField('due_date', e.target.value);
                }}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
