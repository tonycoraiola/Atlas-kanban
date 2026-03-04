/**
 * financeiro.js — Módulo Financeiro
 *
 * Registra automaticamente cards do Kanban marcados
 * como financeiros. Atualiza status quando marcados
 * como feito.
 */

'use strict';

// ═══════════════════════════════════════════════
// RENDERIZAR
// ═══════════════════════════════════════════════

function renderFin() {
  const rows = document.getElementById('fin-rows');

  if (!State.finRecords.length) {
    rows.innerHTML = '<div class="empty">Nenhum registro ainda. Crie um card financeiro no Kanban.</div>';
    ['pago', 'pendente', 'guardado'].forEach(k =>
      document.getElementById('fin-total-' + k).textContent = 'R$ 0,00'
    );
    return;
  }

  // Totais por status
  const totals = { pago: 0, pendente: 0, guardado: 0 };
  State.finRecords.forEach(r => {
    totals[r.status] = (totals[r.status] || 0) + (r.valor || 0);
  });

  ['pago', 'pendente', 'guardado'].forEach(k => {
    document.getElementById('fin-total-' + k).textContent =
      'R$ ' + totals[k].toFixed(2).replace('.', ',');
  });

  rows.innerHTML = State.finRecords.map(r => `
    <div class="fin-row">
      <span>${r.desc}</span>
      <span>${r.valor ? 'R$ ' + r.valor.toFixed(2).replace('.', ',') : '—'}</span>
      <span class="fin-status ${r.status}">${r.status}</span>
      <span style="font-size:10px;color:var(--muted)">
        ${r.origin === 'kanban' ? '📋 Kanban' : '✏️ Manual'}
      </span>
    </div>`
  ).join('');
}
