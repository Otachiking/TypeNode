# Project: TaskNode

**Objective:** Sistem manajemen tugas personal berbasis *Dependency Graph* yang membantu mengurangi *decision fatigue* dan *executive dysfunction* dengan memetakan task secara sekuensial/kondisional — tanpa memaksa user berpikir struktur di saat sedang capture ide.

**Status:** Personal tool (single-user), v1 planning.

---

## 1. Filosofi Inti

- **Capture dulu, struktur nanti.** Menulis ide gak boleh butuh effort mikir. Structuring (kasih predecessor/successor, masukin ke Thread) adalah aksi terpisah yang dilakukan belakangan, saat kondisi lebih tenang.
- **Sistem yang menunjukkan, bukan yang menghakimi.** Task yang belum dikerjain bukan dosa — kalau dia bukan Critical dan punya Slack, sistem bilang itu emang boleh nunggu.
- **Default rigid, override eksplisit.** Aturan dependency (AND) jadi default supaya user tetap "on-track", tapi user tetap bisa override secara sadar untuk kasus yang emang butuh fleksibilitas (OR grouping).
- **Bahasa manusia, bukan jargon project management.** Gak ada istilah FS/SS/FF/SF yang terekspos ke user.

---

## 2. Konsep Inti & Glossary

| Istilah | Definisi |
|---|---|
| **Node / Task** | Unit kerja tunggal. |
| **Predecessor** | Task yang harus terjadi duluan relatif terhadap task ini. |
| **Successor** | Task yang baru bisa berjalan setelah task ini. |
| **Leads to** | (dulu FS) A harus **Done** dulu sebelum B bisa **mulai**. Default relationship, paling umum dipakai. |
| **Starts with** | (dulu SS) B bisa **mulai** begitu A **mulai** — gak perlu nunggu A kelar. |
| **Finishes with** | (dulu FF) B gak dianggap **Done** sebelum A juga **Done**. |
| **Thread** | Kumpulan node yang ngarah ke satu goal/agenda (pengganti istilah "Project"). |
| **Graph Gate** | Syarat berdasarkan Predecessor task. Kalau ada 2+ predecessor, defaultnya **AND** (semua harus Done). |
| **Time Gate** | Syarat berdasarkan tanggal/waktu trigger (bukan task lain). |
| **Critical** | Label pada task yang berada di Critical Path aktif suatu Thread. |
| **Slack** | Berapa hari buffer yang dimiliki task non-Critical sebelum dia ikut jadi mendesak. |
| **Floating** | Task mentah yang belum ditriase — belum punya Thread, belum punya Predecessor/Successor. |

> Catatan: konsep **Frozen/Parked** (state "dipause karena interupsi") sudah **dihapus** dari model — terlalu nambah kompleksitas state untuk value yang marginal. Task yang sedang gak dikerjain cukup dibiarkan di state aslinya (Ready/Locked); kalau perlu dicatat ada interupsi, cukup lewat note di task, bukan state terpisah.

---

## 3. State Model

Hanya 4 state, dihitung otomatis oleh sistem (bukan dipilih manual oleh user):

| State | Definisi | Trigger |
|---|---|---|
| **Floating** | Belum ditriase. Hidup di Backlog Cluster. | Default kalau task dibuat hanya dengan judul (Quick Capture), tanpa Thread/Predecessor/Successor/Scheduled date. |
| **Locked** | Graph Gate dan/atau Time Gate belum terpenuhi. | Ada Predecessor yang belum Done **dan** (jika ada) Time Gate belum tercapai. |
| **Ready** | Semua gate terpenuhi, siap eksekusi. | Semua Predecessor Done, **atau** Time Gate sudah tercapai (lihat aturan OR di bagian 5), **atau** task gak punya gate sama sekali dan sudah ditriase ke sebuah Thread. |
| **Done** | Selesai. Ditandai manual oleh user. | Manual. |

---

## 4. Relationship Rules

- **AND default antar Predecessor.** Kalau Task C punya Predecessor A dan B, defaultnya **A DAN B harus Done** sebelum C jadi Ready. Ini gak bisa diubah lewat toggle bebas per-task — harus lewat aksi eksplisit "gabungkan sebagai alternatif" kalau memang butuh OR (di-deprioritaskan ke v2, lihat Roadmap).
- **SF (Start-to-Finish) dihapus total.** Terlalu jarang dipakai dan terlalu membingungkan untuk personal use case.
- User tetap bisa mengerjakan task secara manual tanpa mengikuti gate sistem (di luar kontrol aplikasi) — sistem gak memaksa, hanya membantu mengarahkan.

---

## 5. Time Gate & Anti-Procrastination

Setiap task bisa punya **Scheduled date** terpisah dari Graph Gate — ini buat kasus seperti "Bersihin gudang, tanggal 16 Juni" yang trigger-nya murni waktu, bukan task lain.

