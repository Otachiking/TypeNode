import React, { useState } from 'react';
import { QuickAdd } from '../components/QuickAdd';
import { Zap } from 'lucide-react';

interface CapturePageProps {
  showToast: (message: string) => void;
}

interface CapturedTask {
  id: number;
  title: string;
}

export const CapturePage: React.FC<CapturePageProps> = ({ showToast }) => {
  const [capturedTasks, setCapturedTasks] = useState<CapturedTask[]>([]);

  const handleAdded = (id: number, title: string) => {
    setCapturedTasks((prev) => [{ id, title }, ...prev]);
  };

  return (
    <div className="capture-container">
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <Zap size={32} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: 'var(--space-4)' }} />
        <h1 className="page-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Capture</h1>
        <p className="page-subtitle">Ketik apa yang ada di pikiran. Struktur nanti aja.</p>
      </div>

      <QuickAdd
        showToast={showToast}
        autoFocus
        variant="capture"
        onAdded={handleAdded}
      />

      {capturedTasks.length > 0 && (
        <div className="capture-history">
          <div className="capture-history-title">Baru ditangkap</div>
          {capturedTasks.map((task) => (
            <div key={task.id} className="capture-history-item">
              <span className="pill pill-state floating">Floating</span>
              <span>{task.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
