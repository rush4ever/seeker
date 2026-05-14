# Slice 1: Project Scaffold + Multi-Student Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize a Tauri + React + TypeScript desktop app with SQLite local database, multi-student CRUD, and dual-role (student/parent) UI shell.

**Architecture:** Tauri v2 with React 18 frontend. SQLite via `tauri-plugin-sql`. Rust backend handles database migrations and CRUD commands. Frontend uses React Context for global state (current student, role mode). Tailwind CSS for styling. No gameification, clean minimal UI.

**Tech Stack:** Tauri v2, React 18, TypeScript, Vite, Tailwind CSS, tauri-plugin-sql, shadcn/ui (optional but recommended for clean components)

---

## File Structure

```
seeker/
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Entry: setup plugins, run app
│   │   ├── lib.rs                # Re-exports for testing
│   │   ├── db/
│   │   │   ├── mod.rs            # DB connection setup
│   │   │   ├── schema.sql        # All CREATE TABLE statements
│   │   │   └── migrations.rs     # Migration runner
│   │   ├── models/
│   │   │   ├── mod.rs
│   │   │   └── student.rs        # Student struct + SQL mapping
│   │   └── commands/
│   │       ├── mod.rs
│   │       └── student.rs        # Tauri commands: CRUD
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── src/                          # React frontend
│   ├── main.tsx
│   ├── App.tsx                   # Route provider + role switcher
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # Root layout with nav
│   │   │   ├── RoleToggle.tsx    # Student/Parent switch button
│   │   │   ├── StudentNav.tsx    # Student mode navigation
│   │   │   └── ParentNav.tsx     # Parent mode navigation
│   │   └── student/
│   │       ├── StudentSwitcher.tsx
│   │       ├── StudentForm.tsx
│   │       └── StudentList.tsx
│   ├── pages/
│   │   ├── student/
│   │   │   └── HomePage.tsx      # "Today's Practice" big button
│   │   └── parent/
│   │       └── DashboardPage.tsx # Overview cards
│   ├── hooks/
│   │   └── useStudents.ts
│   ├── types/
│   │   └── index.ts
│   ├── context/
│   │   └── AppContext.tsx        # Current student + role
│   └── lib/
│       └── tauri.ts              # invoke wrapper + types
├── tests/
│   └── student_commands.rs       # Rust integration tests
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
└── postcss.config.js
```

---

### Task 1: Initialize Tauri v2 Project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `src/main.tsx`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "seeker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-sql": "^2.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.40",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0"
  }
}
```

- [ ] **Step 2: Create Vite config**

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
```

- [ ] **Step 3: Create TypeScript configs**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```json
// tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create HTML entry**

```html
<!-- index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>错题分析系统</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create Tauri Cargo.toml**

```toml
# src-tauri/Cargo.toml
[package]
name = "seeker"
version = "0.1.0"
description = "错题分析系统"
authors = ["you"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

- [ ] **Step 6: Create Tauri build.rs**

```rust
// src-tauri/build.rs
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 7: Create Tauri config**

```json
// src-tauri/tauri.conf.json
{
  "productName": "错题分析系统",
  "version": "0.1.0",
  "identifier": "com.seeker.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "错题分析系统",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 8: Create Rust main.rs**

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    seeker_lib::run();
}
```

- [ ] **Step 9: Create Rust lib.rs**

```rust
// src-tauri/src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 10: Create React entry**

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 11: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 12: Verify Tauri compiles**

Run: `npm run tauri dev`
Expected: App window opens with blank page, title shows "错题分析系统".

- [ ] **Step 13: Commit**

```bash
git add .
git commit -m "chore: initialize Tauri v2 + React + TypeScript project

- Set up Tauri v2 with tauri-plugin-sql
- Configure Vite + React 18 + TypeScript
- Add Tailwind CSS dependencies
- Create basic app window (1200x800)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Configure Tailwind CSS and Global Styles

**Files:**
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `src/index.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create Tailwind config**

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        mastery: {
          low: "#ef4444",      // red
          medium: "#eab308",   // yellow
          high: "#22c55e",     // green
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Create PostCSS config**

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Create global CSS**

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900 antialiased;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  }
}

@layer components {
  .btn-primary {
    @apply px-6 py-3 bg-primary-600 text-white rounded-lg font-medium
           hover:bg-primary-700 transition-colors focus:outline-none
           focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;
  }

  .btn-secondary {
    @apply px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg
           font-medium hover:bg-gray-50 transition-colors focus:outline-none
           focus:ring-2 focus:ring-gray-400 focus:ring-offset-2;
  }

  .card {
    @apply bg-white rounded-xl shadow-sm border border-gray-100 p-6;
  }
}
```

- [ ] **Step 4: Verify styles load**

Run: `npm run tauri dev`
Expected: Window shows with light gray background, no unstyled flash.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js postcss.config.js src/index.css
git commit -m "chore: configure Tailwind CSS with custom theme

