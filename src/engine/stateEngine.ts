import { db } from '../db/database';
import type { Task, Dependency, TaskState } from '../models/types';

/**
 * State Engine — Menghitung state task secara otomatis.
 *
 * Rules (PROJECT.md §3 + §5):
 * - Floating: tanpa Thread, tanpa Predecessor/Successor, tanpa Scheduled date
 * - Done: ditandai manual, preserved
 * - Locked: ada predecessor yang belum terpenuhi (AND logic)
 *   - leads_to: predecessor harus Done
 *   - starts_with: predecessor harus minimal Ready/Done
 *   - completes_with: predecessor harus minimal Ready/Done (tapi Done diblokir)
 * - Ready: semua gate terpenuhi
 *
 * Time Gate (§5):
 * - Jika task punya Graph Gate DAN Time Gate → OR logic
 * - Task jadi Ready begitu salah satu terpenuhi
 */

export async function computeState(
  task: Task,
  dependencies: Dependency[],
  allTasks: Task[]
): Promise<TaskState> {
  // Done is manually set, never overridden
  if (task.state === 'done') return 'done';

  const predecessorDeps = dependencies.filter((d) => d.successorId === task.id);
  const successorDeps = dependencies.filter((d) => d.predecessorId === task.id);

  const hasStructure =
    task.threadId != null ||
    predecessorDeps.length > 0 ||
    successorDeps.length > 0 ||
    task.scheduledDate != null;

  // Floating: no structure at all
  if (!hasStructure) return 'floating';

  const hasGraphGate = predecessorDeps.length > 0;
  const hasTimeGate = task.scheduledDate != null;

  // Time Gate check
  let timeGateMet = false;
  if (hasTimeGate) {
    const scheduled = new Date(task.scheduledDate!);
    const now = new Date();
    // Zero out time for date-only comparison
    scheduled.setHours(0, 0, 0, 0);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    timeGateMet = today >= scheduled;
  }

  // No graph gate
  if (!hasGraphGate) {
    // If only time gate, check it
    if (hasTimeGate) {
      return timeGateMet ? 'ready' : 'locked';
    }
    // Has structure but no gates (e.g., just assigned to thread)
    return 'ready';
  }

  // Check graph gate (AND logic — all predecessors must be satisfied)
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  let graphGateMet = true;

  for (const dep of predecessorDeps) {
    const predecessor = taskMap.get(dep.predecessorId);
    if (!predecessor) continue;

    switch (dep.type) {
      case 'leads_to':
        if (predecessor.state !== 'done') { graphGateMet = false; }
        break;
      case 'starts_with':
        if (predecessor.state !== 'ready' && predecessor.state !== 'done') { graphGateMet = false; }
        break;
      case 'completes_with':
        if (predecessor.state !== 'ready' && predecessor.state !== 'done') { graphGateMet = false; }
        break;
    }
    if (!graphGateMet && !hasTimeGate) break; // optimization: skip rest if no OR
  }

  // OR logic: if both Graph Gate and Time Gate exist, either one satisfying = Ready
  if (hasGraphGate && hasTimeGate) {
    return (graphGateMet || timeGateMet) ? 'ready' : 'locked';
  }

  return graphGateMet ? 'ready' : 'locked';
}

/**
 * Check if a task can be marked as Done.
 * For completes_with: predecessor must also be Done.
 */
export async function canMarkDone(taskId: number): Promise<{
  allowed: boolean;
  blockers: Task[];
}> {
  const deps = await db.dependencies.where('successorId').equals(taskId).toArray();
  const completesWithDeps = deps.filter((d) => d.type === 'completes_with');

  if (completesWithDeps.length === 0) {
    return { allowed: true, blockers: [] };
  }

  const blockers: Task[] = [];
  for (const dep of completesWithDeps) {
    const predecessor = await db.tasks.get(dep.predecessorId);
    if (predecessor && predecessor.state !== 'done') {
      blockers.push(predecessor);
    }
  }

  return { allowed: blockers.length === 0, blockers };
}

/**
 * Recalculate all task states after a change.
 */
export async function recalculateAllStates(): Promise<void> {
  const allTasks = await db.tasks.toArray();
  const allDeps = await db.dependencies.toArray();

  let changed = true;
  let iterations = 0;
  const maxIterations = 50;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const task of allTasks) {
      if (task.state === 'done') continue;

      const newState = await computeState(task, allDeps, allTasks);
      if (newState !== task.state) {
        task.state = newState;
        await db.tasks.update(task.id!, { state: newState });
        changed = true;
      }
    }
  }
}

/**
 * Mark a task as Done, then recalculate all states.
 */
export async function markTaskDone(taskId: number): Promise<{
  success: boolean;
  blockers?: Task[];
}> {
  const { allowed, blockers } = await canMarkDone(taskId);
  if (!allowed) return { success: false, blockers };

  await db.tasks.update(taskId, {
    state: 'done' as TaskState,
    completedAt: new Date().toISOString(),
  });

  await recalculateAllStates();
  return { success: true };
}

/**
 * Undo marking a task as Done.
 */
export async function unmarkTaskDone(taskId: number): Promise<void> {
  await db.tasks.update(taskId, {
    state: 'ready' as TaskState,
    completedAt: undefined,
  });
  await recalculateAllStates();
}
