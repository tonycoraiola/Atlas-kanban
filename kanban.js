/**
 * kanban.js — Módulo Kanban
 *
 * Regras:
 *  - Todo card criado gera uma nota vinculada em Notas > Do Kanban
 *  - Card com prazo (due) aparece na Agenda
 *  - Card financeiro sincroniza com Financeiro
 *  - Card do tipo "nota" abre direto na nota ao clicar
 */

'use strict';

let dragId = null;

// ═══════════════════════════════════════════════
// ADICIONAR CARD
// ═══════════════════════════════════════════════

/**
 * Cria um card e sua nota vinculada.
 * @param {object} data
 * @param {boolean} silent - se true, não cria nota (usado no boot)
 */
function addCardToState(data, silent = false) {
  const card = {
    id:       data.id || Date.now(),
    title:    data.title,
    col:      data.col     || 'todo',
    tag:      data.tag     || 'geral',
    valor:    data.valor   || null,
    due:      data.due     || null,
    intType:  data.intType || null,
    noteId:   data.noteId  || null,   // ID da nota vinculada
    created:  new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
  };

  State.cards.push(card);

  // Integração financeira
  if (card.tag === 'fin') {
    ensureInFin(card);
    if (card.col === 'done') syncToFin(card);
  }

  // Cria nota vinculada para TODOS os cards (a menos que seja boot)
  if (!silent) {
    card.noteId = createLinkedNote(card);
  }

  return card;
}

/**
 * Cria nota vinculada ao card no Kanban.
 * Retorna o ID da nota criada.
 */
function createLinkedNote(card) {
  const colLabels = { todo: 'A Fazer', doing: 'Em Progresso', done: 'Feito' };
  const tagLabels = { fin: '💰 Financeiro', agenda2: '📅 Agenda', geral: '✦ Geral' };

  const dueInfo = card.due
    ? `<p>📅 <strong>Prazo:</strong> ${new Date(card.due + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</p>`
    : '';

  const finInfo = card.intType
    ? `<p>${card.intType === 'poupanca' ? '🏦 Meta de poupança' : '🧾 Conta a pagar'}${card.valor ? ' · R$ ' + card.valor.toFixed(2) : ''}</p>`
    : '';

  const note = {
    id:         Date.now() + Math.random(),
    emoji:      '📋',
    title:      card.title,
    folder:     'kanban',
    content:    `<h2>📋 Card vinculado</h2>
<p>Status: <strong>${colLabels[card.col]}</strong> &nbsp;·&nbsp; ${tagLabels[card.tag] || '✦ Geral'}</p>
${dueInfo}${finInfo}
<hr>
<h3>Anotações</h3>
<p>Use este espaço para detalhar a tarefa, adicionar contexto, links, referências...</p>`,
    date:       shortDate(),
    tags:       ['kanban'],
    fromKanban: true,
    cardId:     card.id,
  };

  State.notes.unshift(note);
  return note.id;
}

// ═══════════════════════════════════════════════
// RENDERIZAR KANBAN
// ═══════════════════════════════════════════════

