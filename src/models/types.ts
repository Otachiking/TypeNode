// TaskNode — Core Type Definitions

export type TaskState = 'floating' | 'locked' | 'ready' | 'done';

export type RelationshipType =
  | 'leads_to'        // (FS) A harus Done → B bisa mulai
  | 'starts_with'     // (SS) B bisa mulai begitu A mulai
  | 'completes_with'; // (FF) B gak Done sebelum A Done — "selama A berlangsung"

export interface Task {
  id?: number;
  title: string;
  state: TaskState;
  threadId?: number;
  scheduledDate?: string;     // ISO date string, untuk Time Gate
  isCritical: boolean;        // label visual, bukan state
  slack?: number;             // hari buffer (non-critical tasks)
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

export interface Dependency {
  id?: number;
  predecessorId: number;      // task yang harus duluan
  successorId: number;        // task yang menunggu
  type: RelationshipType;     // default: 'leads_to'
}

export interface Thread {
  id?: number;
  name: string;
  color: string;              // hex color untuk visual grouping
  goalDescription?: string;
  createdAt: string;
}

// Helper types for UI
export interface TaskWithRelations extends Task {
  thread?: Thread;
  predecessors: { task: Task; type: RelationshipType }[];
  successors: { task: Task; type: RelationshipType }[];
  // For "completes_with": can the user mark this Done?
  canComplete: boolean;
  blockingPredecessors: Task[]; // predecessors yang masih harus Done (untuk completes_with)
}

export const RELATIONSHIP_LABELS: Record<RelationshipType, { label: string; description: string }> = {
  leads_to: {
    label: 'Leads to',
    description: 'Harus selesai dulu sebelum task berikutnya bisa mulai',
  },
  starts_with: {
    label: 'Starts with',
    description: 'Bisa mulai bareng — gak perlu nunggu kelar',
  },
  completes_with: {
    label: 'Completes with',
    description: 'Berjalan selama task lain berlangsung — selesai bareng',
  },
};

export const STATE_LABELS: Record<TaskState, { label: string; color: string }> = {
  floating: { label: 'Floating', color: 'var(--state-floating)' },
  locked: { label: 'Locked', color: 'var(--state-locked)' },
  ready: { label: 'Ready', color: 'var(--state-ready)' },
  done: { label: 'Done', color: 'var(--state-done)' },
};