**Aturan kunci:** kalau sebuah task punya **Graph Gate DAN Time Gate sekaligus**, logikanya **OR**, bukan AND — task jadi Ready begitu salah satu kepenuhi, mana yang lebih dulu.

> Contoh: "Beli kado ulang tahun" punya Predecessor "Gajian" (Leads to) **dan** Scheduled date "3 hari sebelum ulang tahun teman". Task ini jadi Ready begitu **gajian cair ATAU** tanggalnya udah deket — mana yang lebih dulu — supaya gak ke-skip sampai mepet banget cuma karena nunggu satu kondisi doang.

Scheduled date juga trigger **notifikasi lokal**, dan jadi fondasi buat sinkronisasi ke Google Calendar di iterasi berikutnya.

---

## 6. Critical Path & Slack

- **Critical Path**: rantai task tak terputus dalam satu Thread yang, kalau terlambat, langsung mendelay goal akhir Thread tersebut. Dihitung otomatis dari graph, bukan ditandai manual.
- **Critical**: label yang ditempel ke task yang berada di Critical Path aktif. Ini **label tambahan**, bukan state terpisah — task tetap punya state Floating/Locked/Ready/Done seperti biasa, cuma dikasih tanda visual ekstra.
- **Slack**: untuk task non-Critical, sistem menghitung & menampilkan berapa hari buffer yang masih dia punya sebelum ikut jadi mendesak. Tujuannya psikologis: ngasih "izin" eksplisit buat gak ngerjain sesuatu hari ini tanpa rasa bersalah.
- **One Thing View** *(experimental, v1 — bukan default)*: toggle opsional di Now mode yang nge-filter tampilan jadi cuma menunjukkan satu task: task Critical paling depan yang statusnya Ready. Dipasang sebagai eksperimen buat divalidasi dulu kegunaannya, bukan langsung dijadikan mode utama.

---

## 7. Thread

Pengganti istilah "Project". Thread = kumpulan node yang ngarah ke satu goal/agenda (misal: "Web Portfolio", "Bersihin Gudang", "Kaggle Pelatihan"). Fungsinya:
- Membagi canvas/Map mode jadi potongan yang gak overwhelming (bisa filter per-Thread).
- Tiap Thread punya Critical Path & Slack sendiri-sendiri.
- Now mode bisa nunjukin next action dari beberapa Thread aktif sekaligus, tergantung mood/energy user hari itu.

---

## 8. Mode Aplikasi

| Mode | Fungsi | Kapan dipakai |
|---|---|---|
| **Capture mode** | Quick Add, zero-friction, cuma ketik judul. | Setiap saat, terutama saat sedang fokus hal lain tapi kepikiran task baru. |
| **Now mode** | Home screen harian. List sederhana dari task Ready, dengan highlight Critical. | Default screen tiap dibuka. |
| **Map mode** | Canvas/graph visual, drag-connect predecessor/successor. | Sesi planning/reorganize yang disengaja, bukan default. |

---

## 9. Quick Add — Input Design

Satu entry point untuk semua jenis input, dengan **progressive disclosure**:

- **Title** (wajib, satu-satunya field yang harus diisi).
- **Thread** (opsional, dropdown).
- **Predecessor / Successor** (opsional, dipilih lewat searchable list — bukan drag canvas).
- **Scheduled date** (opsional).

**Default behavior:** kalau user cuma isi Title dan submit → otomatis masuk **Floating**. Begitu salah satu field opsional diisi (Thread, Predecessor/Successor, atau Scheduled date), task langsung dihitung state-nya sesuai aturan di bagian 3 — gak perlu langkah "promote" manual terpisah.

---

## 10. Scope & Roadmap

**V1 (target build sekarang):**
- Graph engine: Leads to / Starts with / Finishes with, AND default antar Predecessor
- State engine: Floating / Locked / Ready / Done (otomatis)
- Time Gate + OR logic dengan Graph Gate + notifikasi lokal
- Thread grouping
- Critical Path computation + label Critical + Slack
- One Thing View (experimental toggle)
- Quick Add unified input (progressive disclosure)
- Mode: Capture, Now, Map
- Input manual penuh — **tanpa AI assist**

**V2+ (sengaja dideprioritaskan, jangan dikerjain dulu):**
- Lag/lead time (delay N hari antar dependency)
- Micro-animations (terutama momen Locked → Ready)
- AI-assisted dependency suggestion dari natural language
- Google Calendar sync (mulai dari satu arah: app → Calendar, dulu)
- Advanced OR-grouping editor untuk multiple predecessor

---

## 11. Tech Stack (tentatif, untuk didiskusikan ulang)

Karena scope-nya **personal/single-user**, stack backend relasional berat (Node.js + PostgreSQL) di draft awal mungkin overkill. Worth dipertimbangin ulang: arsitektur **local-first** (frontend React/Next.js + local persistent storage, misal IndexedDB) bisa jauh lebih cepat untuk dibangun dan dites, dengan opsi nambah sync/backend cloud belakangan kalau memang dibutuhin. Ini keputusan terbuka, bukan final.
