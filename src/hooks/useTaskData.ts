import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Task, TaskWithRelations } from '../models/types';

/**
 * Hook: get all tasks with their relations enriched.
 */
export function useTasksWithRelations(threadFilter?: number | 'floating' | 'all') {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const deps = useLiveQuery(() => db.dependencies.toArray(), []);
  const threads = useLiveQuery(() => db.threads.toArray(), []);

  const enriched = useLiveQuery(async () => {
    if (!tasks || !deps || !threads) return [];

    const threadMap = new Map(threads.map((t) => [t.id, t]));
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    const result: TaskWithRelations[] = [];

    for (const task of tasks) {
      // Filter
      if (threadFilter === 'floating' && task.state !== 'floating') continue;
      if (typeof threadFilter === 'number' && task.threadId !== threadFilter) continue;

      // Get predecessors
      const predDeps = deps.filter((d) => d.successorId === task.id);
      const predecessors = predDeps
        .map((d) => {
          const predTask = taskMap.get(d.predecessorId);
          return predTask ? { task: predTask, type: d.type } : null;
        })
        .filter(Boolean) as TaskWithRelations['predecessors'];

      // Get successors
      const succDeps = deps.filter((d) => d.predecessorId === task.id);
      const successors = succDeps
        .map((d) => {
          const succTask = taskMap.get(d.successorId);
          return succTask ? { task: succTask, type: d.type } : null;
        })
        .filter(Boolean) as TaskWithRelations['successors'];

      // Check completes_with blocking
      const completesWithDeps = predDeps.filter((d) => d.type === 'completes_with');
      const blockingPredecessors: Task[] = [];
      let canComplete = true;

      if (completesWithDeps.length > 0) {
        for (const dep of completesWithDeps) {
          const pred = taskMap.get(dep.predecessorId);
          if (pred && pred.state !== 'done') {
            blockingPredecessors.push(pred);
            canComplete = false;
          }
        }
      }

      result.push({
        ...task,
        thread: task.threadId ? threadMap.get(task.threadId) : undefined,
        predecessors,
        successors,
        canComplete,
        blockingPredecessors,
      });
    }

    return result;
  }, [tasks, deps, threads, threadFilter]);

  return {
    tasks: enriched ?? [],
    allTasks: tasks ?? [],
    dependencies: deps ?? [],
    threads: threads ?? [],
    isLoading: !tasks || !deps || !threads,
  };
}

/**
 * Hook: toast notification system.
 */
export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; message: string; exiting?: boolean }[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);

    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 200);
    }, 2500);
  }, []);

  return { toasts, showToast };
}
