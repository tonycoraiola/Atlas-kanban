/**
 * agenda.js — Módulo Agenda / Calendário
 *
 * - Calendário mensal navegável
 * - Tira de meses do ano
 * - Visão anual com mini-calendários
 * - Painel de eventos do dia selecionado
 * - Clima via Open-Meteo (sem chave de API)
 * - Prazos do Kanban aparecem automaticamente
 */

'use strict';

// Estado do calendário
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth();
let selectedDate  = null;
let weatherLoaded = false;

// ═══════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════

function initAgenda() {
  renderCalendar();
  renderYearStrip();
  renderYearOverview();
  selectDate(selectedDate || todayStr());
  loadWeather();
}

// ═══════════════════════════════════════════════
// CALENDÁRIO PRINCIPAL
// ═══════════════════════════════════════════════

function renderCalendar() {
  // Título
  document.getElementById('cal-title').innerHTML =
    `${MONTHS_PT[calMonth]} <span>${calYear}</span>`;

  const grid       = document.getElementById('cal-grid');
  const firstDay   = new Date(calYear, calMonth, 1).getDay();
  const daysInMon  = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();

  let html = '';

  // Dias do mês anterior (padding)
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
  }

  // Dias do mês atual
  for (let d = 1; d <= daysInMon; d++) {
    const ds     = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = ds === todayStr();
    const isSel   = ds === selectedDate;
    const evts    = getEventsForDate(ds);

    // Dots coloridos por categoria
    const dots = evts.slice(0, 3).map(e => {
      const col = e.tag === 'fin'     ? 'var(--fin)'
                : e.tag === 'agenda2' ? 'var(--accent2)'
                :                       'var(--accent)';
      return `<div class="day-dot" style="background:${col}"></div>`;
    }).join('');

    html += `<div class="cal-day${isToday ? ' today' : ''}${isSel ? ' selected' : ''}${evts.length ? ' has-task' : ''}"
               onclick="selectDate('${ds}')">
      ${d}
      ${evts.length && !isSel ? `<div class="day-dots">${dots}</div>` : ''}
    </div>`;
  }

  // Padding do próximo mês
  const rem = 42 - firstDay - daysInMon;
  for (let i = 1; i <= rem; i++) {
    html += `<div class="cal-day other-month">${i}</div>`;
  }

  grid.innerHTML = html;

  // Atualiza chips ativos
  document.querySelectorAll('.month-chip').forEach((el, i) => {
    el.classList.toggle('active', i === calMonth && calYear === new Date().getFullYear());
  });
}

// ═══════════════════════════════════════════════
// TIRA DE MESES
// ═══════════════════════════════════════════════

function renderYearStrip() {
  document.getElementById('year-strip').innerHTML = MONTHS_PT.map((m, i) => {
    const hasEv = State.cards.some(c =>
      c.due &&
      parseInt(c.due.split('-')[1]) - 1 === i &&
      parseInt(c.due.split('-')[0]) === calYear
    );
    const isAct = i === calMonth && calYear === new Date().getFullYear();
    return `<div class="month-chip${isAct ? ' active' : ''}${hasEv && !isAct ? ' has-event' : ''}"
                 onclick="goToMonth(${i})">${MONTHS_SHORT[i]}</div>`;
  }).join('');
}

// ═══════════════════════════════════════════════
// MINI-CALENDÁRIOS ANUAIS
// ═══════════════════════════════════════════════

