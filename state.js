/**
 * state.js — Estado compartilhado do mente.
 * Todos os módulos lêem e escrevem aqui.
 */

'use strict';

// ═══════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════
const State = {
  cards:      [],   // Kanban cards
  notes:      [],   // Notas
  finRecords: [],   // Registros financeiros
  currentView: 'kanban',
};

// ═══════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════
const MONTHS_PT    = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const NOTE_COLORS = {
  kanban:     'var(--accent)',
  pessoal:    'var(--accent)',
  trabalho:   'var(--accent2)',
  financeiro: 'var(--fin)',
  ideias:     'var(--accent3)',
  excluidos:  'var(--muted)',
};

const EMOJIS = [
  '📝','💡','🎯','📊','🔖','⭐','🧠','📌','🚀','💼',
  '💰','🎨','🔑','📅','✅','🌟','💬','🔥','⚡','🎵',
  '🏆','💎','🌈','🦋','🌺','🎪','🧩','🔮','🌙','☀️',
  '❄️','🌊','🍀','🦄','🎭','🎬','📸','🎸','✈️','🏖️',
];

const FIN_KW  = ['pagar','fatura','conta','boleto','parcela','mensalidade','aluguel','imposto','gasto','despesa'];
const SAV_KW  = ['guardar','poupar','economizar','reservar','investir','meta'];

// ═══════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════

/** Formata Date para string YYYY-MM-DD */
function fmtDate(d) {
  return d.toISOString().split('T')[0];
}

/** Retorna a data de hoje como YYYY-MM-DD */
function todayStr() {
  return fmtDate(new Date());
}

/** Adiciona N dias a uma Date */
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Remove tags HTML e retorna texto puro */
function stripHtml(html) {
  const t = document.createElement('div');
  t.innerHTML = html || '';
  return t.textContent || '';
}

/** Retorna data formatada para exibição */
function shortDate() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Exibe toast de notificação */
function showToast(icon, msg) {
  const t   = document.getElementById('toast');
  const ico = document.getElementById('toast-icon');
  const txt = document.getElementById('toast-msg');
  ico.textContent = icon;
  txt.innerHTML   = msg;
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 4000);
}

/** Exibe banner de integração no Kanban */
function showBanner(msg) {
  const b = document.getElementById('int-banner');
  document.getElementById('banner-msg').innerHTML = msg;
  b.style.display = 'flex';
  clearTimeout(b._timeout);
  b._timeout = setTimeout(() => b.style.display = 'none', 5000);
}

// ═══════════════════════════════════════════════
// FINANÇAS — helpers compartilhados
// ═══════════════════════════════════════════════

function syncToFin(card) {
  const ex = State.finRecords.find(r => r.id === card.id);
  if (ex) {
    ex.status = card.intType === 'poupanca' ? 'guardado' : 'pago';
    return;
  }
  State.finRecords.push({
    id:     card.id,
    desc:   card.title,
    valor:  card.valor,
    status: card.intType === 'poupanca' ? 'guardado' : 'pago',
    origin: 'kanban',
  });
}

function ensureInFin(card) {
  if (!State.finRecords.find(r => r.id === card.id)) {
    State.finRecords.push({
      id:     card.id,
      desc:   card.title,
      valor:  card.valor,
      status: 'pendente',
      origin: 'kanban',
    });
  }
}

// ═══════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════

function showView(v) {
  State.currentView = v;

  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');

  ['kanban', 'agenda', 'financeiro', 'notas'].forEach(name => {
    document.getElementById('nav-' + name).classList.toggle('active', name === v);
  });

  const btn = document.getElementById('header-add-btn');
  btn.textContent = v === 'notas' ? '+ Nova nota' : '+ Nova tarefa';

  // Inicializa módulo ao entrar
  if (v === 'financeiro') renderFin();
  if (v === 'kanban')     renderKanban();
  if (v === 'agenda')     initAgenda();
  if (v === 'notas')      { renderSidebar(); renderOverview(); }
}

function headerAdd() {
  if (State.currentView === 'notas') newNote();
  else openModal();
}