function renderKanban() {
  const activeCards = State.cards.filter(c => !c.deleted);
  ['todo', 'doing', 'done'].forEach(col => {
    const container = document.getElementById('cards-' + col);
    const colCards  = activeCards.filter(c => c.col === col);
    document.getElementById('count-' + col).textContent = colCards.length;

    if (!colCards.length) {
      container.innerHTML = '<div class="empty">Sem cards aqui</div>';
      return;
    }

    container.innerHTML = colCards.map(renderCard).join('');

    // Drag events
    container.querySelectorAll('.card').forEach(el => {
      el.addEventListener('dragstart', () => {
        dragId = parseInt(el.dataset.id);
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
    });
  });
}

function renderCard(c) {
  const tagLabels = { fin: '💰 Financeiro', agenda2: '📅 Agenda', geral: '✦ Geral' };
  const tagClass  = { fin: 'tag-fin', agenda2: 'tag-agenda2', geral: 'tag-geral' };

  // Badge de prazo
  let dueHtml = '';
  if (c.due) {
    const todayMid = new Date(); todayMid.setHours(0,0,0,0);
    const d        = new Date(c.due + 'T00:00:00');
    const diff     = Math.ceil((d - todayMid) / 86400000);
    let cls = '';
    let lbl = '';
    if (diff < 0)   { cls = 'overdue'; lbl = `${Math.abs(diff)}d atrasado`; }
    else if (diff === 0) { cls = 'today'; lbl = 'Hoje'; }
    else if (diff === 1) { lbl = 'Amanhã'; }
    else                 { lbl = `em ${diff}d · ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}`; }
    dueHtml = `<div class="card-due ${cls}">📅 ${lbl}</div>`;
  }

  // Badge financeiro
  const intBadge = c.intType
    ? `<div class="card-integration">${c.intType === 'poupanca' ? '🏦' : '🧾'} <span>${c.intType === 'poupanca' ? 'Meta poupança' : 'Conta a pagar'}${c.valor ? ' · R$ ' + c.valor.toFixed(2) : ''}</span></div>`
    : '';

  // Badge nota vinculada (clicável → abre nota)
  const noteBadge = `<button class="card-note-link" onclick="openLinkedNote(${c.id})" title="Abrir nota vinculada">
    📝 <span>Ver nota completa →</span>
  </button>`;

  // Ações
  const doneBtn = c.col !== 'done'
    ? `<button class="card-btn done-btn" onclick="markDone(${c.id})">✓ feito</button>`
    : `<span style="color:var(--done);font-size:10px">✓ feito</span>`;

  const nextCol = { todo: 'doing', doing: 'done' }[c.col];
  const moveBtn = nextCol ? `<button class="card-btn" onclick="moveCard(${c.id},'${nextCol}')">→</button>` : '';
  const delBtn  = `<button class="card-btn" onclick="event.stopPropagation(); deleteCard(${c.id})" title="Excluir">🗑</button>`;

  return `<div class="card" draggable="true" data-id="${c.id}">
    <div class="card-tag ${tagClass[c.tag] || 'tag-geral'}">${tagLabels[c.tag] || '✦ Geral'}</div>
    <div class="card-title">${c.title}</div>
    ${dueHtml}
    ${noteBadge}
    ${intBadge}
    <div class="card-footer">
      <div class="card-date">${c.created}</div>
      <div class="card-actions">${moveBtn}${doneBtn}${delBtn}</div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════
// AÇÕES DOS CARDS
// ═══════════════════════════════════════════════

function markDone(id) {
  const card = State.cards.find(c => c.id === id);
  if (!card) return;
  card.col = 'done';

  apiUpdateCard(card);

  if (card.tag === 'fin') {
    syncToFin(card);
    const s = card.intType === 'poupanca' ? 'guardado' : 'pago';
    showToast('⚡', `<strong>Financeiro atualizado</strong>"${card.title}" → ${s}`);
    showBanner(`"${card.title}" → <strong>${s}</strong> no Financeiro`);
  } else {
    showToast('✓', `<strong>Concluído!</strong>${card.title}`);
  }

  // Atualiza nota vinculada
  updateLinkedNoteStatus(card);
  renderKanban();
}

function moveCard(id, col) {
  const card = State.cards.find(c => c.id === id);
  if (!card) return;
  card.col = col;

  apiUpdateCard(card);

  if (col === 'done' && card.tag === 'fin') syncToFin(card);
  updateLinkedNoteStatus(card);
  renderKanban();
}

async function deleteCard(id) {
  const card = State.cards.find(c => c.id === id);
  if (!card) return;

  const ok = await apiDeleteCard(id);
  if (ok) {
    card.deleted = true;
    const note = State.notes.find(n => n.cardId === card.id);
    if (note) note.cardDeleted = true;
    showToast('🗑', `<strong>Card excluído</strong> "${card.title}" → Cards excluídos`);
  } else {
    showToast('⚠', '<strong>Erro</strong> ao excluir. Tente novamente.');
  }
  renderKanban();
  renderSidebar();
  renderOverview();
}

async function restoreCard(id) {
  const card = State.cards.find(c => c.id === id);
  if (!card) return;

  const ok = await apiRestoreCard(id);
  if (ok) {
    card.deleted = false;
    const note = State.notes.find(n => n.cardId === card.id);
    if (note) {
      note.cardDeleted = false;
      note.folder = 'kanban';
    }
    showToast('↩', `<strong>Card restaurado</strong> "${card.title}"`);
    renderKanban();
    renderSidebar();
    renderOverview();
    if (typeof closeEditor === 'function') closeEditor();
  } else {
    showToast('⚠', '<strong>Erro</strong> ao restaurar. Tente novamente.');
  }
}

/** Exclui o card e a nota vinculada permanentemente (só para cards já na lixeira). */
async function permanentDeleteCard(id) {
  const card = State.cards.find(c => c.id === id);
  if (!card) return;

  const ok = await apiPermanentDeleteCard(id);
  if (ok) {
    const note = State.notes.find(n => n.cardId === card.id);
    State.cards = State.cards.filter(c => c.id !== id);
    if (note) State.notes = State.notes.filter(n => n.id !== note.id);
    showToast('🗑', `<strong>Excluído permanentemente</strong> "${card.title}"`);
    if (typeof closeEditor === 'function') closeEditor();
    renderKanban();
    State.currentView = 'notas';
    if (typeof showView === 'function') showView('notas');
    if (typeof filterFolder === 'function') filterFolder('excluidos');
  } else {
    showToast('⚠', '<strong>Erro</strong> ao excluir permanentemente. Tente novamente.');
  }
}

/** Abre a nota vinculada ao card no módulo Notas */
function openLinkedNote(cardId) {
  const card = State.cards.find(c => c.id === cardId);
  if (!card || !card.noteId) return;
  showView('notas');
  setTimeout(() => openNote(card.noteId), 80);
}

/** Navega de volta para o card a partir da nota */
function goToLinkedCard() {
  const note = State.notes.find(n => n.id === activeNoteId);
  if (!note || !note.cardId) return;
  showView('kanban');
}

/**
 * Atualiza o conteúdo da nota vinculada quando o status do card muda.
 */
function updateLinkedNoteStatus(card) {
  if (!card.noteId) return;
  const note = State.notes.find(n => n.id === card.noteId);
  if (!note) return;

  const colLabels = { todo: 'A Fazer', doing: 'Em Progresso', done: 'Feito' };
  const tagLabels = { fin: '💰 Financeiro', agenda2: '📅 Agenda', geral: '✦ Geral' };

  const dueInfo = card.due
    ? `<p>📅 <strong>Prazo:</strong> ${new Date(card.due + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</p>`
    : '';

  const finInfo = card.intType
    ? `<p>${card.intType === 'poupanca' ? '🏦 Meta de poupança' : '🧾 Conta a pagar'}${card.valor ? ' · R$ ' + card.valor.toFixed(2) : ''}</p>`
    : '';

  // Preserva conteúdo após o <hr> (anotações do usuário)
  const existingContent = note.content || '';
  const hrIdx = existingContent.indexOf('<hr>');
  const userContent = hrIdx !== -1
    ? existingContent.substring(hrIdx)
    : '<hr><h3>Anotações</h3><p>Use este espaço para detalhar a tarefa...</p>';

  note.content = `<h2>📋 Card vinculado</h2>
<p>Status: <strong>${colLabels[card.col]}</strong> &nbsp;·&nbsp; ${tagLabels[card.tag] || '✦ Geral'}</p>
${dueInfo}${finInfo}
${userContent}`;
}

// ═══════════════════════════════════════════════
// DRAG & DROP
// ═══════════════════════════════════════════════

function onDragOver(e, col) {
  e.preventDefault();
  document.getElementById('col-' + col).classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e, col) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragId) return;

  const card = State.cards.find(c => c.id === dragId);
  if (!card || card.col === col) return;

  card.col = col;
  if (col === 'done' && card.tag === 'fin') {
    syncToFin(card);
    const s = card.intType === 'poupanca' ? 'guardado' : 'pago';
    showToast('⚡', `<strong>Financeiro</strong>"${card.title}" → ${s}`);
  }
  apiUpdateCard(card);
  
  updateLinkedNoteStatus(card);
  dragId = null;
  renderKanban();
}

// ═══════════════════════════════════════════════
// MODAL — NOVA TAREFA
// ═══════════════════════════════════════════════

function openModal(col) {
  ['inp-title', 'inp-due', 'inp-valor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('inp-col').value = col || 'todo';
  document.getElementById('inp-tag').value = 'auto';
  document.getElementById('field-valor').style.display = 'none';
  document.getElementById('int-preview').classList.remove('show');
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('inp-title').focus(), 80);
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function analyzeTask(title) {
  const t      = (title || '').toLowerCase();
  const tagSel = document.getElementById('inp-tag').value;
  const hasDue = document.getElementById('inp-due').value;

  const isFin = tagSel === 'fin' || (tagSel === 'auto' && FIN_KW.some(k => t.includes(k)));
  const isSav = SAV_KW.some(k => t.includes(k));

  document.getElementById('field-valor').style.display = isFin ? 'block' : 'none';

  const msgs = [];
  // Nota sempre é criada
  msgs.push('📝 Uma <strong>nota vinculada</strong> será criada automaticamente em Notas › Do Kanban.');
  if (isFin) msgs.push(isSav ? '💰 Registrada como <strong>meta de poupança</strong> no Financeiro.' : '🧾 Registrada como <strong>conta a pagar</strong>. Ao concluir → Pago.');
  if (hasDue) msgs.push('📅 Aparecerá na <strong>Agenda</strong> na data selecionada.');

  const preview = document.getElementById('int-preview');
  document.getElementById('int-preview-desc').innerHTML = msgs.join('<br>');
  preview.classList.add('show');
}
async function apiCreateCard(data) {
  try {
    const res = await fetch('http://localhost:3001/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erro ao criar card no backend');
    return await res.json(); // retorna o card com id gerado no backend
  } catch (e) {
    console.error('Erro ao criar card no backend, usando só memória:', e);
    return null; // fallback: deixa o front seguir sem salvar no banco
  }
}
async function apiDeleteCard(id) {
  try {
    const res = await fetch(`http://localhost:3001/cards/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.error('Erro ao excluir card no backend:', e);
    return false;
  }
}

async function apiRestoreCard(id) {
  try {
    const res = await fetch(`http://localhost:3001/cards/${id}/restore`, { method: 'PUT' });
    return res.ok;
  } catch (e) {
    console.error('Erro ao restaurar card no backend:', e);
    return false;
  }
}

async function apiPermanentDeleteCard(id) {
  try {
    const res = await fetch(`http://localhost:3001/cards/${id}/permanent`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.error('Erro ao excluir permanentemente no backend:', e);
    return false;
  }
}

async function apiUpdateCard(card) {
  try {
    const res = await fetch(`http://localhost:3001/cards/${card.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:   card.title,
        col:     card.col,
        tag:     card.tag,
        valor:   card.valor,
        due:     card.due,
        intType: card.intType,
        noteId:  card.noteId || null,
      }),
    });
    if (!res.ok) throw new Error('Erro ao atualizar card no backend');
  } catch (e) {
    console.error('Erro ao atualizar card no backend:', e);
  }
}
async function addCard() {
  const title  = document.getElementById('inp-title').value.trim();
  if (!title) { document.getElementById('inp-title').focus(); return; }

  const col    = document.getElementById('inp-col').value;
  const tagSel = document.getElementById('inp-tag').value;
  const due    = document.getElementById('inp-due').value || null;
  const valor  = parseFloat(document.getElementById('inp-valor').value) || null;
  const t      = title.toLowerCase();

  let tag     = tagSel === 'auto' ? 'geral' : tagSel;
  let intType = null;

  if (tagSel === 'auto' && FIN_KW.some(k => t.includes(k))) {
    tag     = 'fin';
    intType = SAV_KW.some(k => t.includes(k)) ? 'poupanca' : 'pagamento';
  } else if (tagSel === 'fin') {
    intType = SAV_KW.some(k => t.includes(k)) ? 'poupanca' : 'pagamento';
  }

  const payload = { title, col, tag, valor, due, intType };

  // tenta salvar no backend
  let saved = await apiCreateCard(payload);

  // se backend falhar, cria um id local
  if (!saved) {
    saved = {
      id:      Date.now(),
      created: new Date().toISOString(),
      ...payload,
    };
  }

  // adiciona ao estado (e cria nota vinculada)
  addCardToState(saved);

  const integs = ['Nota criada em Notas › Do Kanban'];
  if (tag === 'fin') integs.push('Financeiro');
  if (due) {
    integs.push('Agenda em ' + new Date(due + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }));
    showBanner(`"${title}" → Agenda em ${new Date(due + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'long' })}`);
  }

  showToast('⚡', `<strong>Integrações ativas</strong>${integs.join(' · ')}`);

  closeModal();
  renderKanban();
  renderSidebar();
  renderOverview();

  if (due) {
    renderYearStrip();
    renderYearOverview();
    if (typeof selectedDate !== 'undefined' && selectedDate === due) selectDate(due);
  }
}

// Fecha modal ao clicar no overlay
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
  document.getElementById('inp-due').addEventListener('change', () => {
    analyzeTask(document.getElementById('inp-title').value);
  });
});
