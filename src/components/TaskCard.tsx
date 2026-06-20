import React from 'react';
import type { TaskWithRelations } from '../models/types';
import { RELATIONSHIP_LABELS } from '../models/types';
import { Check, Clock, ArrowRight, AlertTriangle, Calendar } from 'lucide-react';

interface TaskCardProps {
  task: TaskWithRelations;
  onMarkDone: (taskId: number) => void;
  onUndoDone?: (taskId: number) => void;
  compact?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onMarkDone,
  onUndoDone,
  compact = false,
}) => {
  const isDone = task.state === 'done';
  const isLocked = task.state === 'locked';
  const canClickDone = !isLocked && task.canComplete && !isDone;

  const handleDoneClick = () => {
    if (isDone && onUndoDone) {
      onUndoDone(task.id!);
    } else if (canClickDone) {
      onMarkDone(task.id!);
    }
  };

  // Format scheduled date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      className={`task-card state-${task.state} ${task.isCritical ? 'is-critical' : ''}`}
      id={`task-${task.id}`}
    >
      <button
        className={`btn-done ${isDone ? 'is-done' : ''}`}
        onClick={handleDoneClick}
        disabled={isLocked || (!task.canComplete && !isDone)}
        title={
          isLocked
            ? 'Task masih Locked — predecessor belum selesai'
            : !task.canComplete
            ? `Menunggu: ${task.blockingPredecessors.map((b) => b.title).join(', ')}`
            : isDone
            ? 'Klik untuk undo'
            : 'Tandai selesai'
        }
        aria-label={isDone ? 'Undo done' : 'Mark as done'}
      >
        {isDone && <Check size={14} strokeWidth={3} />}
      </button>

      <div className="task-card-content">
        <div className="task-card-title">{task.title}</div>

        <div className="task-card-meta">
          {task.thread && (
            <span
              className="pill pill-thread"
              style={{
                color: task.thread.color,
                borderColor: task.thread.color + '40',
                background: task.thread.color + '15',
              }}
            >
              {task.thread.name}
            </span>
          )}

          <span className={`pill pill-state ${task.state}`}>
            {task.state}
          </span>

          {task.isCritical && task.state !== 'done' && (
            <span className="pill pill-critical">⚡ Critical</span>
          )}

          {!task.isCritical && task.slack != null && task.slack > 0 && task.state !== 'done' && (
            <span className="pill pill-slack">
              <Clock size={10} /> buffer: {task.slack}
            </span>
          )}

          {task.scheduledDate && (
            <span className="pill pill-scheduled">
              <Calendar size={10} /> {formatDate(task.scheduledDate)}
            </span>
          )}
        </div>

        {/* Predecessor dependency chips */}
        {!compact && task.predecessors.length > 0 && (
          <div className="dependency-info">
            {task.predecessors.map((pred, i) => (
              <span key={i} className="dep-chip">
                <ArrowRight />
                {pred.type !== 'leads_to' && (
                  <span className="pill-relationship">
                    {RELATIONSHIP_LABELS[pred.type].label}
                  </span>
                )}
                {pred.task.title.length > 25 ? pred.task.title.slice(0, 25) + '…' : pred.task.title}
              </span>
            ))}
          </div>
        )}

        {/* Completes_with blocker */}
        {!task.canComplete && task.state === 'ready' && task.blockingPredecessors.length > 0 && (
          <div className="blocker-notice">
            <AlertTriangle />
            <span>
              Selesai bareng: {task.blockingPredecessors.map((b) => `"${b.title}"`).join(', ')}
            </span>
          </div>
        )}

        {!compact && task.notes && (
          <div className="task-card-notes">{task.notes}</div>
        )}
      </div>
    </div>
  );
};
