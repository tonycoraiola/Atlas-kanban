/**
 * notas.js — Módulo Notas
 *
 * - Todo card do Kanban gera nota vinculada automaticamente
 * - Nota mostra badge com status/prazo do card vinculado
 * - Editor Notion-style com menu de blocos (/)
 * - Pastas, tags, busca
 * - Grade ou lista de notas
 */

'use strict';

// ─── Estado local do módulo ──────────────────
let activeNoteId    = null;
let activeFolder    = 'all';
let activeTagFilter = null;
let viewMode        = 'grid';

// ═══════════════════════════════════════════════
// FILTROS
// ═══════════════════════════════════════════════

function getFilteredNotes() {
  let filtered = [...State.notes];

  const search = (document.getElementById('notes-search')?.value || '').toLowerCase();
  if (activeFolder === 'excluidos') {
    filtered = filtered.filter(n => n.fromKanban && n.cardDeleted);
  } else if (activeFolder !== 'all') {
    filtered = filtered.filter(n => n.folder === activeFolder && !n.cardDeleted);
  }
  if (activeTagFilter)        filtered = filtered.filter(n => n.tags?.includes(activeTagFilter));
  if (search)                 filtered = filtered.filter(n =>
    n.title.toLowerCase().includes(search) ||
    stripHtml(n.content).toLowerCase().includes(search)
  );

  return filtered;
}

function filterFolder(f) {
  activeFolder    = f;
  activeTagFilter = null;
  renderSidebar();
  renderOverview();
}

function filterTag(t) {
  activeTagFilter = activeTagFilter === t ? null : t;
  renderSidebar();
  renderOverview();
}

function filterNotes() {
  renderSidebar();
  renderOverview();
}

function setViewMode(m) {
  viewMode = m;
  document.getElementById('vt-grid').classList.toggle('active', m === 'grid');
  document.getElementById('vt-list').classList.toggle('active', m === 'list');
  renderOverview();
}

// ═══════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════

function renderSidebar() {
  // Contadores por pasta
  const folderIds = ['all', 'kanban', 'pessoal', 'trabalho', 'financeiro', 'ideias', 'excluidos'];
  folderIds.forEach(f => {
    const count = f === 'all'
      ? State.notes.length
      : f === 'excluidos'
        ? State.notes.filter(n => n.fromKanban && n.cardDeleted).length
        : State.notes.filter(n => n.folder === f && !n.cardDeleted).length;
    const el = document.getElementById('fc-' + f);
    if (el) el.textContent = count;
  });

  // Highlight pasta ativa
  document.querySelectorAll('.folder-item').forEach(el =>
    el.classList.toggle('active', el.dataset.folder === activeFolder)
  );

  // Lista de notas recentes
  const filtered = getFilteredNotes().slice(0, 14);
  const list = document.getElementById('sidebar-notes-list');

  if (!filtered.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:11px">Nenhuma nota</div>';
  } else {
    list.innerHTML = filtered.map(n => {
      const linked = n.fromKanban ? '<span class="nli-linked">📋</span>' : '';
      return `<div class="note-list-item${activeNoteId === n.id ? ' active' : ''}${n.fromKanban ? ' linked' : ''}"
                   onclick="openNote(${JSON.stringify(n.id)})">
        <div class="nli-emoji">${n.emoji}</div>
        <div class="nli-title">${n.title || 'Sem título'}</div>
        <div class="nli-preview">${stripHtml(n.content).substring(0, 55) || 'Nota vazia'}</div>
        <div class="nli-meta">
          <span class="nli-date">${n.date}</span>
          <span class="nli-tag ntag-${n.folder}">${n.folder}</span>
          ${linked}
        </div>
      </div>`;
    }).join('');
  }

  // Tags
  const allTags = [...new Set(State.notes.flatMap(n => n.tags || []))];
  document.getElementById('sidebar-tags').innerHTML = allTags.map(t =>
    `<div class="tag-filter${activeTagFilter === t ? ' active' : ''}" onclick="filterTag('${t}')">#${t}</div>`
  ).join('');
}

