/**
 * app.js — Inicialização do mente.
 *
 * Carrega dados iniciais de exemplo e inicializa
 * todos os módulos. Execute por último.
 */

'use strict';

// ═══════════════════════════════════════════════
// DADOS INICIAIS DE EXEMPLO
// ═══════════════════════════════════════════════

function loadSampleData() {
  const today = new Date();

  // ── Cards Kanban (silent = true → não duplica notas)
  const sampleCards = [
    {
      id:      1001,
      title:   'Pagar fatura do cartão',
      col:     'todo',
      tag:     'fin',
      valor:   350,
      intType: 'pagamento',
      due:     fmtDate(addDays(today, 3)),
    },
    {
      id:      1002,
      title:   'Guardar $ para viagem',
      col:     'todo',
      tag:     'fin',
      valor:   500,
      intType: 'poupanca',
      due:     fmtDate(addDays(today, 15)),
    },
    {
      id:      1003,
      title:   'Reunião com o cliente',
      col:     'doing',
      tag:     'agenda2',
      due:     fmtDate(today),
    },
    {
      id:      1004,
      title:   'Entregar relatório semanal',
      col:     'doing',
      tag:     'geral',
      due:     fmtDate(addDays(today, 1)),
    },
    {
      id:      1005,
      title:   'Renovar assinatura Spotify',
      col:     'done',
      tag:     'fin',
      valor:   22.90,
      intType: 'pagamento',
    },
  ];

  // Adiciona cards E cria notas vinculadas para cada um
  sampleCards.forEach(data => {
    const card = addCardToState(data, false); // false = cria nota

    // Para cards já feitos, sincroniza financeiro
    if (data.col === 'done' && data.intType) {
      syncToFin(card);
    }
  });

  // ── Nota manual extra (não vinculada ao Kanban)
  State.notes.push({
    id:         2001,
    emoji:      '🚀',
    title:      'Ideias para o mente.',
    folder:     'ideias',
    content:    `<h2>Visão geral</h2>
<p>O <strong>mente.</strong> é minha segunda mente digital — um lugar para organizar tudo.</p>
<h3>Módulos</h3>
<ul>
  <li>📋 Kanban — cada card gera uma nota automática</li>
  <li>📅 Agenda — prazos do Kanban aparecem aqui</li>
  <li>💰 Financeiro — sincroniza com cards financeiros</li>
  <li>📝 Notas — editor completo estilo Notion</li>
</ul>
<blockquote>Produtividade é fazer as coisas certas, não mais coisas.</blockquote>`,
    date:       shortDate(),
    tags:       ['projeto', 'planejamento'],
    fromKanban: false,
  });
}

// ═══════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════
async function loadCardsFromApi() {
  try {
    const [resActive, resDeleted] = await Promise.all([
      fetch('http://localhost:3001/cards'),
      fetch('http://localhost:3001/cards?deleted=1'),
    ]);
    if (!resActive.ok) throw new Error('Erro ao buscar cards');
    const cards = await resActive.json();
    const deleted = resDeleted.ok ? await resDeleted.json() : [];

    // Cards ativos
    cards.forEach(data => {
      addCardToState({
        id:      data.id,
        title:   data.title,
        col:     data.col,
        tag:     data.tag,
        valor:   data.valor,
        due:     data.due,
        intType: data.intType,
        noteId:  data.noteId,
        created: data.created,
      }, true);
    });

    // Cards excluídos: adiciona ao State com deleted=true e cria nota sintética
    deleted.forEach(data => {
      const card = {
        id:      data.id,
        title:   data.title,
        col:     data.col,
        tag:     data.tag,
        valor:   data.valor,
        due:     data.due,
        intType: data.intType,
        noteId:  data.noteId,
        created: data.created,
        deleted: true,
      };
      State.cards.push(card);
      State.notes.unshift({
        id:         'trash-' + data.id,
        emoji:      '🗑',
        title:      data.title,
        folder:     'excluidos',
        content:    `<p>Card excluído do Kanban. Use "Restaurar card" para recuperar.</p>`,
        date:       shortDate(),
        tags:       ['kanban'],
        fromKanban: true,
        cardId:     data.id,
        cardDeleted: true,
      });
    });
  } catch (e) {
    console.error('Erro ao carregar cards do backend, usando dados de exemplo', e);
    loadSampleData(); // fallback para os dados que você já tinha
  }
}
// Abrir nota ao clicar no card (grade ou lista) — evita quebra com ids string tipo "trash-123"
document.addEventListener('click', (e) => {
  if (e.target.closest('.nc-actions, .nlr-actions')) return;
  const card = e.target.closest('.note-card, .note-list-row');
  if (!card?.dataset.noteId || typeof openNote !== 'function') return;
  const raw = card.dataset.noteId;
  const id = /^\d+$/.test(raw) ? parseInt(raw, 10) : raw;
  openNote(id);
});

// Restaurar card (botão na grade de Cards excluídos)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.nc-btn-restore');
  if (!btn?.dataset.cardId) return;
  e.preventDefault();
  e.stopPropagation();
  const id = parseInt(btn.dataset.cardId, 10);
  if (!Number.isNaN(id) && typeof restoreCard === 'function') restoreCard(id);
});

// Excluir permanentemente (badge no editor ou botão na grade de Cards excluídos)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#klb-permanent-delete-btn, .nc-btn-permanent');
  if (!btn?.dataset.cardId) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const id = parseInt(btn.dataset.cardId, 10);
  if (!Number.isNaN(id) && typeof permanentDeleteCard === 'function') permanentDeleteCard(id);
}, true);

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Tenta carregar do backend; se der erro, loadSampleData() é chamado lá dentro
  await loadCardsFromApi();

  // 2. Inicializa módulos
  initNotas();

  // 3. Renderiza view inicial (Kanban)
  renderKanban();
  renderSidebar();
  renderOverview();

  // 4. Mostra view correta
  showView('kanban');

  // 5. Pré-carrega agenda em background
  setTimeout(() => {
    renderYearStrip();
    renderYearOverview();
  }, 500);

  // 6. Preenche nome do usuário se disponível
  const stored = localStorage.getItem('mente_user');
  let nome = 'U';
  if (stored) {
    try {
      const user = JSON.parse(stored);
      nome = user.username || user.name || 'U';
    } catch (e) {}
  }
  const initial = nome.charAt(0).toUpperCase();
  const el1 = document.getElementById('user-avatar-initials');
  const el2 = document.getElementById('user-dropdown-initials');
  const el3 = document.getElementById('user-dropdown-name');
  if (el1) el1.textContent = initial;
  if (el2) el2.textContent = initial;
  if (el3) el3.textContent = nome;
});

// ═══════════════════════════════════════════════
// USER MENU - Toggle, Close, Logout
// ═══════════════════════════════════════════════

function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  const overlay = document.getElementById('user-menu-overlay');
  
  if (dropdown.classList.contains('open')) {
    closeUserMenu();
  } else {
    dropdown.classList.add('open');
    overlay.classList.add('active');
  }
}

function closeUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  const overlay = document.getElementById('user-menu-overlay');
  
  dropdown.classList.remove('open');
  overlay.classList.remove('active');
}

function logout() {
  closeUserMenu();
  // Limpa dados de sessão
  sessionStorage.clear();
  localStorage.removeItem('mente_user');
  localStorage.removeItem('userToken');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  
  // Redireciona para login
  window.location.href = 'login.html';
}

function openUserProfile() {
  closeUserMenu();
  showToast('👤', 'Perfil em breve!');
}

function openUserSettings() {
  closeUserMenu();
  window.location.href = 'config.html';
}