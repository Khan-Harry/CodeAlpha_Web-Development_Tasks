import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import TaskCard from './TaskCard.jsx';

export default function BoardColumn({ title, status, tasks = [], onAddTask, onCardClick, onDragStart, onDropCard, commentsCountMap = {} }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const getStatusColor = (colStatus) => {
    switch (colStatus) {
      case 'todo': return 'var(--status-todo)';
      case 'in_progress': return 'var(--status-inprogress)';
      case 'review': return 'var(--status-review)';
      case 'done': return 'var(--status-done)';
      default: return 'var(--primary)';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && onDropCard) {
      onDropCard(Number(taskId), status);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        flex: 1,
        minWidth: '280px',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isDragOver ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.01)',
        borderRadius: '12px',
        border: isDragOver ? '1px dashed var(--primary)' : '1px solid rgba(255, 255, 255, 0.03)',
        padding: '16px',
        transition: 'all 0.2s ease',
        overflow: 'hidden'
      }}
    >
      {/* Column Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(status)
          }} />
          <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>{title}</h3>
        </div>
        <span style={{
          fontSize: '0.75rem',
          color: '#64748b',
          background: 'rgba(255,255,255,0.05)',
          padding: '2px 8px',
          borderRadius: '10px',
          fontWeight: '600'
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Column Card List */}
      <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '12px' }}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            commentCount={commentsCountMap[task.id] || 0}
            onClick={() => onCardClick(task)}
            onDragStart={onDragStart}
          />
        ))}
        {tasks.length === 0 && (
          <div style={{
            height: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            color: '#64748b',
            fontSize: '0.8rem',
            userSelect: 'none'
          }}>
            Drop tasks here
          </div>
        )}
      </div>

      {/* Add Task Trigger */}
      <button
        onClick={() => onAddTask(status)}
        style={{
          width: '100%',
          padding: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          color: '#94a3b8',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#94a3b8';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.03)';
        }}
      >
        <Plus size={16} />
        Add Task
      </button>
    </div>
  );
}
