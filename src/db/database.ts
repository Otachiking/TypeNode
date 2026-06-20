import Dexie, { type Table } from 'dexie';
import type { Task, Dependency, Thread } from '../models/types';

export class TaskNodeDB extends Dexie {
  tasks!: Table<Task, number>;
  dependencies!: Table<Dependency, number>;
  threads!: Table<Thread, number>;

  constructor() {
    super('TaskNodeDB');

    this.version(1).stores({
      tasks: '++id, title, state, threadId, scheduledDate, isCritical, createdAt',
      dependencies: '++id, predecessorId, successorId, type',
      threads: '++id, name, createdAt',
    });
  }
}

export const db = new TaskNodeDB();
