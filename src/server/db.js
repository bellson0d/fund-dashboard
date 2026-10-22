// SQLite 数据层 - 使用 Node 24 内置 node:sqlite（无需原生依赖）
// 所有表按 user_id 隔离；启动时自动建表，便于首次部署直接运行
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

// 数据目录：容器内通过 DATA_DIR=/data 指向持久卷；本地默认项目下 data/
export const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'data.db')

fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new DatabaseSync(DB_FILE)

// WAL 提升并发读性能；网络卷若不支持共享内存可用 SQLITE_JOURNAL_MODE=DELETE 覆盖
const journalMode = (process.env.SQLITE_JOURNAL_MODE || 'WAL').toUpperCase()
db.exec(`PRAGMA journal_mode = ${journalMode === 'DELETE' ? 'DELETE' : 'WAL'}`)
db.exec('PRAGMA busy_timeout = 5000')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS holdings (
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    code TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_at TEXT,
    base_price REAL,
    base_price_failed_at INTEGER,
    PRIMARY KEY (user_id, type, code)
  );

  CREATE TABLE IF NOT EXISTS instrument_info (
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (user_id, type, code)
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    user_id INTEGER NOT NULL,
    id TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    funds_json TEXT NOT NULL,
    stocks_json TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
  );

  CREATE TABLE IF NOT EXISTS change_log (
    user_id INTEGER NOT NULL,
    id TEXT NOT NULL,
    at TEXT NOT NULL,
    type TEXT NOT NULL,
    action TEXT NOT NULL,
    code TEXT,
    name TEXT,
    from_pos INTEGER,
    to_pos INTEGER,
    PRIMARY KEY (user_id, id)
  );
`)

// 统一的事务包装：异常自动回滚
export function withTransaction(fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // 回滚失败时保留原始异常
    }
    throw error
  }
}

// 各表容量上限（与前端原 localStorage 策略保持一致）
export const LIMITS = {
  codes: 200,
  snapshots: 100,
  changes: 500
}