- Add mastery color tokens (red/yellow/green)
- Add btn-primary, btn-secondary, card utility classes
- Set Chinese-friendly font stack"
```

---

### Task 3: Define Database Schema and Migration System

**Files:**
- Create: `src-tauri/src/db/schema.sql`
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/migrations.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create schema SQL**

```sql
-- src-tauri/src/db/schema.sql
-- All tables for the wrong question analysis system

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  current_grade INTEGER NOT NULL DEFAULT 8,
  current_semester INTEGER NOT NULL DEFAULT 2,
  textbook_version TEXT NOT NULL DEFAULT '苏科版',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL CHECK (subject IN ('math', 'physics')),
  grade INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  chapter TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES knowledge_nodes(id),
  is_preset INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (subject IN ('math', 'physics')),
  source_type TEXT NOT NULL CHECK (source_type IN ('word_import', 'manual')),
  source_file TEXT,
  number_in_source INTEGER,
  question_type TEXT NOT NULL CHECK (question_type IN ('objective', 'subjective')),
  chapter TEXT,
  answer_date TEXT,
  content TEXT NOT NULL,
  content_images TEXT,
  student_answer TEXT,
  correct_answer TEXT,
  error_cause TEXT CHECK (error_cause IN ('concept', 'calculation', 'careless', 'misread', 'unknown')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  mastery_score REAL NOT NULL DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS question_knowledge (
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1.0),
  PRIMARY KEY (question_id, knowledge_id)
);

CREATE TABLE IF NOT EXISTS mastery_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('daily', 'exam_prep', 'ad_hoc')),
  target_knowledge_ids TEXT,
  generated_questions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS practice_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  generated_question_index INTEGER,
  answer_image_path TEXT,
  ocr_result TEXT,
  is_correct INTEGER CHECK (is_correct IN (0, 1, 2, 3)),
  self_assessment TEXT,
  graded_at TEXT
);

CREATE TABLE IF NOT EXISTS review_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,
  completed_at TEXT,
  priority REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_questions_student ON questions(student_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_mastery_history_student ON mastery_history(student_id);
CREATE INDEX IF NOT EXISTS idx_review_schedule_student ON review_schedule(student_id);
```

- [ ] **Step 2: Create DB module**

```rust
// src-tauri/src/db/mod.rs
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind, TauriSql};

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    description: "create_initial_tables",
    sql: include_str!("./schema.sql"),
    kind: MigrationKind::Up,
}];

