import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Trash2, AlertCircle } from 'lucide-react';
import BoardColumn from '../components/BoardColumn.jsx';
import TaskModal from '../components/TaskModal.jsx';
import CollaboratorModal from '../components/CollaboratorModal.jsx';

export default function Board({ token, user, registerWSListener, unregisterWSListener }) {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [showAddTaskInline, setShowAddTaskInline] = useState(null); // column status
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Track WebSocket comments for active details modal
  const [wsComments, setWsComments] = useState([]);

  useEffect(() => {
    fetchBoardData();

    // Register WebSocket message listener
    const handleWSMessage = (event) => {
      const { type, projectId: msgProjectId, data, taskId } = event;

      // Only handle messages matching this project
      if (Number(msgProjectId) !== Number(projectId)) return;

      switch (type) {
        case 'TASK_CREATED':
          setTasks(prev => {
            if (prev.some(t => t.id === data.id)) return prev;
            return [...prev, data];
          });
          break;
        case 'TASK_UPDATED':
          setTasks(prev => prev.map(t => t.id === data.id ? data : t));
          setSelectedTask(prev => (prev && prev.id === data.id) ? data : prev);
          break;
        case 'TASK_DELETED':
          setTasks(prev => prev.filter(t => t.id !== taskId));
          if (selectedTask && selectedTask.id === taskId) {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }
          break;
        case 'MEMBER_JOINED':
          setMembers(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
          break;
        case 'COMMENT_CREATED':
          setWsComments(prev => [...prev, data]);
          // Increment comment count on the task item
          setTasks(prev => prev.map(t => {
            if (t.id === Number(taskId)) {
              return { ...t, comments_count: (t.comments_count || 0) + 1 };
            }
            return t;
          }));
          break;
        case 'PROJECT_DELETED':
          alert('This project board has been deleted by the owner.');
          navigate('/');
          break;
        default:
          break;
      }
    };

    registerWSListener(handleWSMessage);

    return () => {
      unregisterWSListener(handleWSMessage);
    };
  }, [projectId, selectedTask, registerWSListener, unregisterWSListener, navigate]);

  const fetchBoardData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch project details
      const projRes = await fetch(`http://localhost:5000/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!projRes.ok) {
        if (projRes.status === 403) throw new Error('Access Denied. You are not a member of this project.');
        throw new Error('Project not found');
      }
      const projData = await projRes.json();
      setProject(projData);

      // 2. Fetch tasks
      const tasksRes = await fetch(`http://localhost:5000/api/tasks/project/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      }

      // 3. Fetch project members
      const membersRes = await fetch(`http://localhost:5000/api/projects/${projectId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const response = await fetch(`http://localhost:5000/api/tasks/project/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          status: showAddTaskInline,
          priority: 'medium'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(prev => [...prev, data]);
        setNewTaskTitle('');
        setShowAddTaskInline(null);
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDropCard = async (taskId, newStatus) => {
    const taskToMove = tasks.find(t => t.id === taskId);
    if (!taskToMove || taskToMove.status === newStatus) return;

    // Optimistic Update
    const oldTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }

      const data = await response.json();
      setTasks(prev => prev.map(t => t.id === taskId ? data : t));
    } catch (err) {
      console.error('Drag-and-drop save failed:', err);
      setTasks(oldTasks); // Revert state
    }
  };

  const handleUpdateTaskInState = (updatedTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    if (selectedTask && selectedTask.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
  };

  const handleDeleteTaskInState = (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('WARNING: Are you sure you want to delete this entire project? This action cannot be undone.')) return;

    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        navigate('/');
      }
    } catch (err) {
      console.error('Project deletion failed:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw' }}>
        <p style={{ color: '#94a3b8' }}>Loading project board...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', gap: '20px' }}>
        <AlertCircle size={40} style={{ color: 'var(--priority-high)' }} />
        <p style={{ color: '#fca5a5' }}>{error}</p>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const reviewTasks = tasks.filter(t => t.status === 'review');
  const doneTasks = tasks.filter(t => t.status === 'done');

  const commentsCountMap = tasks.reduce((acc, t) => {
    acc[t.id] = t.comments_count || 0;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* Top Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
          <button onClick={() => navigate('/')} className="btn-secondary" style={{ padding: '8px 12px', flexShrink: 0 }}>
            <ArrowLeft size={16} /> Dashboard
          </button>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '16px', overflow: 'hidden' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {project.name}
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {project.description || 'No project description.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Project Members Avatars */}
          <div style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
            {members.slice(0, 4).map((m, idx) => (
              <div
                key={m.id}
                title={`@${m.username}`}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                  border: '2px solid #0d0a21',
                  marginLeft: idx === 0 ? 0 : '-8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  zIndex: 4 - idx
                }}
              >
                {m.username.substring(0, 2)}
              </div>
            ))}
            {members.length > 4 && (
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#1e1b4b',
                border: '2px solid #0d0a21',
                color: '#fff',
                marginLeft: '-8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: '700',
                zIndex: 0
              }}>
                +{members.length - 4}
              </div>
            )}
          </div>

          <button onClick={() => setIsCollabModalOpen(true)} className="btn-secondary" style={{ padding: '8px 12px' }}>
            <UserPlus size={14} /> Add Member
          </button>

          {project.role === 'owner' && (
            <button onClick={handleDeleteProject} className="btn-danger" style={{ padding: '8px 12px' }} title="Delete Project Board">
              <Trash2 size={14} /> Delete Board
            </button>
          )}
        </div>
      </header>

      {/* Kanban Board Container */}
      <main style={{
        flexGrow: 1,
        padding: '10px 40px 40px 40px',
        display: 'flex',
        gap: '20px',
        overflowX: 'auto',
        alignItems: 'stretch'
      }}>
        <BoardColumn
          title="To Do"
          status="todo"
          tasks={todoTasks}
          commentsCountMap={commentsCountMap}
          onCardClick={(task) => { setSelectedTask(task); setIsTaskModalOpen(true); }}
          onDragStart={handleDragStart}
          onDropCard={handleDropCard}
          onAddTask={(col) => { setNewTaskTitle(''); setShowAddTaskInline(col); }}
        />
        <BoardColumn
          title="In Progress"
          status="in_progress"
          tasks={inProgressTasks}
          commentsCountMap={commentsCountMap}
          onCardClick={(task) => { setSelectedTask(task); setIsTaskModalOpen(true); }}
          onDragStart={handleDragStart}
          onDropCard={handleDropCard}
          onAddTask={(col) => { setNewTaskTitle(''); setShowAddTaskInline(col); }}
        />
        <BoardColumn
          title="Review"
          status="review"
          tasks={reviewTasks}
          commentsCountMap={commentsCountMap}
          onCardClick={(task) => { setSelectedTask(task); setIsTaskModalOpen(true); }}
          onDragStart={handleDragStart}
          onDropCard={handleDropCard}
          onAddTask={(col) => { setNewTaskTitle(''); setShowAddTaskInline(col); }}
        />
        <BoardColumn
          title="Done"
          status="done"
          tasks={doneTasks}
          commentsCountMap={commentsCountMap}
          onCardClick={(task) => { setSelectedTask(task); setIsTaskModalOpen(true); }}
          onDragStart={handleDragStart}
          onDropCard={handleDropCard}
          onAddTask={(col) => { setNewTaskTitle(''); setShowAddTaskInline(col); }}
        />
      </main>

      {/* Inline Quick Add Task Dialog */}
      {showAddTaskInline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Add Task</h3>
            <form onSubmit={handleAddTask}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="quick-task-title">Task Title</label>
                <input
                  id="quick-task-title"
                  type="text"
                  placeholder="What needs to be done?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowAddTaskInline(null)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collaborator Modal */}
      <CollaboratorModal
        isOpen={isCollabModalOpen}
        onClose={() => setIsCollabModalOpen(false)}
        projectId={projectId}
        token={token}
        currentMembers={members}
        onAddMember={(newMember) => setMembers(prev => [...prev, newMember])}
      />

      {/* Task Detail Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setSelectedTask(null); setWsComments([]); }}
        task={selectedTask}
        projectId={projectId}
        token={token}
        projectMembers={members}
        onUpdateTask={handleUpdateTaskInState}
        onDeleteTask={handleDeleteTaskInState}
        wsComments={wsComments}
      />
    </div>
  );
}
