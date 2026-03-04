'use strict';

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'data.db');
let db;

function initDb() {
  if (db) return db;

  db = new sqlite3.Database(DB_PATH);

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        col TEXT NOT NULL,
        tag TEXT NOT NULL,
        valor REAL,
        due TEXT,
        intType TEXT,
        noteId TEXT,
        created TEXT,
        deleted INTEGER DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        emoji TEXT,
        title TEXT,
        folder TEXT,
        content TEXT,
        date TEXT,
        tags TEXT,
        fromKanban INTEGER,
        cardId INTEGER
      )
    `);

    db.run(`ALTER TABLE cards ADD COLUMN deleted INTEGER DEFAULT 0`, () => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS fin_records (
        id INTEGER PRIMARY KEY,
        cardId INTEGER,
        desc TEXT,
        valor REAL,
        status TEXT,
        origin TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `);

    db.run(
      `INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`,
      ['teste@mente.com', '123456']
    );
  });

  return db;
}

function getDb() {
  if (!db) initDb();
  return db;
}

module.exports = { initDb, getDb };