import React, { useState, useCallback, useEffect } from 'react';
import { useTasksWithRelations } from '../hooks/useTaskData';
import { TaskCard } from '../components/TaskCard';
import { QuickAdd } from '../components/QuickAdd';
import { OneThingView } from '../components/OneThingView';
import { markTaskDone, unmarkTaskDone } from '../engine/stateEngine';
import { computeAllCriticalPaths } from '../engine/criticalPath';
import type { TaskWithRelations } from '../models/types';
import { ChevronRight, Inbox, CheckCircle2, Sparkles, Focus } from 'lucide-react';

interface NowPageProps {
  showToast: (message: string) => void;
}

interface UndoState {
  taskId: number;
  title: string;
  timeoutId: ReturnType<typeof setTimeout>;
  startTime: number;
}

const UNDO_DURATION = 4000; // 4 seconds

export const NowPage: React.FC<NowPageProps> = ({ showToast }) => {
  const { tasks, threads, isLoading } = useTasksWithRelations();
  const [floatingCollapsed, setFloatingCollapsed] = useState(true);
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const [oneThingMode, setOneThingMode] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());

  // Clear undo on unmount
  useEffect(() => {
    return () => {
      if (undoState) clearTimeout(undoState.timeoutId);
    };
  }, [undoState]);

  const handleMarkDone = useCallback(async (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    const result = await markTaskDone(taskId);

    if (result.success) {
      await computeAllCriticalPaths();

      // Completing animation
      setCompletingIds((prev) => new Set(prev).add(taskId));
      setTimeout(() => {
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }, 500);

      // Clear previous undo
      if (undoState) {
        clearTimeout(undoState.timeoutId);
      }

      // Set new undo window
      const timeoutId = setTimeout(() => {
        setUndoState(null);
      }, UNDO_DURATION);

      setUndoState({
        taskId,
        title: task?.title || '',
        timeoutId,
        startTime: Date.now(),
      });
    } else if (result.blockers) {
      showToast(`⏳ Belum bisa — menunggu: ${result.blockers.map((b) => `"${b.title}"`).join(', ')}`);
    }
  }, [tasks, undoState, showToast]);

  const handleUndo = useCallback(async () => {
    if (!undoState) return;

    clearTimeout(undoState.timeoutId);
    await unmarkTaskDone(undoState.taskId);
    await computeAllCriticalPaths();

    const title = undoState.title;
    setUndoState(null);
    showToast(`↩ "${title}" dibuka kembali`);
  }, [undoState, showToast]);

  const dismissUndo = useCallback(() => {
    if (undoState) {
      clearTimeout(undoState.timeoutId);
      setUndoState(null);
    }
  }, [undoState]);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="empty-state"><p className="empty-state-desc">Memuat...</p></div>
      </div>
    );
  }

  // Group tasks
  const readyTasks = tasks.filter((t) => t.state === 'ready');
  const lockedTasks = tasks.filter((t) => t.state === 'locked');
  const floatingTasks = tasks.filter((t) => t.state === 'floating');
  const doneTasks = tasks.filter((t) => t.state === 'done');

  const totalReady = readyTasks.length;
  const totalCritical = readyTasks.filter((t) => t.isCritical).length;

  // Group ready by thread
  const readyByThread = new Map<number | undefined, TaskWithRelations[]>();
  for (const task of readyTasks) {
    const key = task.threadId;
    if (!readyByThread.has(key)) readyByThread.set(key, []);
    readyByThread.get(key)!.push(task);
  }
  for (const [, group] of readyByThread) {
    group.sort((a, b) => {
      if (a.isCritical && !b.isCritical) return -1;
      if (!a.isCritical && b.isCritical) return 1;
      return 0;
    });
  }

  const threadMap = new Map(threads.map((t) => [t.id, t]));
  const isEmpty = readyTasks.length === 0 && lockedTasks.length === 0 && floatingTasks.length === 0 && doneTasks.length === 0;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Task</h1>
          <p className="page-subtitle">
            {totalReady} task siap dikerjakan
            {totalCritical > 0 && ` · ${totalCritical} critical`}
          </p>
        </div>
        <div className="page-actions">
          <button
            className={`btn-icon ${oneThingMode ? 'active' : ''}`}
            onClick={() => setOneThingMode(!oneThingMode)}
            title="One Thing View (fokus satu task)"
            id="one-thing-toggle"
          >
            <Focus size={18} />
          </button>
        </div>
      </div>

      {/* One Thing View */}
      {oneThingMode ? (
        <OneThingView
          readyTasks={readyTasks}
          onMarkDone={handleMarkDone}
        />
      ) : isEmpty ? (
        <div className="empty-state">
          <Sparkles />
          <div className="empty-state-title">Belum ada task</div>
          <div className="empty-state-desc">Mulai dengan menangkap ide di Capture mode</div>
        </div>
      ) : (
        <>
          {/* Quick Add inline */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <QuickAdd showToast={showToast} variant="default" />
          </div>

          {/* Ready tasks by thread */}
          {Array.from(readyByThread.entries()).map(([threadId, threadTasks]) => {
            const thread = threadId != null ? threadMap.get(threadId) : undefined;
            return (
              <div key={threadId ?? 'no-thread'} className="thread-group">
                {thread ? (
                  <div className="thread-header">
                    <div className="thread-dot" style={{ background: thread.color }} />
                    <div className="thread-name">{thread.name}</div>
                    {thread.goalDescription && <div className="thread-goal">{thread.goalDescription}</div>}
                  </div>
                ) : (
                  <div className="thread-header">
                    <div className="thread-dot" style={{ background: 'var(--text-tertiary)' }} />
                    <div className="thread-name">Tanpa Thread</div>
                  </div>
                )}
                <div className="task-list">
                  {threadTasks.map((task) => (
                    <div key={task.id} className={completingIds.has(task.id!) ? 'completing' : ''}>
                      <TaskCard task={task} onMarkDone={handleMarkDone} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Locked */}
          {lockedTasks.length > 0 && (
            <div className="section">
              <div className="section-header">
                <span className="section-title">Locked — Menunggu Predecessor</span>
                <span className="section-count">{lockedTasks.length}</span>
              </div>
              <div className="task-list">
                {lockedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onMarkDone={handleMarkDone} compact />
                ))}
              </div>
            </div>
          )}

          {/* Floating — collapsible */}
          {floatingTasks.length > 0 && (
            <div className="section">
              <button
                className={`collapsible-trigger ${!floatingCollapsed ? 'is-open' : ''}`}
                onClick={() => setFloatingCollapsed(!floatingCollapsed)}
                id="floating-toggle"
              >
                <ChevronRight />
                <Inbox size={14} />
                Backlog — Floating
                <span className="section-count" style={{ marginLeft: 'auto' }}>{floatingTasks.length}</span>
              </button>
              <div className={`collapsible-content ${floatingCollapsed ? 'collapsed' : 'expanded'}`}>
                <div className="task-list" style={{ paddingTop: 'var(--space-2)' }}>
                  {floatingTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onMarkDone={handleMarkDone} compact />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Done — collapsible */}
          {doneTasks.length > 0 && (
            <div className="section">
              <button
                className={`collapsible-trigger ${!doneCollapsed ? 'is-open' : ''}`}
                onClick={() => setDoneCollapsed(!doneCollapsed)}
                id="done-toggle"
              >
                <ChevronRight />
                <CheckCircle2 size={14} />
                Selesai
                <span className="section-count" style={{ marginLeft: 'auto' }}>{doneTasks.length}</span>
              </button>
              <div className={`collapsible-content ${doneCollapsed ? 'collapsed' : 'expanded'}`}>
                <div className="task-list" style={{ paddingTop: 'var(--space-2)' }}>
                  {doneTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onMarkDone={handleMarkDone} compact />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Undo Toast */}
      {undoState && (
        <div className="undo-toast" onClick={dismissUndo}>
          <div className="undo-toast-content">
            <span className="undo-toast-text">✓ "{undoState.title}" selesai</span>
            <button
              className="undo-toast-btn"
              onClick={(e) => { e.stopPropagation(); handleUndo(); }}
            >
              Undo
            </button>
          </div>
          <div
            className="undo-progress"
            style={{ '--undo-duration': `${UNDO_DURATION}ms` } as React.CSSProperties}
            key={undoState.startTime}
          />
        </div>
      )}
    </div>
  );
};
