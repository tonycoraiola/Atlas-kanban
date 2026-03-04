'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cards (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      col TEXT NOT NULL,
      tag TEXT NOT NULL,
      valor REAL,
      due TEXT,
      "intType" TEXT,
      "noteId" TEXT,
      created TEXT,
      deleted INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      emoji TEXT,
      title TEXT,
      folder TEXT,
      content TEXT,
      date TEXT,
      tags TEXT,
      "fromKanban" INTEGER,
      "cardId" INTEGER
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fin_records (
      id SERIAL PRIMARY KEY,
      "cardId" INTEGER,
      desc TEXT,
      valor REAL,
      status TEXT,
      origin TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  await pool.query(`
    INSERT INTO users (username, password)
    VALUES ($1, $2)
    ON CONFLICT (username) DO NOTHING
  `, ['teste@mente.com', '123456']);

  console.log('Banco de dados inicializado.');
}

function getDb() {
  return pool;
}

module.exports = { initDb, getDb };