import { db } from '../db/database';
import type { Task, Dependency, Thread } from '../models/types';
import { recalculateAllStates } from '../engine/stateEngine';
import { computeAllCriticalPaths } from '../engine/criticalPath';

/**
 * Seed database with realistic dummy data.
 * 2 Threads + 3 Floating = 17 tasks total.
 */
export async function seedDatabase(): Promise<void> {
  const existingCount = await db.tasks.count();
  if (existingCount > 0) return;

  // ─── Threads ───
  const threads: Thread[] = [
    {
      name: 'Web Portfolio',
      color: '#6C5CE7',
      goalDescription: 'Bikin portfolio website personal yang kece',
      createdAt: new Date().toISOString(),
    },
    {
      name: 'Pelatihan Kaggle',
      color: '#00B894',
      goalDescription: 'Belajar ML lewat Kaggle dari nol sampai submit competition',
      createdAt: new Date().toISOString(),
    },
  ];

  const threadIds = await db.threads.bulkAdd(threads, { allKeys: true });
  const tid1 = threadIds[0] as number;
  const tid2 = threadIds[1] as number;

  // ─── Thread 1: Web Portfolio ───
  const portfolioTasks: Task[] = [
    { title: 'Riset referensi desain', state: 'floating', threadId: tid1, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Buat wireframe', state: 'floating', threadId: tid1, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Setup project Next.js', state: 'floating', threadId: tid1, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Desain UI di Figma', state: 'floating', threadId: tid1, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Slicing halaman Home', state: 'floating', threadId: tid1, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Tulis konten portfolio', state: 'floating', threadId: tid1, isCritical: false, notes: 'Bisa mulai bareng wireframe — gak harus nunggu wireframe kelar', createdAt: new Date().toISOString() },
    { title: 'Deploy ke Vercel', state: 'floating', threadId: tid1, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Minta review teman', state: 'floating', threadId: tid1, isCritical: false, createdAt: new Date().toISOString() },
  ];

  const pIds = await db.tasks.bulkAdd(portfolioTasks, { allKeys: true }) as number[];

  // ─── Thread 2: Pelatihan Kaggle ───
  // Scheduled date example: "Beli kado" pattern — Time Gate + Graph Gate demo
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const kaggleTasks: Task[] = [
    { title: 'Daftar akun Kaggle', state: 'floating', threadId: tid2, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Ikuti course Intro to ML', state: 'floating', threadId: tid2, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Kerjakan competition Titanic', state: 'floating', threadId: tid2, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Catat insight & learning', state: 'floating', threadId: tid2, isCritical: false, notes: 'Mulai bareng competition — catat sambil ngerjain', createdAt: new Date().toISOString() },
    { title: 'Submit final notebook', state: 'floating', threadId: tid2, isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Buat catatan selama pelatihan berlangsung', state: 'floating', threadId: tid2, isCritical: false, notes: 'Catatan ini berjalan selama course berlangsung — selesainya bareng course', createdAt: new Date().toISOString() },
  ];

  const kIds = await db.tasks.bulkAdd(kaggleTasks, { allKeys: true }) as number[];

  // ─── Floating Tasks ───
  const floatingTasks: Task[] = [
    { title: 'Coba framework Astro', state: 'floating', isCritical: false, createdAt: new Date().toISOString() },
    { title: 'Beli domain baru', state: 'floating', isCritical: false, scheduledDate: threeDaysFromNow.toISOString(), createdAt: new Date().toISOString() },
    { title: 'Backup foto lama ke cloud', state: 'floating', isCritical: false, createdAt: new Date().toISOString() },
  ];

  await db.tasks.bulkAdd(floatingTasks);

  // ─── Dependencies: Web Portfolio ───
  const portfolioDeps: Dependency[] = [
    { predecessorId: pIds[0], successorId: pIds[1], type: 'leads_to' },     // Riset → Wireframe
    { predecessorId: pIds[0], successorId: pIds[2], type: 'leads_to' },     // Riset → Setup
    { predecessorId: pIds[1], successorId: pIds[3], type: 'leads_to' },     // Wireframe → Desain
    { predecessorId: pIds[2], successorId: pIds[4], type: 'leads_to' },     // Setup → Slicing (AND)
    { predecessorId: pIds[3], successorId: pIds[4], type: 'leads_to' },     // Desain → Slicing (AND)
    { predecessorId: pIds[1], successorId: pIds[5], type: 'starts_with' },  // Wireframe → Konten (starts with)
    { predecessorId: pIds[4], successorId: pIds[6], type: 'leads_to' },     // Slicing → Deploy (AND)
    { predecessorId: pIds[5], successorId: pIds[6], type: 'leads_to' },     // Konten → Deploy (AND)
    { predecessorId: pIds[6], successorId: pIds[7], type: 'leads_to' },     // Deploy → Review
  ];
  await db.dependencies.bulkAdd(portfolioDeps);

  // ─── Dependencies: Pelatihan Kaggle ───
  const kaggleDeps: Dependency[] = [
    { predecessorId: kIds[0], successorId: kIds[1], type: 'leads_to' },         // Daftar → Course
    { predecessorId: kIds[1], successorId: kIds[2], type: 'leads_to' },         // Course → Competition
    { predecessorId: kIds[2], successorId: kIds[3], type: 'starts_with' },      // Competition → Catat (starts with)
    { predecessorId: kIds[2], successorId: kIds[4], type: 'leads_to' },         // Competition → Submit (AND)
    { predecessorId: kIds[3], successorId: kIds[4], type: 'leads_to' },         // Catat → Submit (AND)
    { predecessorId: kIds[1], successorId: kIds[5], type: 'completes_with' },   // Course → Catatan pelatihan (completes with)
  ];
  await db.dependencies.bulkAdd(kaggleDeps);

  // ─── Recalculate ───
  await recalculateAllStates();
  await computeAllCriticalPaths();
}

/**
 * Reset: delete entire database and recreate.
 * This ensures auto-increment counters reset properly.
 */
export async function resetAndSeed(): Promise<void> {
  await db.delete();
  await db.open();
  await seedDatabase();
}
