import { db } from '../db/database';
import type { Dependency, RelationshipType } from '../models/types';
import { recalculateAllStates } from './stateEngine';

/**
 * Graph Engine — Manages task dependencies (edges in the DAG).
 */

/**
 * Detect if adding this dependency would create a cycle.
 * Uses DFS from successorId to see if we can reach predecessorId.
 */
export async function detectCycle(
  predecessorId: number,
  successorId: number
): Promise<boolean> {
  const allDeps = await db.dependencies.toArray();

  const visited = new Set<number>();
  const stack = [successorId];

  // If predecessor === successor, immediate cycle
  if (predecessorId === successorId) return true;

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === predecessorId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all successors of current
    const outgoing = allDeps.filter((d) => d.predecessorId === current);
    for (const dep of outgoing) {
      stack.push(dep.successorId);
    }
  }

  return false;
}

/**
 * Add a dependency between two tasks.
 * Returns the new dependency or null if it would create a cycle.
 */
export async function addDependency(
  predecessorId: number,
  successorId: number,
  type: RelationshipType = 'leads_to'
): Promise<Dependency | null> {
  // Check for cycles
  const wouldCycle = await detectCycle(predecessorId, successorId);
  if (wouldCycle) return null;

  // Check for duplicate
  const existing = await db.dependencies
    .where('predecessorId')
    .equals(predecessorId)
    .filter((d) => d.successorId === successorId)
    .first();

  if (existing) return existing;

  const dep: Dependency = { predecessorId, successorId, type };
  const id = await db.dependencies.add(dep);
  dep.id = id;

  await recalculateAllStates();
  return dep;
}

/**
 * Remove a dependency.
 */
export async function removeDependency(depId: number): Promise<void> {
  await db.dependencies.delete(depId);
  await recalculateAllStates();
}

/**
 * Get all predecessors of a task with their relationship types.
 */
export async function getPredecessors(
  taskId: number
): Promise<{ dep: Dependency; task: import('../models/types').Task }[]> {
  const deps = await db.dependencies.where('successorId').equals(taskId).toArray();
  const results = [];

  for (const dep of deps) {
    const task = await db.tasks.get(dep.predecessorId);
    if (task) results.push({ dep, task });
  }

  return results;
}

/**
 * Get all successors of a task with their relationship types.
 */
export async function getSuccessors(
  taskId: number
): Promise<{ dep: Dependency; task: import('../models/types').Task }[]> {
  const deps = await db.dependencies.where('predecessorId').equals(taskId).toArray();
  const results = [];

  for (const dep of deps) {
    const task = await db.tasks.get(dep.successorId);
    if (task) results.push({ dep, task });
  }

  return results;
}
