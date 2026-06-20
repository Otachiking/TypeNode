import React from 'react';
import type { TaskWithRelations } from '../models/types';
import { Check, SkipForward, AlertTriangle } from 'lucide-react';

interface OneThingViewProps {
  readyTasks: TaskWithRelations[];
  onMarkDone: (taskId: number) => void;
}

export const OneThingView: React.FC<OneThingViewProps> = ({ readyTasks, onMarkDone }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  // Sort: Critical first, then by thread
  const sorted = [...readyTasks].sort((a, b) => {
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;
    return 0;
  });

  const task = sorted[currentIndex % sorted.length];

  if (!task) {
    return (
      <div className="one-thing">
        <h2 style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          🎉 Semua beres!
        </h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
          Tidak ada task Ready saat ini.
        </p>
      </div>
    );
  }

  const handleSkip = () => {
    setCurrentIndex((prev) => (prev + 1) % sorted.length);
  };

  const canDone = task.canComplete && task.state === 'ready';

  return (
    <div className="one-thing">
      {/* Thread label */}
      {task.thread && (
        <div className="one-thing-thread" style={{ color: task.thread.color }}>
          {task.thread.name}
        </div>
      )}

      {/* Task title */}
      <h2 className="one-thing-title">{task.title}</h2>

      {/* Meta badges */}
      <div className="one-thing-meta">
        <span className={`pill pill-state ${task.state}`}>
          {task.state}
        </span>
        {task.isCritical && (
          <span className="pill pill-critical">⚡ Critical</span>
        )}
        {!task.isCritical && task.slack != null && task.slack > 0 && (
          <span className="pill pill-slack">buffer: {task.slack}</span>
        )}
      </div>

      {/* Big Done button */}
      <button
        className="one-thing-done-btn"
        onClick={() => canDone && onMarkDone(task.id!)}
        disabled={!canDone}
        title={canDone ? 'Tandai selesai' : 'Belum bisa ditandai selesai'}
        aria-label="Mark as done"
      >
        <Check size={32} strokeWidth={3} />
      </button>

      {/* Blocker notice */}
      {!task.canComplete && task.blockingPredecessors.length > 0 && (
        <div className="one-thing-blocker">
          <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Selesai bareng: {task.blockingPredecessors.map((b) => `"${b.title}"`).join(', ')}
        </div>
      )}

      {/* Skip button */}
      {sorted.length > 1 && (
        <button className="one-thing-skip" onClick={handleSkip}>
          <SkipForward size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
          Lihat alternatif ({currentIndex % sorted.length + 1}/{sorted.length})
        </button>
      )}
    </div>
  );
};
