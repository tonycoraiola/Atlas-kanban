/**
 * app.js — Inicialização do Atlas.
 *
 * Carrega dados da API Railway e inicializa
 * todos os módulos.
 */

'use strict';

const API_URL = 'https://atlas-production-a815.up.railway.app';

// ═══════════════════════════════════════════════
// FALLBACK DE DADOS DE EXEMPLO
// ═══════════════════════════════════════════════

function loadSampleData() {
  const today = new Date();

  const sampleCards = [
    { id: 1001, title: 'Pagar fatura do cartão', col: 'todo',  tag: 'fin',    valor: 350,   intType: 'pagamento', due: fmtDate(addDays(today, 3))  },
    { id: 1002, title: 'Guardar $ para viagem',  col: 'todo',  tag: 'fin',    valor: 500,   intType: 'poupanca',  due: fmtDate(addDays(today, 15)) },
    { id: 1003, title: 'Reunião com o cliente',  col: 'doing', tag: 'agenda2',due: fmtDate(today) },
    { id: 1004, title: 'Entregar relatório',     col: 'doing', tag: 'geral',  due: fmtDate(addDays(today, 1)) },
    { id: 1005, title: 'Renovar Spotify',        col: 'done',  tag: 'fin',    valor: 22.90, intType: 'pagamento' },
  ];

  sampleCards.forEach(data => {
    const card = addCardToState(data, false);
    if (data.col === 'done' && data.intType) syncToFin(card);
  });

  State.notes.push({
    id: 2001, emoji: '🚀', title: 'Ideias para o Atlas.',
    folder: 'ideias',
    content: `<h2>Visão geral</h2>
<p>O <strong>Atlas</strong> é sua segunda mente digital — um lugar para organizar tudo.</p>
<h3>Módulos</h3>
<ul>
  <li>📋 Kanban — cada card gera uma nota automática</li>
  <li>📅 Agenda — prazos do Kanban aparecem aqui</li>
  <li>💰 Financeiro — sincroniza com cards financeiros</li>
  <li>📝 Notas — editor completo estilo Notion</li>
</ul>
<blockquote>Produtividade é fazer as coisas certas, não mais coisas.</blockquote>`,
    date: shortDate(), tags: ['projeto', 'planejamento'], fromKanban: false,
  });
}

// ═══════════════════════════════════════════════
// BOOT — carrega cards da API
// ═══════════════════════════════════════════════

async function loadCardsFromApi() {
  try {
    const [resActive, resDeleted] = await Promise.all([
      fetch(`${API_URL}/cards`),
      fetch(`${API_URL}/cards?deleted=1`),
    ]);
    if (!resActive.ok) throw new Error('Erro ao buscar cards');
    const cards   = await resActive.json();
    const deleted = resDeleted.ok ? await resDeleted.json() : [];

    cards.forEach(data => {
      addCardToState({
        id: data.id, title: data.title, col: data.col, tag: data.tag,
        valor: data.valor, due: data.due, intType: data.intType,
        noteId: data.noteId, created: data.created,
      }, true);
    });

    deleted.forEach(data => {
      State.cards.push({
        id: data.id, title: data.title, col: data.col, tag: data.tag,
        valor: data.valor, due: data.due, intType: data.intType,
        noteId: data.noteId, created: data.created, deleted: true,
      });
    });

  } catch (e) {
    console.error('Erro ao carregar cards, usando dados de exemplo:', e);
    loadSampleData();
  }
}

// ═══════════════════════════════════════════════
// DOM READY
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Carrega dados da API
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
});