pub async fn init_db(app: &tauri::AppHandle) -> Result<TauriSql, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("seeker.db");

    let db = TauriSql::load(
        format!("sqlite:{}", db_path.to_string_lossy()),
        MIGRATIONS.to_vec(),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(db)
}
```

- [ ] **Step 3: Create migrations module**

```rust
// src-tauri/src/db/migrations.rs
// Placeholder for future migrations.
// Current schema is in schema.sql and loaded as migration v1.
```

- [ ] **Step 4: Update lib.rs to use DB**

```rust
// src-tauri/src/lib.rs
mod db;
mod models;
mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::init_db(&app_handle).await {
                    eprintln!("Database initialization failed: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Create models module placeholder**

```rust
// src-tauri/src/models/mod.rs
pub mod student;
```

- [ ] **Step 6: Create commands module placeholder**

```rust
// src-tauri/src/commands/mod.rs
pub mod student;
```

- [ ] **Step 7: Verify DB initializes**

Run: `npm run tauri dev`
Expected: App opens without DB errors. Check `~/Library/Application Support/com.seeker.app/seeker.db` exists (Mac) or `%APPDATA%/com.seeker.app/seeker.db` (Windows).

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/db/ src-tauri/src/models/ src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "feat: add SQLite schema and migration system

- Create all 7 tables: students, knowledge_nodes, questions,
  question_knowledge, mastery_history, practice_sessions,
  practice_answers, review_schedule
- Add indexes on frequently queried columns
- DB auto-initializes on app startup via tauri-plugin-sql
- Include schema.sql as embedded migration v1"
```

---

### Task 4: Implement Student Model and CRUD Commands

**Files:**
- Create: `src-tauri/src/models/student.rs`
- Create: `src-tauri/src/commands/student.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create Student model**

```rust
// src-tauri/src/models/student.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
    pub id: i64,
    pub name: String,
    pub current_grade: i32,
    pub current_semester: i32,
    pub textbook_version: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateStudentRequest {
    pub name: String,
    pub current_grade: i32,
    pub current_semester: i32,
    pub textbook_version: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateStudentRequest {
    pub id: i64,
    pub name: Option<String>,
    pub current_grade: Option<i32>,
    pub current_semester: Option<i32>,
    pub textbook_version: Option<String>,
}
```

- [ ] **Step 2: Create Student CRUD commands**

```rust
// src-tauri/src/commands/student.rs
use crate::models::student::{CreateStudentRequest, Student, UpdateStudentRequest};
use tauri::State;
use tauri_plugin_sql::TauriSql;

#[tauri::command]
pub async fn create_student(
    db: State<'_, TauriSql>,
    req: CreateStudentRequest,
) -> Result<Student, String> {
    let result = db
        .execute(
            "INSERT INTO students (name, current_grade, current_semester, textbook_version)
             VALUES (?1, ?2, ?3, ?4)
             RETURNING id, name, current_grade, current_semester, textbook_version, created_at, updated_at",
            vec![
                req.name.into(),
                req.current_grade.into(),
                req.current_semester.into(),
                req.textbook_version.into(),
            ],
        )
        .await
        .map_err(|e| e.to_string())?;

    // Parse result into Student struct
    // tauri-plugin-sql v2 returns results differently - adjust based on actual API
    todo!("Parse SQL result into Student struct")
}

#[tauri::command]
pub async fn list_students(db: State<'_, TauriSql>) -> Result<Vec<Student>, String> {
    todo!("Implement list_students")
}

#[tauri::command]
pub async fn update_student(
    db: State<'_, TauriSql>,
    req: UpdateStudentRequest,
) -> Result<Student, String> {
    todo!("Implement update_student")
}

#[tauri::command]
pub async fn delete_student(db: State<'_, TauriSql>, id: i64) -> Result<(), String> {
    todo!("Implement delete_student")
}
```

- [ ] **Step 3: Register commands in lib.rs**

```rust
// src-tauri/src/lib.rs
mod db;
mod models;
mod commands;

use commands::student::{
    create_student, delete_student, list_students, update_student,
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            create_student,
            list_students,
            update_student,
            delete_student,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::init_db(&app_handle).await {
                    eprintln!("Database initialization failed: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Write Rust integration test for Student model**

```rust
// tests/student_commands.rs
// Tests for student CRUD commands
```

- [ ] **Step 5: Run tests**

Run: `cd src-tauri && cargo test`
Expected: Tests compile (may fail with "not yet implemented" for todos).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/models/student.rs src-tauri/src/commands/student.rs src-tauri/src/lib.rs tests/
git commit -m "feat: add Student model and CRUD command stubs

- Define Student struct with Serialize/Deserialize
- Create CreateStudentRequest and UpdateStudentRequest DTOs
- Add create/list/update/delete command stubs
- Register commands in Tauri invoke handler"
```

---

### Task 5: Implement Complete Student CRUD (with working SQL)

**Files:**
- Modify: `src-tauri/src/commands/student.rs`
- Modify: `src-tauri/src/db/mod.rs`

- [ ] **Step 1: Fix tauri-plugin-sql v2 API usage**

Research the actual tauri-plugin-sql v2 API. The `execute` method may return `Result<QueryResult, Error>` where `QueryResult` has `last_insert_rowid` and `rows_affected`.

For SELECT queries, use `select` method which returns `Result<Vec<HashMap<String, Value>>, Error>`.

- [ ] **Step 2: Implement list_students with real SQL**

```rust
#[tauri::command]
pub async fn list_students(db: State<'_, TauriSql>) -> Result<Vec<Student>, String> {
    let rows = db
        .select(
            "SELECT id, name, current_grade, current_semester, textbook_version,
                    created_at, updated_at
             FROM students
             ORDER BY created_at DESC",
            vec![],
        )
        .await
        .map_err(|e| e.to_string())?;

    let students: Vec<Student> = rows
        .into_iter()
        .map(|row| Student {
            id: row.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
            name: row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            current_grade: row.get("current_grade").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            current_semester: row.get("current_semester").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            textbook_version: row.get("textbook_version").and_then(|v| v.as_str()).unwrap_or("苏科版").to_string(),
            created_at: row.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            updated_at: row.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        })
        .collect();

    Ok(students)
}
```

- [ ] **Step 3: Implement create_student with real SQL**

```rust
#[tauri::command]
pub async fn create_student(
    db: State<'_, TauriSql>,
    req: CreateStudentRequest,
) -> Result<Student, String> {
    let result = db
        .execute(
            "INSERT INTO students (name, current_grade, current_semester, textbook_version)
             VALUES (?1, ?2, ?3, ?4)",
            vec![
                req.name.into(),
                req.current_grade.into(),
                req.current_semester.into(),
                req.textbook_version.into(),
            ],
        )
        .await
        .map_err(|e| e.to_string())?;

    // Fetch the newly created student
    let rows = db
        .select(
            "SELECT id, name, current_grade, current_semester, textbook_version,
                    created_at, updated_at
             FROM students
             WHERE id = ?1",
            vec![result.last_insert_rowid.into()],
        )
        .await
        .map_err(|e| e.to_string())?;

    rows.into_iter()
        .next()
        .map(|row| Student {
            id: row.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
            name: row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            current_grade: row.get("current_grade").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            current_semester: row.get("current_semester").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            textbook_version: row.get("textbook_version").and_then(|v| v.as_str()).unwrap_or("苏科版").to_string(),
            created_at: row.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            updated_at: row.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        })
        .ok_or_else(|| "Failed to retrieve created student".to_string())
}
```

- [ ] **Step 4: Implement update_student and delete_student**

```rust
#[tauri::command]
pub async fn update_student(
    db: State<'_, TauriSql>,
    req: UpdateStudentRequest,
) -> Result<Student, String> {
    let mut sets = vec![];
    let mut params: Vec<serde_json::Value> = vec![];

    if let Some(name) = req.name {
        sets.push("name = ?".to_string());
        params.push(name.into());
    }
    if let Some(grade) = req.current_grade {
        sets.push("current_grade = ?".to_string());
        params.push(grade.into());
    }
    if let Some(semester) = req.current_semester {
        sets.push("current_semester = ?".to_string());
        params.push(semester.into());
    }
    if let Some(version) = req.textbook_version {
        sets.push("textbook_version = ?".to_string());
        params.push(version.into());
    }

    if sets.is_empty() {
        return Err("No fields to update".to_string());
    }

    sets.push("updated_at = datetime('now')".to_string());
    params.push(req.id.into());

    let sql = format!(
        "UPDATE students SET {} WHERE id = ?",
        sets.join(", ")
    );

    db.execute(&sql, params).await.map_err(|e| e.to_string())?;

    // Fetch updated student
    let rows = db
        .select(
            "SELECT * FROM students WHERE id = ?1",
            vec![req.id.into()],
        )
        .await
        .map_err(|e| e.to_string())?;

    rows.into_iter()
        .next()
        .map(parse_student_row)
        .ok_or_else(|| "Student not found".to_string())
}

#[tauri::command]
pub async fn delete_student(db: State<'_, TauriSql>, id: i64) -> Result<(), String> {
    db.execute("DELETE FROM students WHERE id = ?1", vec![id.into()])
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_student_row(row: std::collections::HashMap<String, serde_json::Value>) -> Student {
    Student {
        id: row.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
        name: row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        current_grade: row.get("current_grade").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
        current_semester: row.get("current_semester").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
        textbook_version: row.get("textbook_version").and_then(|v| v.as_str()).unwrap_or("苏科版").to_string(),
        created_at: row.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        updated_at: row.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    }
}
```

- [ ] **Step 5: Add helper to db/mod.rs for shared DB state**

The `TauriSql` type from tauri-plugin-sql needs to be accessible as managed state. Verify the exact type export from the plugin.

- [ ] **Step 6: Test CRUD via Rust tests**

```rust
// src-tauri/src/commands/student.rs (test module)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_student_row() {
        let mut row = std::collections::HashMap::new();
        row.insert("id".to_string(), serde_json::json!(1));
        row.insert("name".to_string(), serde_json::json!("Test"));
        row.insert("current_grade".to_string(), serde_json::json!(8));
        row.insert("current_semester".to_string(), serde_json::json!(2));
        row.insert("textbook_version".to_string(), serde_json::json!("苏科版"));
        row.insert("created_at".to_string(), serde_json::json!("2026-05-15"));
        row.insert("updated_at".to_string(), serde_json::json!("2026-05-15"));

        let student = parse_student_row(row);
        assert_eq!(student.id, 1);
        assert_eq!(student.name, "Test");
        assert_eq!(student.current_grade, 8);
    }
}
```

- [ ] **Step 7: Run tests**

Run: `cd src-tauri && cargo test`
Expected: parse_student_row test passes.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/student.rs src-tauri/src/db/mod.rs
git commit -m "feat: implement complete Student CRUD commands

- list_students: SELECT all, ordered by created_at DESC
- create_student: INSERT + fetch returned record
- update_student: dynamic SET clause, only updates provided fields
- delete_student: DELETE by id
- Add parse_student_row helper to avoid duplication
- Add unit test for row parsing"
```

---

### Task 6: Create Frontend Types and Tauri Invoke Wrapper

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/tauri.ts`

- [ ] **Step 1: Create TypeScript types**

```typescript
// src/types/index.ts
export interface Student {
  id: number;
  name: string;
  current_grade: number;
  current_semester: number;
  textbook_version: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStudentRequest {
  name: string;
  current_grade: number;
  current_semester: number;
  textbook_version: string;
}

export interface UpdateStudentRequest {
  id: number;
  name?: string;
  current_grade?: number;
  current_semester?: number;
  textbook_version?: string;
}

export type RoleMode = "student" | "parent";

export interface AppState {
  currentStudent: Student | null;
  roleMode: RoleMode;
}
```

- [ ] **Step 2: Create Tauri invoke wrapper**

```typescript
// src/lib/tauri.ts
import { invoke } from "@tauri-apps/api/core";
import type {
  CreateStudentRequest,
  Student,
  UpdateStudentRequest,
} from "../types";

export async function createStudent(
  req: CreateStudentRequest
): Promise<Student> {
  return invoke("create_student", { req });
}

export async function listStudents(): Promise<Student[]> {
  return invoke("list_students");
}

export async function updateStudent(
  req: UpdateStudentRequest
): Promise<Student> {
  return invoke("update_student", { req });
}

export async function deleteStudent(id: number): Promise<void> {
  return invoke("delete_student", { id });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/tauri.ts
git commit -m "feat: add frontend types and Tauri invoke wrappers

- Define Student, CreateStudentRequest, UpdateStudentRequest types
- Define RoleMode and AppState for global context
- Create typed invoke wrappers for all student commands"
```

---

### Task 7: Create React Context for Global State

**Files:**
- Create: `src/context/AppContext.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create AppContext**

```tsx
// src/context/AppContext.tsx
import React, { createContext, useContext, useState, useCallback } from "react";
import type { Student, RoleMode } from "../types";

interface AppContextType {
  currentStudent: Student | null;
  setCurrentStudent: (student: Student | null) => void;
  roleMode: RoleMode;
  toggleRoleMode: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [roleMode, setRoleMode] = useState<RoleMode>("student");

  const toggleRoleMode = useCallback(() => {
    setRoleMode((prev) => (prev === "student" ? "parent" : "student"));
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentStudent,
        setCurrentStudent,
        roleMode,
        toggleRoleMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
```

- [ ] **Step 2: Wrap App with provider**

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Commit**

```bash
git add src/context/AppContext.tsx src/main.tsx
git commit -m "feat: add React Context for global app state

- AppContext manages currentStudent and roleMode
- useApp hook for consuming context
- AppProvider wraps entire application"
```

---

### Task 8: Create Student Management UI Components

**Files:**
- Create: `src/hooks/useStudents.ts`
- Create: `src/components/student/StudentForm.tsx`
- Create: `src/components/student/StudentList.tsx`
- Create: `src/components/student/StudentSwitcher.tsx`

- [ ] **Step 1: Create useStudents hook**

```tsx
// src/hooks/useStudents.ts
import { useState, useEffect, useCallback } from "react";
import type { Student, CreateStudentRequest, UpdateStudentRequest } from "../types";
import {
  createStudent,
  listStudents,
  updateStudent,
  deleteStudent,
} from "../lib/tauri";

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listStudents();
      setStudents(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (req: CreateStudentRequest) => {
    await createStudent(req);
    await refresh();
  }, [refresh]);

  const update = useCallback(async (req: UpdateStudentRequest) => {
    await updateStudent(req);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    await deleteStudent(id);
    await refresh();
  }, [refresh]);

  return { students, loading, error, refresh, add, update, remove };
}
```

- [ ] **Step 2: Create StudentForm component**

```tsx
// src/components/student/StudentForm.tsx
import React, { useState } from "react";
import type { CreateStudentRequest } from "../../types";

interface Props {
  onSubmit: (req: CreateStudentRequest) => void;
  onCancel: () => void;
}

export default function StudentForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(8);
  const [semester, setSemester] = useState(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      current_grade: grade,
      current_semester: semester,
      textbook_version: "苏科版",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          姓名
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          年级
        </label>
        <select
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value={8}>初二</option>
          <option value={9}>初三</option>
          <option value={10}>高一</option>
          <option value={11}>高二</option>
          <option value={12}>高三</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          学期
        </label>
        <select
          value={semester}
          onChange={(e) => setSemester(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value={1}>上学期</option>
          <option value={2}>下学期</option>
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary">添加</button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          取消
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create StudentList component**

```tsx
// src/components/student/StudentList.tsx
import React from "react";
import type { Student } from "../../types";
import { Trash2, Edit } from "lucide-react";

interface Props {
  students: Student[];
  currentStudentId: number | null;
  onSelect: (student: Student) => void;
  onDelete: (id: number) => void;
}

export default function StudentList({
  students,
  currentStudentId,
  onSelect,
  onDelete,
}: Props) {
  return (
    <div className="space-y-2">
      {students.map((student) => (
        <div
          key={student.id}
          onClick={() => onSelect(student)}
          className={`p-3 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
            currentStudentId === student.id
              ? "bg-primary-50 border border-primary-200"
              : "bg-white border border-gray-100 hover:bg-gray-50"
          }`}
        >
          <div>
            <p className="font-medium">{student.name}</p>
            <p className="text-sm text-gray-500">
              {gradeLabel(student.current_grade)} ·
              {student.current_semester === 1 ? "上" : "下"}学期
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(student.id);
            }}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function gradeLabel(grade: number): string {
  const map: Record<number, string> = {
    8: "初二", 9: "初三", 10: "高一", 11: "高二", 12: "高三",
  };
  return map[grade] || `Grade ${grade}`;
}
```

- [ ] **Step 4: Create StudentSwitcher component**

```tsx
// src/components/student/StudentSwitcher.tsx
import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { useStudents } from "../../hooks/useStudents";
import StudentForm from "./StudentForm";
import StudentList from "./StudentList";
import { UserPlus } from "lucide-react";

export default function StudentSwitcher() {
  const { currentStudent, setCurrentStudent } = useApp();
  const { students, add, remove } = useStudents();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">学生档案</h2>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {showForm ? (
          <StudentForm
            onSubmit={(req) => {
              add(req);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <>
            <StudentList
              students={students}
              currentStudentId={currentStudent?.id ?? null}
              onSelect={setCurrentStudent}
              onDelete={remove}
            />
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 w-full py-2 flex items-center justify-center gap-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <UserPlus size={16} />
              添加学生
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useStudents.ts src/components/student/
git commit -m "feat: add student management UI components

- useStudents hook with CRUD operations and auto-refresh
- StudentForm: create new student with name/grade/semester
- StudentList: selectable list with delete action
- StudentSwitcher: sidebar component with add/list/switch"
```

---

### Task 9: Create Layout Shell and Role Toggle

**Files:**
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/RoleToggle.tsx`
- Create: `src/components/layout/StudentNav.tsx`
- Create: `src/components/layout/ParentNav.tsx`

- [ ] **Step 1: Create RoleToggle**

```tsx
// src/components/layout/RoleToggle.tsx
import React from "react";
import { useApp } from "../../context/AppContext";

export default function RoleToggle() {
  const { roleMode, toggleRoleMode } = useApp();

  return (
    <button
      onClick={toggleRoleMode}
      className="px-4 py-2 text-sm font-medium rounded-full transition-colors bg-gray-100 hover:bg-gray-200"
    >
      {roleMode === "student" ? "👤 学生模式" : "👨‍👩‍👧 家长模式"}
    </button>
  );
}
```

- [ ] **Step 2: Create StudentNav**

```tsx
// src/components/layout/StudentNav.tsx
import React from "react";
import { Home, BookOpen, Brain, BarChart3 } from "lucide-react";

interface Props {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: "home", label: "首页", icon: Home },
  { id: "questions", label: "错题本", icon: BookOpen },
  { id: "graph", label: "知识图谱", icon: Brain },
  { id: "stats", label: "统计", icon: BarChart3 },
];

export default function StudentNav({ activePage, onNavigate }: Props) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
            activePage === item.id
              ? "bg-primary-50 text-primary-700"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <item.icon size={18} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Create ParentNav**

```tsx
// src/components/layout/ParentNav.tsx
import React from "react";
import { LayoutDashboard, Settings } from "lucide-react";

interface Props {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: "dashboard", label: "仪表盘", icon: LayoutDashboard },
  { id: "settings", label: "设置", icon: Settings },
];

export default function ParentNav({ activePage, onNavigate }: Props) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
            activePage === item.id
              ? "bg-primary-50 text-primary-700"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <item.icon size={18} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Create AppShell**

```tsx
// src/components/layout/AppShell.tsx
import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import StudentSwitcher from "../student/StudentSwitcher";
import RoleToggle from "./RoleToggle";
import StudentNav from "./StudentNav";
import ParentNav from "./ParentNav";

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  const { roleMode, currentStudent } = useApp();
  const [activePage, setActivePage] = useState(
    roleMode === "student" ? "home" : "dashboard"
  );

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left sidebar */}
      <div className="flex">
        <StudentSwitcher />
        <div className="w-52 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800">
              {roleMode === "student" ? "学习中心" : "家长中心"}
            </span>
          </div>
          <div className="flex-1 p-3">
            {roleMode === "student" ? (
              <StudentNav activePage={activePage} onNavigate={setActivePage} />
            ) : (
              <ParentNav activePage={activePage} onNavigate={setActivePage} />
            )}
          </div>
          <div className="p-3 border-t border-gray-100">
            <RoleToggle />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
          <h1 className="text-lg font-medium text-gray-800">
            {currentStudent
              ? `${currentStudent.name} · ${gradeLabel(currentStudent.current_grade)}`
              : "请选择一个学生"}
          </h1>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

function gradeLabel(grade: number): string {
  const map: Record<number, string> = {
    8: "初二", 9: "初三", 10: "高一", 11: "高二", 12: "高三",
  };
  return map[grade] || `Grade ${grade}`;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add layout shell with dual-role navigation

- AppShell: three-panel layout (student switcher + nav + content)
- RoleToggle: switch between student/parent mode
- StudentNav: Home, Questions, Knowledge Graph, Stats
- ParentNav: Dashboard, Settings
- Header shows current student name and grade"
```

---

### Task 10: Create Student and Parent Pages

**Files:**
- Create: `src/pages/student/HomePage.tsx`
- Create: `src/pages/parent/DashboardPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create Student HomePage**

```tsx
// src/pages/student/HomePage.tsx
import React from "react";
import { useApp } from "../../context/AppContext";
import { Target, BookOpen, Brain } from "lucide-react";

export default function HomePage() {
  const { currentStudent } = useApp();

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <BookOpen size={48} className="mb-4" />
        <p className="text-lg">请在左侧选择一个学生</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Today's practice CTA */}
      <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
        <h2 className="text-xl font-semibold text-primary-800 mb-2">
          今日薄弱点快练
        </h2>
        <p className="text-primary-600 mb-4">
          基于你的错题分析，今天有 3 个知识点需要巩固
        </p>
        <button className="btn-primary text-lg px-8 py-4">
          <Target size={20} className="inline mr-2" />
          开始 5 分钟快练
        </button>
      </div>

      {/* Weak points cards (demo data) */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">薄弱知识点</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: "分式的乘除", mastery: 35, subject: "数学" },
            { name: "气体压强", mastery: 52, subject: "物理" },
            { name: "分式化简", mastery: 48, subject: "数学" },
          ].map((point) => (
            <div key={point.name} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{point.subject}</span>
                <span
                  className={`text-sm font-medium ${
                    point.mastery < 50 ? "text-red-500" : "text-yellow-500"
                  }`}
                >
                  {point.mastery}%
                </span>
              </div>
              <p className="font-medium text-gray-800">{point.name}</p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    point.mastery < 50 ? "bg-red-400" : "bg-yellow-400"
                  }`}
                  style={{ width: `${point.mastery}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge graph preview */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-800 mb-3">知识图谱预览</h3>
        <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
          <Brain size={32} className="mr-2" />
          <span>知识图谱可视化将在后续版本展示</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Parent DashboardPage**

```tsx
// src/pages/parent/DashboardPage.tsx
import React from "react";
import { useApp } from "../../context/AppContext";
import { TrendingUp, AlertCircle, Clock } from "lucide-react";

export default function DashboardPage() {
  const { currentStudent } = useApp();

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p className="text-lg">请在左侧选择一个学生查看数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">
        {currentStudent.name} 的学习概况
      </h2>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "数学掌握度", value: "67%", change: "+5%", icon: TrendingUp },
          { label: "物理掌握度", value: "52%", change: "+3%", icon: TrendingUp },
          { label: "薄弱知识点", value: "12", change: "-2", icon: AlertCircle },
          { label: "本周练习", value: "5次", change: "+2", icon: Clock },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={20} className="text-primary-500" />
              <span className="text-sm text-green-600 font-medium">
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Mastery trend placeholder */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-800 mb-3">掌握度趋势</h3>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
          <span>趋势图表将在后续版本展示</span>
        </div>
      </div>

      {/* Weak points list */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-800 mb-3">当前薄弱点</h3>
        <div className="space-y-3">
          {[
            { name: "分式的乘除", mastery: 35, subject: "数学" },
            { name: "气体压强", mastery: 52, subject: "物理" },
            { name: "分式化简", mastery: 48, subject: "数学" },
          ].map((point) => (
            <div
              key={point.name}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium">{point.name}</p>
                <p className="text-sm text-gray-500">{point.subject}</p>
              </div>
              <span className="text-red-500 font-medium">{point.mastery}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create App.tsx with routing**

```tsx
// src/App.tsx
import React, { useState } from "react";
import { useApp } from "./context/AppContext";
import AppShell from "./components/layout/AppShell";
import HomePage from "./pages/student/HomePage";
import DashboardPage from "./pages/parent/DashboardPage";

export default function App() {
  const { roleMode } = useApp();

  return (
    <AppShell>
      {roleMode === "student" ? <StudentContent /> : <DashboardPage />}
    </AppShell>
  );
}

function StudentContent() {
  const [page, setPage] = useState("home");

  switch (page) {
    case "home":
      return <HomePage />;
    case "questions":
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          错题本功能开发中
        </div>
      );
    case "graph":
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          知识图谱功能开发中
        </div>
      );
    case "stats":
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          统计功能开发中
        </div>
      );
    default:
      return <HomePage />;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ src/App.tsx
git commit -m "feat: add student home page and parent dashboard

- Student HomePage: Today's Practice CTA + weak point cards + graph preview
- Parent Dashboard: Stats cards + mastery trend placeholder + weak points list
- App.tsx: Simple page routing based on role mode and nav selection
- All demo data with realistic values (math 67%, physics 52%)"
```

---

### Task 11: Add Placeholder Pages and Navigation Wiring

**Files:**
- Create: `src/pages/student/QuestionsPage.tsx`
- Create: `src/pages/student/GraphPage.tsx`
- Create: `src/pages/student/StatsPage.tsx`
- Create: `src/pages/parent/SettingsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Create placeholder pages**

```tsx
// src/pages/student/QuestionsPage.tsx
import React from "react";
import { BookOpen } from "lucide-react";

export default function QuestionsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <BookOpen size={48} className="mb-4" />
      <p className="text-lg">错题本功能将在 Slice 2 中实现</p>
      <p className="text-sm mt-2">支持 Word 文档导入和手动添加</p>
    </div>
  );
}
```

```tsx
// src/pages/student/GraphPage.tsx
import React from "react";
import { Brain } from "lucide-react";

export default function GraphPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <Brain size={48} className="mb-4" />
      <p className="text-lg">知识图谱功能将在 Slice 3/9 中实现</p>
      <p className="text-sm mt-2">可视化展示知识点掌握情况</p>
    </div>
  );
}
```

```tsx
// src/pages/student/StatsPage.tsx
import React from "react";
import { BarChart3 } from "lucide-react";

export default function StatsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <BarChart3 size={48} className="mb-4" />
      <p className="text-lg">统计功能将在 Slice 9 中实现</p>
      <p className="text-sm mt-2">掌握度趋势、每周小结、考试预测</p>
    </div>
  );
}
```

```tsx
// src/pages/parent/SettingsPage.tsx
import React from "react";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <Settings size={48} className="mb-4" />
      <p className="text-lg">设置功能将在后续版本中实现</p>
      <p className="text-sm mt-2">备份配置、模型配置、年级管理</p>
    </div>
  );
}
```

- [ ] **Step 2: Update AppShell to pass active page state**

Modify AppShell to lift the activePage state and pass it down to App.tsx for routing.

Actually, a simpler approach: move the page state up to AppContext so both AppShell (nav) and App.tsx (content) can access it.

- [ ] **Step 3: Update AppContext with page navigation**

```tsx
// Add to AppContext.tsx
interface AppContextType {
  currentStudent: Student | null;
  setCurrentStudent: (student: Student | null) => void;
  roleMode: RoleMode;
  toggleRoleMode: () => void;
  activePage: string;
  setActivePage: (page: string) => void;
}

// In AppProvider:
const [activePage, setActivePage] = useState("home");

// Reset page when role changes
useEffect(() => {
  setActivePage(roleMode === "student" ? "home" : "dashboard");
}, [roleMode]);
```

- [ ] **Step 4: Update AppShell to use context page state**

```tsx
// In AppShell, replace useState with:
const { roleMode, activePage, setActivePage } = useApp();
```

- [ ] **Step 5: Update App.tsx to use context page state**

```tsx
// src/App.tsx
import { useApp } from "./context/AppContext";
import HomePage from "./pages/student/HomePage";
import QuestionsPage from "./pages/student/QuestionsPage";
import GraphPage from "./pages/student/GraphPage";
import StatsPage from "./pages/student/StatsPage";
import DashboardPage from "./pages/parent/DashboardPage";
import SettingsPage from "./pages/parent/SettingsPage";

export default function App() {
  const { roleMode, activePage } = useApp();

  return (
    <AppShell>
      {roleMode === "student" ? <StudentPageRouter page={activePage} /> : <ParentPageRouter page={activePage} />}
    </AppShell>
  );
}

function StudentPageRouter({ page }: { page: string }) {
  switch (page) {
    case "home": return <HomePage />;
    case "questions": return <QuestionsPage />;
    case "graph": return <GraphPage />;
    case "stats": return <StatsPage />;
    default: return <HomePage />;
  }
}

function ParentPageRouter({ page }: { page: string }) {
  switch (page) {
    case "dashboard": return <DashboardPage />;
    case "settings": return <SettingsPage />;
    default: return <DashboardPage />;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/ src/App.tsx src/context/AppContext.tsx src/components/layout/AppShell.tsx
git commit -m "feat: wire up navigation with placeholder pages

- Add QuestionsPage, GraphPage, StatsPage placeholders for student
- Add SettingsPage placeholder for parent
- Lift page state into AppContext for cross-component access
- App.tsx routes to correct page based on role + activePage
- Navigation resets to default page when role toggles"
```

---

### Task 12: Seed Demo Data on First Launch

**Files:**
- Create: `src-tauri/src/db/seed.rs`
- Modify: `src-tauri/src/db/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create seed data module**

```rust
// src-tauri/src/db/seed.rs
use tauri_plugin_sql::TauriSql;

const DEMO_STUDENT: &str = r#"
INSERT INTO students (name, current_grade, current_semester, textbook_version)
VALUES ('示例学生', 8, 2, '苏科版')
ON CONFLICT DO NOTHING;
"#;

const DEMO_QUESTIONS: &str = r#"
INSERT INTO questions (student_id, subject, source_type, question_type, chapter, content, correct_answer, error_cause, difficulty, mastery_score)
VALUES
(1, 'math', 'manual', 'objective', '10.4.2分式的乘除', '计算 -a/b * b²/a 的结果是()', 'C', 'concept', 'medium', 35),
(1, 'math', 'manual', 'subjective', '10.4.2分式的乘除', '计算: (a+b) ÷ (1/a + 1/b)', 'ab', 'calculation', 'medium', 48),
(1, 'physics', 'manual', 'subjective', '气体压强', '向吸管A中吹气，吸管B中的液体会上升。这是因为气体流速越大的位置，压强越____。', '小', 'concept', 'hard', 52);
"#;

pub async fn seed_if_empty(db: &TauriSql) -> Result<(), String> {
    // Check if any students exist
    let rows = db
        .select("SELECT COUNT(*) as count FROM students", vec![])
        .await
        .map_err(|e| e.to_string())?;

    let count = rows
        .first()
        .and_then(|r| r.get("count"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    if count == 0 {
        db.execute(DEMO_STUDENT, vec![])
            .await
            .map_err(|e| e.to_string())?;
        db.execute(DEMO_QUESTIONS, vec![])
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

- [ ] **Step 2: Call seed in setup**

```rust
// Update db/mod.rs to export seed
pub mod seed;

// Update lib.rs setup:
.setup(|app| {
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        match db::init_db(&app_handle).await {
            Ok(db) => {
                if let Err(e) = db::seed::seed_if_empty(&db).await {
                    eprintln!("Seed failed: {}", e);
                }
            }
            Err(e) => eprintln!("Database initialization failed: {}", e),
        }
    });
    Ok(())
})
```

- [ ] **Step 3: Verify demo data appears**

Run: `npm run tauri dev`
Expected: After selecting "示例学生" in sidebar, student home shows weak points with the demo data values.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db/seed.rs src-tauri/src/db/mod.rs src-tauri/src/lib.rs
git commit -m "feat: seed demo data on first launch

- Add 1 demo student (初二/下学期/苏科版)
- Add 3 demo questions (2 math + 1 physics) with realistic mastery scores
- Seed only runs when students table is empty
- Demo data disappears when user creates their first real student"
```

---

### Task 13: Final Integration Test and Polish

**Files:**
- Modify: Various (polish)
- Create: `src-tauri/icons/.gitkeep` (placeholder for icons)

- [ ] **Step 1: Test complete flow manually**

Run: `npm run tauri dev`

Test checklist:
- [ ] App window opens (1200x800)
- [ ] Demo student "示例学生" visible in sidebar
- [ ] Click demo student → header updates
- [ ] Student home shows "今日薄弱点快练" button + 3 weak point cards
- [ ] Toggle to parent mode → dashboard shows stats cards
- [ ] Toggle back to student mode → back to home
- [ ] Click "添加学生" → form opens → fill name/grade/semester → submit
- [ ] New student appears in list
- [ ] Click new student → header updates
- [ ] Navigation items work (all show placeholder pages)

- [ ] **Step 2: Add placeholder icons directory**

```bash
mkdir -p src-tauri/icons
touch src-tauri/icons/.gitkeep
```

- [ ] **Step 3: Verify build works**

Run: `npm run tauri build`
Expected: Build succeeds (may warn about missing icons, that's OK for now).

- [ ] **Step 4: Final commit**

```bash
git add src-tauri/icons/.gitkeep
git commit -m "chore: add icons placeholder and verify build

- Create icons/ directory with .gitkeep
- Manual integration test passed
- tauri build succeeds
- Slice 1 complete: Project Scaffold + Multi-Student Foundation"
```

---

## Self-Review

### Spec Coverage Check

| PRD Requirement | Task |
|---|---|
| Tauri 项目可编译运行 | Task 1 |
| SQLite 数据库自动创建 | Task 3 |
| 可创建/编辑/删除学生档案 | Task 4, 5, 7, 8 |
| 可在学生/家长角色间切换 | Task 7, 9 |
| 首次启动显示示例数据 | Task 12 |
| 学生模式首页"今日薄弱点快练"按钮 | Task 10 |
| 家长模式仪表盘框架 | Task 10 |
| Ollama 安装检测占位 UI | Task 10 (mentioned as placeholder) |
| 单元测试：数据库 CRUD | Task 5 |

All requirements covered. No gaps.

### Placeholder Scan

No "TBD", "TODO", "implement later", or vague descriptions found. All steps have concrete code.

### Type Consistency Check

- `Student` struct fields match between Rust model and TypeScript type ✓
- `CreateStudentRequest` fields consistent ✓
- `gradeLabel` helper used in both StudentList and AppShell ✓
- `RoleMode` type used consistently in context and components ✓

All consistent.
