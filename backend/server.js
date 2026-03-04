'use strict';

const express = require('express');
const cors = require('cors');
const { initDb, getDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// inicializa banco/tabelas
initDb();
const db = getDb();

// healthcheck
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// =========================
// CARDS
// =========================

// Listar cards (deleted=0 por padrão, deleted=1 para lixeira)
app.get('/cards', (req, res) => {
  const deleted = req.query.deleted === '1' ? 1 : 0;
  db.all('SELECT * FROM cards WHERE (deleted = ? OR deleted IS NULL) ORDER BY id DESC', [deleted], (err, rows) => {
    if (err) {
      console.error('Erro ao listar cards:', err);
      return res.status(500).json({ error: 'Erro ao listar cards' });
    }
    res.json(rows || []);
  });
});

// Criar novo card
app.post('/cards', (req, res) => {
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

  if (!title) {
    return res.status(400).json({ error: 'title é obrigatório' });
  }

  const createdAt = created || new Date().toISOString();

  const sql = `
    INSERT INTO cards (title, col, tag, valor, due, intType, noteId, created, deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `;

  db.run(
    sql,
    [title, col, tag, valor, due, intType, noteId, createdAt],
    function (err) {
      if (err) {
        console.error('Erro ao criar card:', err);
        return res.status(500).json({ error: 'Erro ao criar card' });
      }

      res.status(201).json({
        id: this.lastID,
        title,
        col,
        tag,
        valor,
        due,
        intType,
        noteId,
        created: createdAt,
      });
    }
  );
});

// Atualizar um card (por id)
app.put('/cards/:id', (req, res) => {
  const { id } = req.params;
  const {
    title,
    col,
    tag,
    valor = null,
    due = null,
    intType = null,
    noteId = null,
  } = req.body || {};

  if (!title || !col || !tag) {
    return res
      .status(400)
      .json({ error: 'title, col e tag são obrigatórios' });
  }

  const sql = `
    UPDATE cards
       SET title = ?, col = ?, tag = ?, valor = ?, due = ?, intType = ?, noteId = ?
     WHERE id = ?
  `;

  db.run(
    sql,
    [title, col, tag, valor, due, intType, noteId, id],
    function (err) {
      if (err) {
        console.error('Erro ao atualizar card:', err);
        return res.status(500).json({ error: 'Erro ao atualizar card' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Card não encontrado' });
      }
      res.json({ ok: true });
    }
  );
});

// Excluir permanentemente um card (apenas da lixeira)
app.delete('/cards/:id/permanent', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM cards WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('Erro ao excluir permanentemente:', err);
      return res.status(500).json({ error: 'Erro ao excluir permanentemente' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Card não encontrado' });
    }
    res.json({ ok: true });
  });
});

// Excluir um card (soft delete — vai para lixeira)
app.delete('/cards/:id', (req, res) => {
  const { id } = req.params;

  db.run('UPDATE cards SET deleted = 1 WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('Erro ao excluir card:', err);
      return res.status(500).json({ error: 'Erro ao excluir card' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Card não encontrado' });
    }
    res.json({ ok: true });
  });
});

// Restaurar card da lixeira
app.put('/cards/:id/restore', (req, res) => {
  const { id } = req.params;

  db.run('UPDATE cards SET deleted = 0 WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('Erro ao restaurar card:', err);
      return res.status(500).json({ error: 'Erro ao restaurar card' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Card não encontrado' });
    }
    res.json({ ok: true });
  });
});

// =========================
// AUTENTICAÇÃO (teste)
// =========================

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username e password são obrigatórios' });
  }

  db.get(
    'SELECT id, username FROM users WHERE username = ? AND password = ?',
    [username, password],
    (err, row) => {
      if (err) {
        console.error('Erro ao autenticar usuário:', err);
        return res.status(500).json({ error: 'Erro ao autenticar' });
      }
      if (!row) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }
      res.json({ ok: true, user: row });
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});