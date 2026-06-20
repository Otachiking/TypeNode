import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { recalculateAllStates } from '../engine/stateEngine';
import { computeAllCriticalPaths } from '../engine/criticalPath';
import type { RelationshipType } from '../models/types';
import { Plus, Calendar } from 'lucide-react';

interface QuickAddProps {
  showToast: (message: string) => void;
  /** When used in capture mode, focus input on mount */
  autoFocus?: boolean;
  /** Larger variant for capture page */
  variant?: 'default' | 'capture';
  /** Callback after adding */
  onAdded?: (id: number, title: string) => void;
}

export const QuickAdd: React.FC<QuickAddProps> = ({
  showToast,
  autoFocus = false,
  variant = 'default',
  onAdded,
}) => {
  const [title, setTitle] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [threadId, setThreadId] = useState<number | ''>('');
  const [predecessorId, setPredecessorId] = useState<number | ''>('');
  const [relType, setRelType] = useState<RelationshipType>('leads_to');
  const [scheduledDate, setScheduledDate] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const threads = useLiveQuery(() => db.threads.toArray(), []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const resetForm = () => {
    setTitle('');
    setExpanded(false);
    setThreadId('');
    setPredecessorId('');
    setRelType('leads_to');
    setScheduledDate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const id = await db.tasks.add({
      title: trimmed,
      state: 'floating',
      threadId: threadId || undefined,
      scheduledDate: scheduledDate || undefined,
      isCritical: false,
      createdAt: new Date().toISOString(),
    });

    // Add dependency if selected
    if (predecessorId && typeof predecessorId === 'number') {
      await db.dependencies.add({
        predecessorId: predecessorId,
        successorId: id as number,
        type: relType,
      });
    }

    await recalculateAllStates();
    await computeAllCriticalPaths();

    // Flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 600);

    const taskTitle = trimmed;
    resetForm();
    showToast(`✓ "${taskTitle}" ditangkap`);
    onAdded?.(id as number, taskTitle);
    inputRef.current?.focus();
  };

  if (variant === 'capture') {
    return (
      <form onSubmit={handleSubmit} className="capture-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className={`capture-input ${isFlashing ? 'capture-success' : ''}`}
          placeholder="Apa yang perlu dikerjakan?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          id="capture-input"
        />

        {/* Expand toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-3)', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className={`quick-add-expand-btn ${expanded ? 'is-expanded' : ''}`}
            onClick={() => setExpanded(!expanded)}
            title="Opsi lanjutan"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Expanded fields */}
        <div className={`quick-add-extra ${expanded ? 'expanded' : ''}`}>
          <div className="quick-add-fields" style={{ marginTop: 'var(--space-3)' }}>
            <div className="quick-add-field">
              <label className="quick-add-label">Thread</label>
              <select
                className="select"
                value={threadId}
                onChange={(e) => setThreadId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Tanpa Thread —</option>
                {threads?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="quick-add-field">
              <label className="quick-add-label">Scheduled</label>
              <input
                type="date"
                className="input"
                style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            <div className="quick-add-field">
              <label className="quick-add-label">Predecessor</label>
              <select
                className="select"
                value={predecessorId}
                onChange={(e) => setPredecessorId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Tidak ada —</option>
                {tasks?.filter(t => t.state !== 'done').map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className="quick-add-field">
              <label className="quick-add-label">Tipe Relasi</label>
              <select
                className="select"
                value={relType}
                onChange={(e) => setRelType(e.target.value as RelationshipType)}
                disabled={!predecessorId}
              >
                <option value="leads_to">Leads to</option>
                <option value="starts_with">Starts with</option>
                <option value="completes_with">Completes with</option>
              </select>
            </div>
          </div>

          <div className="quick-add-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim()}>
              Tambahkan
            </button>
          </div>
        </div>

        {!expanded && (
          <p className="capture-hint">
            Tekan <kbd>Enter</kbd> untuk simpan · <Plus size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> untuk detail
          </p>
        )}
      </form>
    );
  }

  // Default inline variant (for Now page)
  return (
    <form onSubmit={handleSubmit} className={`quick-add ${isFlashing ? 'capture-success' : ''}`}>
      <div className="quick-add-main">
        <Plus size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          className="input"
          placeholder="Tambah task baru..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          id="quick-add-input"
        />
        <button
          type="button"
          className={`quick-add-expand-btn ${expanded ? 'is-expanded' : ''}`}
          onClick={() => setExpanded(!expanded)}
          title="Opsi lanjutan"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className={`quick-add-extra ${expanded ? 'expanded' : ''}`}>
        <div className="quick-add-fields">
          <div className="quick-add-field">
            <label className="quick-add-label">Thread</label>
            <select className="select" value={threadId} onChange={(e) => setThreadId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Tanpa Thread —</option>
              {threads?.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
          <div className="quick-add-field">
            <label className="quick-add-label">Scheduled</label>
            <input type="date" className="input" style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
          <div className="quick-add-field">
            <label className="quick-add-label">Predecessor</label>
            <select className="select" value={predecessorId} onChange={(e) => setPredecessorId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Tidak ada —</option>
              {tasks?.filter(t => t.state !== 'done').map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
            </select>
          </div>
          <div className="quick-add-field">
            <label className="quick-add-label">Tipe Relasi</label>
            <select className="select" value={relType} onChange={(e) => setRelType(e.target.value as RelationshipType)} disabled={!predecessorId}>
              <option value="leads_to">Leads to</option>
              <option value="starts_with">Starts with</option>
              <option value="completes_with">Completes with</option>
            </select>
          </div>
        </div>
        <div className="quick-add-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim()}>Tambahkan</button>
        </div>
      </div>
    </form>
  );
};