function renderYearOverview() {
  document.getElementById('year-overview').innerHTML = MONTHS_PT.map((m, mi) => {
    const firstDay  = new Date(calYear, mi, 1).getDay();
    const daysInMon = new Date(calYear, mi + 1, 0).getDate();
    const isAct     = mi === calMonth;

    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += '<div class="mini-cell mini-other"></div>';
    for (let d = 1; d <= daysInMon; d++) {
      const ds   = `${calYear}-${String(mi+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isT  = ds === todayStr();
      const hasT = getEventsForDate(ds).length > 0;
      cells += `<div class="mini-cell${isT ? ' mini-today' : hasT ? ' mini-has-task' : ''}">${d <= 9 ? d : ''}</div>`;
    }

    return `<div class="mini-month${isAct ? ' active-mini' : ''}" onclick="goToMonth(${mi})">
      <div class="mini-month-name">${MONTHS_SHORT[mi]}</div>
      <div class="mini-grid">${cells}</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════

function goToMonth(m) {
  calMonth = m;
  renderCalendar();
  renderYearStrip();
  renderYearOverview();
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  renderCalendar();
  renderYearStrip();
  renderYearOverview();
}

function goToday() {
  calYear  = new Date().getFullYear();
  calMonth = new Date().getMonth();
  renderCalendar();
  renderYearStrip();
  renderYearOverview();
  selectDate(todayStr());
}

// ═══════════════════════════════════════════════
// SELEÇÃO DE DATA & PAINEL DE EVENTOS
// ═══════════════════════════════════════════════

function selectDate(ds) {
  selectedDate = ds;
  renderCalendar();

  const d     = new Date(ds + 'T00:00:00');
  const label = ds === todayStr()
    ? 'Hoje'
    : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  document.getElementById('sel-date-label').textContent = label;

  const evts = getEventsForDate(ds);
  const list = document.getElementById('events-list');

  if (!evts.length) {
    list.innerHTML = `<div class="no-events">Nenhum evento em<br>${d.toLocaleDateString('pt-BR', { day:'2-digit', month:'long' })}</div>`;
    return;
  }

  list.innerHTML = evts.map(e => {
    const color  = e.tag === 'fin'     ? 'var(--fin)'
                 : e.tag === 'agenda2' ? 'var(--accent2)'
                 :                       'var(--accent)';
    const tCls   = e.tag === 'fin'     ? 'tag-fin'
                 : e.tag === 'agenda2' ? 'tag-agenda'
                 :                       'tag-kanban';
    const tLbl   = e.tag === 'fin'     ? 'Financeiro'
                 : e.tag === 'agenda2' ? 'Agenda'
                 :                       'Kanban';
    const cLbl   = { todo: 'A Fazer', doing: 'Em Progresso', done: 'Feito' }[e.col];

    return `<div class="event-item" onclick="openLinkedNote(${e.id})" title="Abrir nota vinculada">
      <div class="event-dot" style="background:${color}"></div>
      <div class="event-info">
        <div class="event-name">${e.title}</div>
        <div class="event-meta">📋 ${cLbl}${e.valor ? ' · R$ ' + e.valor.toFixed(2) : ''}</div>
      </div>
      <span class="event-tag ${tCls}">${tLbl}</span>
    </div>`;
  }).join('');
}

/** Retorna cards do Kanban que têm prazo numa determinada data */
function getEventsForDate(ds) {
  return State.cards.filter(c => c.due === ds);
}

// ═══════════════════════════════════════════════
// CLIMA — Open-Meteo (gratuito, sem chave)
// ═══════════════════════════════════════════════

const WMO_ICONS = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌧️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'🌨️', 73:'🌨️', 75:'❄️',
  80:'🌦️', 81:'🌧️', 82:'⛈️',
  95:'⛈️', 96:'⛈️', 99:'⛈️',
};

const WMO_DESC = {
  0:'Céu limpo', 1:'Predominantemente limpo', 2:'Parcialmente nublado', 3:'Nublado',
  45:'Neblina', 48:'Neblina',
  51:'Garoa leve', 53:'Garoa', 55:'Garoa forte',
  61:'Chuva leve', 63:'Chuva moderada', 65:'Chuva forte',
  80:'Pancadas leves', 81:'Pancadas', 82:'Pancadas fortes',
  95:'Trovoada', 96:'Trovoada c/ granizo', 99:'Trovoada forte',
};

// Coordenadas de São José dos Campos, SP
const WEATHER_LAT = -23.1896;
const WEATHER_LON = -45.8841;

async function loadWeather() {
  if (weatherLoaded) return;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&wind_speed_unit=kmh&timezone=America%2FSao_Paulo&forecast_days=5`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();

    const cur   = data.current;
    const daily = data.daily;
    const code  = cur.weather_code;

    document.getElementById('weather-loading').style.display = 'none';
    document.getElementById('weather-content').style.display = 'block';

    document.getElementById('w-icon').textContent     = WMO_ICONS[code] || '🌡️';
    document.getElementById('w-desc').textContent     = WMO_DESC[code]  || 'Condição variável';
    document.getElementById('w-temp').textContent     = Math.round(cur.temperature_2m) + '°';
    document.getElementById('w-feels').textContent    = `Sensação ${Math.round(cur.apparent_temperature)}°`;
    document.getElementById('w-humidity').textContent = cur.relative_humidity_2m + '%';
    document.getElementById('w-wind').textContent     = Math.round(cur.wind_speed_10m) + ' km/h';
    document.getElementById('w-max').textContent      = Math.round(daily.temperature_2m_max[0]) + '°';
    document.getElementById('w-min').textContent      = Math.round(daily.temperature_2m_min[0]) + '°';

    const days = ['Dom','Seg','Ter','Qui','Sex','Sáb','Dom'];
    document.getElementById('w-forecast').innerHTML = daily.time.slice(1, 5).map((t, i) => {
      const d2 = new Date(t + 'T00:00:00');
      const c2 = daily.weather_code[i + 1];
      return `<div class="forecast-day">
        <div class="f-name">${days[d2.getDay()]}</div>
        <div class="f-icon">${WMO_ICONS[c2] || '🌡️'}</div>
        <div class="f-temp">${Math.round(daily.temperature_2m_max[i+1])}°/${Math.round(daily.temperature_2m_min[i+1])}°</div>
      </div>`;
    }).join('');

    weatherLoaded = true;

  } catch (e) {
    document.getElementById('weather-loading').style.display = 'none';
    document.getElementById('weather-err').style.display     = 'block';
  }
}