// ═══════════════════════════════════════════════
// OVERVIEW (grade / lista)
// ═══════════════════════════════════════════════

function renderOverview() {
  const filtered = getFilteredNotes();
  const titles   = {
    all: 'Todas as notas', kanban: 'Do Kanban',
    pessoal: 'Pessoal', trabalho: 'Trabalho',
    financeiro: 'Financeiro', ideias: 'Ideias',
    excluidos: 'Cards excluídos',
  };

  document.getElementById('overview-folder-title').textContent = titles[activeFolder] || 'Notas';
  document.getElementById('overview-count').textContent =
    `${filtered.length} nota${filtered.length !== 1 ? 's' : ''}`;

  const container = document.getElementById('notes-cards-container');

  if (!filtered.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--muted)">
        <div style="font-size:40px;margin-bottom:12px">📝</div>
        <div style="margin-bottom:16px">Nenhuma nota ainda</div>
        <button class="add-btn" style="display:inline-flex;margin:0 auto" onclick="newNote()">+ Criar nota</button>
      </div>`;
    return;
  }

  if (viewMode === 'grid') {
    container.innerHTML = `<div class="cards-grid">
      ${filtered.map(n => {
        const isExcluido = activeFolder === 'excluidos' && n.cardId;
        const cardId = n.cardId;
        const actions = isExcluido && cardId
          ? `<div class="nc-actions" onclick="event.stopPropagation()">
               <button type="button" class="nc-btn nc-btn-restore" data-card-id="${cardId}" title="Restaurar card">↩ Restaurar</button>
               <button type="button" class="nc-btn nc-btn-permanent" data-card-id="${cardId}" title="Excluir para sempre">Excluir permanentemente</button>
             </div>`
          : '';
        return `
        <div class="note-card${n.fromKanban ? ' from-kanban' : ''}" data-note-id="${String(n.id).replace(/"/g, '&quot;')}"
             style="--card-accent:${NOTE_COLORS[n.folder] || 'var(--accent)'}">
          <div class="nc-emoji">${n.emoji}</div>
          <div class="nc-title">${n.title || 'Sem título'}</div>
          <div class="nc-preview">${stripHtml(n.content) || 'Nota vazia...'}</div>
          <div class="nc-footer">
            <div class="nc-date">${n.date}</div>
            <span class="nc-tag ntag-${n.folder}">${n.folder}</span>
          </div>
          ${actions}
        </div>`;
      }).join('')}
    </div>`;
  } else {
    container.innerHTML = `<div class="cards-list">
      ${filtered.map(n => {
        const isExcluido = activeFolder === 'excluidos' && n.cardId;
        const cardId = n.cardId;
        const actions = isExcluido && cardId
          ? `<div class="nlr-actions" onclick="event.stopPropagation()">
               <button type="button" class="nc-btn nc-btn-restore" data-card-id="${cardId}">↩ Restaurar</button>
               <button type="button" class="nc-btn nc-btn-permanent" data-card-id="${cardId}">Excluir permanentemente</button>
             </div>`
          : '';
        return `
        <div class="note-list-row${n.fromKanban ? ' from-kanban' : ''}" data-note-id="${String(n.id).replace(/"/g, '&quot;')}">
          <div class="nlr-emoji">${n.emoji}</div>
          <div class="nlr-body">
            <div class="nlr-title">${n.title || 'Sem título'}</div>
            <div class="nlr-preview">${stripHtml(n.content).substring(0, 80) || 'Nota vazia...'}</div>
          </div>
          <div class="nlr-meta">
            ${actions}
            <span class="nli-tag ntag-${n.folder}">${n.folder}</span>
            <span style="font-size:10px;color:var(--muted)">${n.date}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
}

// ═══════════════════════════════════════════════
// CRIAR / ABRIR / FECHAR NOTA
// ═══════════════════════════════════════════════

function newNote() {
  const note = {
    id:         Date.now(),
    emoji:      '📝',
    title:      '',
    folder:     activeFolder === 'all' ? 'pessoal' : activeFolder,
    content:    '',
    date:       shortDate(),
    tags:       [],
    fromKanban: false,
  };
  State.notes.unshift(note);
  openNote(note.id);
}

function openNote(id) {
  activeNoteId = id;
  const note   = State.notes.find(n => n.id === id);
  if (!note) return;

  // Troca overview pelo editor
  document.getElementById('notes-overview').style.display = 'none';
  document.getElementById('editor-wrap').classList.add('open');

  // Preenche campos
  document.getElementById('note-emoji').textContent       = note.emoji;
  document.getElementById('note-title').value             = note.title;
  document.getElementById('content-editor').innerHTML     = note.content;
  document.getElementById('meta-date').textContent        = note.date;
  document.getElementById('meta-folder').value            = note.folder;
  document.getElementById('editor-tag').value             = note.folder;

  autoResize(document.getElementById('note-title'));

  // Badge de card vinculado
  renderKanbanLinkBadge(note);

  renderSidebar();
}

/**
 * Mostra badge com status/prazo do card Kanban vinculado à nota.
 */
function renderKanbanLinkBadge(note) {
  const badge = document.getElementById('kanban-link-badge');
  const gotoBtn = document.getElementById('klb-goto-btn');
  const permanentBtn = document.getElementById('klb-permanent-delete-btn');

  if (!note.fromKanban || !note.cardId) {
    badge.style.display = 'none';
    if (permanentBtn) permanentBtn.style.display = 'none';
    return;
  }

  const card = State.cards.find(c => c.id === note.cardId);
  if (!card) { badge.style.display = 'none'; if (permanentBtn) permanentBtn.style.display = 'none'; return; }

  badge.style.display = 'flex';

  // Texto do card
  document.getElementById('klb-text').textContent = `Card: ${card.title}`;

  // Botão: Restaurar (se excluído) ou Ver no Kanban
  if (note.cardDeleted || card.deleted) {
    gotoBtn.textContent = '↩ Restaurar card';
    gotoBtn.onclick = () => restoreCard(card.id);
    if (permanentBtn) {
      permanentBtn.style.display = 'inline-flex';
      permanentBtn.dataset.cardId = String(card.id);
    }
  } else {
    gotoBtn.textContent = 'Ver no Kanban →';
    gotoBtn.onclick = () => goToLinkedCard();
    if (permanentBtn) permanentBtn.style.display = 'none';
  }

  // Status
  const statusEl  = document.getElementById('klb-status');
  const colLabels = { todo: 'A Fazer', doing: 'Em Progresso', done: 'Feito' };
  statusEl.textContent  = note.cardDeleted ? 'Excluído' : colLabels[card.col];
  statusEl.className    = `klb-status ${note.cardDeleted ? 'done' : card.col}`;

  // Prazo
  const dueEl = document.getElementById('klb-due');
  if (card.due && !note.cardDeleted) {
    const todayMid = new Date(); todayMid.setHours(0,0,0,0);
    const d        = new Date(card.due + 'T00:00:00');
    const diff     = Math.ceil((d - todayMid) / 86400000);
    let dueText    = '';
    if (diff < 0)        dueText = `⚠️ Atrasado ${Math.abs(diff)}d`;
    else if (diff === 0) dueText = '📅 Vence hoje';
    else if (diff === 1) dueText = '📅 Vence amanhã';
    else                 dueText = `📅 ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} (em ${diff}d)`;
    dueEl.textContent = dueText;
  } else {
    dueEl.textContent = note.cardDeleted ? 'Na lixeira' : '';
  }
}

function closeEditor() {
  saveNote();
  activeNoteId = null;
  document.getElementById('notes-overview').style.display = 'block';
  document.getElementById('editor-wrap').classList.remove('open');
  renderSidebar();
  renderOverview();
}

function saveNote() {
  if (!activeNoteId) return;
  const note = State.notes.find(n => n.id === activeNoteId);
  if (!note) return;

  note.emoji   = document.getElementById('note-emoji').textContent;
  note.title   = document.getElementById('note-title').value;
  note.content = document.getElementById('content-editor').innerHTML;
  note.folder  = document.getElementById('meta-folder').value;
  note.date    = shortDate();

  showToast('✓', '<strong>Nota salva!</strong>');
  renderSidebar();
}

function deleteNote() {
  if (!activeNoteId) return;
  const note = State.notes.find(n => n.id === activeNoteId);
  if (!note) return;

  // Se era nota vinculada, remove vínculo do card
  if (note.cardId) {
    const card = State.cards.find(c => c.id === note.cardId);
    if (card) card.noteId = null;
  }

  State.notes = State.notes.filter(n => n.id !== activeNoteId);
  closeEditor();
  showToast('🗑', '<strong>Nota excluída</strong>');
}

// ─── Sincroniza pasta entre toolbar e meta-bar ──
function syncFolderFromToolbar() {
  const folder = document.getElementById('editor-tag').value;
  document.getElementById('meta-folder').value = folder;
  if (activeNoteId) {
    const note = State.notes.find(n => n.id === activeNoteId);
    if (note) { note.folder = folder; renderSidebar(); }
  }
}

function syncFolderFromMeta() {
  const folder = document.getElementById('meta-folder').value;
  document.getElementById('editor-tag').value = folder;
  if (activeNoteId) {
    const note = State.notes.find(n => n.id === activeNoteId);
    if (note) { note.folder = folder; renderSidebar(); }
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// ═══════════════════════════════════════════════
// FORMATAÇÃO DE TEXTO
// ═══════════════════════════════════════════════

function fmt(cmd) {
  document.getElementById('content-editor').focus();
  document.execCommand(cmd, false, null);
}

function insertBlock(type) {
  document.getElementById('content-editor').focus();
  const blocks = {
    h1:         '<h1>Título 1</h1>',
    h2:         '<h2>Título 2</h2>',
    h3:         '<h3>Título 3</h3>',
    ul:         '<ul><li>Item</li></ul>',
    ol:         '<ol><li>Item</li></ol>',
    blockquote: '<blockquote>Citação...</blockquote>',
    code:       '<pre>// código aqui</pre>',
    hr:         '<hr>',
  };
  document.execCommand('insertHTML', false, blocks[type] || '');
}

// ═══════════════════════════════════════════════
// SLASH MENU — digitar / abre menu de blocos
// ═══════════════════════════════════════════════

const SLASH_BLOCKS = [
  { name: 'Título 1',  desc: 'Título grande',    icon: 'H1',  cmd: 'h1' },
  { name: 'Título 2',  desc: 'Título médio',      icon: 'H2',  cmd: 'h2' },
  { name: 'Título 3',  desc: 'Título pequeno',    icon: 'H3',  cmd: 'h3' },
  { name: 'Lista',     desc: 'Com marcadores',    icon: '•',   cmd: 'ul' },
  { name: 'Numerada',  desc: 'Lista ordenada',    icon: '1.',  cmd: 'ol' },
  { name: 'Citação',   desc: 'Bloco de citação',  icon: '❝',   cmd: 'blockquote' },
  { name: 'Código',    desc: 'Bloco de código',   icon: '</>', cmd: 'code' },
  { name: 'Divisor',   desc: 'Linha divisória',   icon: '—',   cmd: 'hr' },
];

function initSlashMenu() {
  const editor    = document.getElementById('content-editor');
  const slashMenu = document.getElementById('slash-menu');

  editor.addEventListener('keydown', e => {
    if (e.key === '/')      setTimeout(openSlashMenu, 0);
    if (e.key === 'Escape') closeSlashMenu();
    if (e.key === 'Enter' && slashMenu.classList.contains('open')) {
      e.preventDefault();
      const sel = document.querySelector('.slash-item.selected');
      if (sel) sel.click();
    }
  });

  editor.addEventListener('keyup', () => {
    if (!slashMenu.classList.contains('open')) return;
    const txt = getSlashText();
    if (txt !== null) filterSlash(txt);
    else closeSlashMenu();
  });

  document.addEventListener('click', e => {
    if (!slashMenu.contains(e.target) && e.target !== editor) closeSlashMenu();
  });
}

function getSlashText() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const range  = sel.getRangeAt(0);
  const text   = range.startContainer.textContent || '';
  const before = text.substring(0, range.startOffset);
  const idx    = before.lastIndexOf('/');
  return idx === -1 ? null : before.substring(idx + 1);
}

function openSlashMenu() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const menu = document.getElementById('slash-menu');
  menu.style.top  = (rect.bottom + window.scrollY + 8) + 'px';
  menu.style.left = (rect.left   + window.scrollX) + 'px';
  menu.classList.add('open');
  document.getElementById('slash-search').value = '';
  renderSlashItems(SLASH_BLOCKS);
}

function closeSlashMenu() {
  document.getElementById('slash-menu').classList.remove('open');
}

function filterSlash(q) {
  const filtered = SLASH_BLOCKS.filter(b => b.name.toLowerCase().includes(q.toLowerCase()));
  renderSlashItems(filtered);
}

function renderSlashItems(items) {
  document.getElementById('slash-items').innerHTML = items.map((b, i) => `
    <div class="slash-item${i === 0 ? ' selected' : ''}" onclick="pickSlash('${b.cmd}')">
      <div class="slash-item-icon">${b.icon}</div>
      <div>
        <div class="slash-item-name">${b.name}</div>
        <div class="slash-item-desc">${b.desc}</div>
      </div>
    </div>`).join('');
}

function pickSlash(cmd) {
  closeSlashMenu();
  const editor = document.getElementById('content-editor');
  editor.focus();

  // Remove o / e o texto digitado depois dele
  const sel = window.getSelection();
  if (sel.rangeCount) {
    const range  = sel.getRangeAt(0);
    const text   = range.startContainer.textContent || '';
    const pos    = range.startOffset;
    const before = text.substring(0, pos);
    const idx    = before.lastIndexOf('/');
    if (idx !== -1) {
      const nr = document.createRange();
      nr.setStart(range.startContainer, idx);
      nr.setEnd(range.startContainer, pos);
      nr.deleteContents();
      sel.removeAllRanges();
      sel.addRange(nr);
    }
  }
  insertBlock(cmd);
}

// ═══════════════════════════════════════════════
// EMOJI PICKER
// ═══════════════════════════════════════════════

function initEmojiPicker() {
  document.addEventListener('click', e => {
    const picker = document.getElementById('emoji-picker');
    if (!picker.contains(e.target) && e.target.id !== 'note-emoji') {
      picker.classList.remove('open');
    }
  });
}

function openEmojiPicker(e) {
  const picker = document.getElementById('emoji-picker');
  picker.style.top  = (e.clientY + 8) + 'px';
  picker.style.left = e.clientX + 'px';
  picker.classList.add('open');
  document.getElementById('emoji-grid').innerHTML = EMOJIS.map(em =>
    `<div class="ep-emoji" onclick="pickEmoji('${em}')">${em}</div>`
  ).join('');
}

function pickEmoji(em) {
  document.getElementById('note-emoji').textContent = em;
  document.getElementById('emoji-picker').classList.remove('open');
  if (activeNoteId) {
    const note = State.notes.find(n => n.id === activeNoteId);
    if (note) note.emoji = em;
  }
}

// ═══════════════════════════════════════════════
// INICIALIZAÇÃO DO MÓDULO
// ═══════════════════════════════════════════════

function initNotas() {
  initSlashMenu();
  initEmojiPicker();

  // Ctrl+S → salvar
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (activeNoteId) saveNote();
    }
  });
}
