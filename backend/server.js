'use strict';

const express = require('express');
const cors = require('cors');
const { initDb, getDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// CARDS
// =========================

// Listar cards
app.get('/cards', async (req, res) => {
  const deleted = req.query.deleted === '1' ? 1 : 0;
  try {
    const db = getDb();
    const { rows } = await db.query(
      'SELECT * FROM cards WHERE deleted = $1 ORDER BY id DESC',
      [deleted]
    );
    res.json(rows || []);
  } catch (err) {
    console.error('Erro ao listar cards:', err);
    res.status(500).json({ error: 'Erro ao listar cards' });
  }
});

// Criar novo card
app.post('/cards', async (req, res) => {
  const {
    title,
    col = 'todo',
    tag = 'geral',
    valor = null,
    due = null,
    intType = null,
    noteId = null,
    created = null,
  } = req.body || {};

  if (!title) return res.status(400).json({ error: 'title é obrigatório' });

  const createdAt = created || new Date().toISOString();

  try {
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO cards (title, col, tag, valor, due, "intType", "noteId", created, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0) RETURNING *`,
      [title, col, tag, valor, due, intType, noteId, createdAt]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar card:', err);
    res.status(500).json({ error: 'Erro ao criar card' });
  }
});

// Atualizar card
app.put('/cards/:id', async (req, res) => {
  const { id } = req.params;
  const { title, col, tag, valor = null, due = null, intType = null, noteId = null } = req.body || {};

  if (!title || !col || !tag)
    return res.status(400).json({ error: 'title, col e tag são obrigatórios' });

  try {
    const db = getDb();
    const { rowCount } = await db.query(
      `UPDATE cards SET title=$1, col=$2, tag=$3, valor=$4, due=$5, "intType"=$6, "noteId"=$7 WHERE id=$8`,
      [title, col, tag, valor, due, intType, noteId, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Card não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao atualizar card:', err);
    res.status(500).json({ error: 'Erro ao atualizar card' });
  }
});

// Soft delete
app.delete('/cards/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const { rowCount } = await db.query('UPDATE cards SET deleted = 1 WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Card não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir card:', err);
    res.status(500).json({ error: 'Erro ao excluir card' });
  }
});

// Delete permanente
app.delete('/cards/:id/permanent', async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const { rowCount } = await db.query('DELETE FROM cards WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Card não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir permanentemente:', err);
    res.status(500).json({ error: 'Erro ao excluir permanentemente' });
  }
});

// Restaurar card
app.put('/cards/:id/restore', async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const { rowCount } = await db.query('UPDATE cards SET deleted = 0 WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Card não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao restaurar card:', err);
    res.status(500).json({ error: 'Erro ao restaurar card' });
  }
});

// =========================
// AUTENTICAÇÃO
// =========================

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'username e password são obrigatórios' });

  try {
    const db = getDb();
    const { rows } = await db.query(
      'SELECT id, username FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    console.error('Erro ao autenticar:', err);
    res.status(500).json({ error: 'Erro ao autenticar' });
  }
});

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));

// =========================
// START
// =========================

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  })
  .catch((err) => {
    console.error('Falha ao inicializar banco:', err);
    process.exit(1);
  });