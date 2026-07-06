import React from 'react';
import { Calendar, AlignLeft, MessageSquare } from 'lucide-react';

export default function TaskCard({ task, onClick, onDragStart, commentCount = 0 }) {
  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return 'badge-high';
      case 'medium': return 'badge-medium';
      case 'low': return 'badge-low';
      default: return 'badge-medium';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleDragStart = (e) => {
    if (onDragStart) {
      onDragStart(e, task.id);
    }
  };

  return (
    <div
      className="glass"
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      style={{
        padding: '16px',
        marginBottom: '12px',
        cursor: 'grab',
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'rgba(255, 255, 255, 0.02)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.boxShadow = 'var(--card-shadow)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <span className={`badge ${getPriorityClass(task.priority)}`} style={{ fontSize: '0.65rem' }}>
          {task.priority}
        </span>
        {task.assignee_name && (
          <div
            title={`Assigned to ${task.assignee_name}`}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textTransform: 'uppercase',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}
          >
            {task.assignee_name.substring(0, 2)}
          </div>
        )}
      </div>

      <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#f8fafc', lineHeight: '1.4' }}>
        {task.title}
      </h4>

      {task.description && (
        <p style={{ 
          fontSize: '0.8rem', 
          color: '#94a3b8', 
          lineHeight: '1.4',
          display: '-webkit-box', 
          WebkitLineClamp: 2, 
          WebkitBoxOrient: 'vertical', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis' 
        }}>
          {task.description}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#64748b' }}>
          {task.due_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94a3b8' }}>
              <Calendar size={12} />
              <span>{formatDate(task.due_date)}</span>
            </div>
          )}
          {task.description && (
            <AlignLeft size={12} title="This task has a description" />
          )}
        </div>
        
        {commentCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94a3b8' }}>
            <MessageSquare size={12} />
            <span>{commentCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}
