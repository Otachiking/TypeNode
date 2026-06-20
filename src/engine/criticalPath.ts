import { db } from '../db/database';
import type { Dependency } from '../models/types';

/**
 * Critical Path Engine — Computes Critical Path & Slack per Thread.
 *
 * Uses CPM (Critical Path Method):
 * 1. Forward pass: compute Early Start (ES) and Early Finish (EF)
 * 2. Backward pass: compute Late Start (LS) and Late Finish (LF)
 * 3. Float = LS - ES (or LF - EF)
 * 4. Critical tasks: Float === 0
 * 5. Slack (for non-critical) = Float in days
 *
 * Default duration: 1 day per task (v1 simplification).
 */

interface CPMNode {
  taskId: number;
  duration: number; // days
  es: number; // early start
  ef: number; // early finish
  ls: number; // late start
  lf: number; // late finish
  float: number;
}

/**
 * Compute critical path for a specific thread.
 * Updates isCritical and slack fields on tasks.
 */
export async function computeCriticalPath(threadId: number): Promise<void> {
  // Get all tasks in this thread (exclude floating)
  const tasks = await db.tasks
    .where('threadId')
    .equals(threadId)
    .toArray();

  if (tasks.length === 0) return;

  const taskIds = new Set(tasks.map((t) => t.id!));
  const allDeps = await db.dependencies.toArray();

  // Filter deps to only those within this thread
  const deps = allDeps.filter(
    (d) => taskIds.has(d.predecessorId) && taskIds.has(d.successorId)
  );

  // Build adjacency lists
  const predecessorMap = new Map<number, Dependency[]>();
  const successorMap = new Map<number, Dependency[]>();

  for (const dep of deps) {
    if (!predecessorMap.has(dep.successorId)) predecessorMap.set(dep.successorId, []);
    predecessorMap.get(dep.successorId)!.push(dep);

    if (!successorMap.has(dep.predecessorId)) successorMap.set(dep.predecessorId, []);
    successorMap.get(dep.predecessorId)!.push(dep);
  }

  // Initialize CPM nodes
  const nodes = new Map<number, CPMNode>();
  for (const task of tasks) {
    nodes.set(task.id!, {
      taskId: task.id!,
      duration: 1, // default 1 day
      es: 0,
      ef: 0,
      ls: 0,
      lf: 0,
      float: 0,
    });
  }

  // Topological sort (Kahn's algorithm)
  const inDegree = new Map<number, number>();
  for (const task of tasks) {
    inDegree.set(task.id!, 0);
  }
  for (const dep of deps) {
    inDegree.set(dep.successorId, (inDegree.get(dep.successorId) || 0) + 1);
  }

  const queue: number[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const topoOrder: number[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    topoOrder.push(current);

    const succs = successorMap.get(current) || [];
    for (const dep of succs) {
      const newDegree = (inDegree.get(dep.successorId) || 0) - 1;
      inDegree.set(dep.successorId, newDegree);
      if (newDegree === 0) queue.push(dep.successorId);
    }
  }

  // Forward pass
  for (const taskId of topoOrder) {
    const node = nodes.get(taskId)!;
    const preds = predecessorMap.get(taskId) || [];

    if (preds.length === 0) {
      node.es = 0;
    } else {
      node.es = Math.max(
        ...preds.map((dep) => {
          const predNode = nodes.get(dep.predecessorId)!;
          return predNode.ef;
        })
      );
    }
    node.ef = node.es + node.duration;
  }

  // Project duration
  const projectDuration = Math.max(...Array.from(nodes.values()).map((n) => n.ef));

  // Backward pass (reverse topological order)
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const taskId = topoOrder[i];
    const node = nodes.get(taskId)!;
    const succs = successorMap.get(taskId) || [];

    if (succs.length === 0) {
      node.lf = projectDuration;
    } else {
      node.lf = Math.min(
        ...succs.map((dep) => {
          const succNode = nodes.get(dep.successorId)!;
          return succNode.ls;
        })
      );
    }
    node.ls = node.lf - node.duration;
    node.float = node.ls - node.es;
  }

  // Update tasks
  for (const task of tasks) {
    const node = nodes.get(task.id!);
    if (!node) continue;

    const isCritical = node.float === 0;
    const slack = isCritical ? 0 : node.float;

    await db.tasks.update(task.id!, { isCritical, slack });
  }
}

/**
 * Compute critical paths for all threads.
 */
export async function computeAllCriticalPaths(): Promise<void> {
  const threads = await db.threads.toArray();
  for (const thread of threads) {
    await computeCriticalPath(thread.id!);
  }
}
