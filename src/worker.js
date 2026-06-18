<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Scorio - مباريات اليوم</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{
      --bg:#0d1117;--bg2:#161b22;--bg3:#1f2a3e;
      --border:#30363d;--text:#e6edf3;--text2:#8b949e;
      --green:#4ade80;--red:#e63946;--blue:#58a6ff;--yellow:#f59e0b;
    }
    body{font-family:'Segoe UI','Cairo',sans-serif;background:var(--bg);color:var(--text);max-width:650px;margin:0 auto;padding-bottom:70px}

    /* ── Header ── */
    .app-header{
      background:var(--bg2);padding:.7rem 1rem;border-bottom:1px solid var(--border);
      display:flex;align-items:center;justify-content:space-between;
      position:sticky;top:0;z-index:200
    }
    .app-logo{font-size:1.15rem;font-weight:900;color:var(--blue)}
    .app-logo span{color:var(--text2);font-weight:400;font-size:.75rem;margin-right:.4rem}

    /* ── Date Bar ── */
    .date-bar{
      background:var(--bg2);border-bottom:1px solid var(--border);
      padding:.5rem .8rem;display:flex;align-items:center;gap:.4rem;
      overflow-x:auto;scrollbar-width:none;position:sticky;top:45px;z-index:190
    }
    .date-bar::-webkit-scrollbar{display:none}
    .date-pill{
      flex-shrink:0;padding:.35rem .8rem;border-radius:20px;border:none;
      background:var(--bg3);color:var(--text2);font-size:.78rem;font-weight:700;
      cursor:pointer;transition:all .2s;font-family:inherit;white-space:nowrap
    }
    .date-pill.active{background:var(--blue);color:#fff}
    .date-nav{
      flex-shrink:0;background:none;border:1px solid var(--border);color:var(--text2);
      border-radius:8px;padding:.3rem .6rem;cursor:pointer;font-size:.9rem;font-family:inherit
    }
    .date-nav:active{background:var(--bg3)}

    /* ── Content ── */
    .content{padding:.5rem .6rem}

    /* ── League group ── */
    .league-block{margin-bottom:.6rem;border-radius:10px;overflow:hidden;border:1px solid var(--border)}
    .league-head{
      background:var(--bg3);padding:.45rem .75rem;
      display:flex;align-items:center;gap:.45rem;cursor:pointer;
      user-select:none
    }
    .league-flag{font-size:1rem;flex-shrink:0}
    .league-name-text{font-size:.78rem;font-weight:700;flex:1}
    .league-count{background:var(--border);color:var(--text2);font-size:.65rem;padding:.12rem .45rem;border-radius:10px;font-weight:700}
    .league-toggle{color:var(--text2);font-size:.7rem;transition:transform .2s}
    .league-body{background:var(--bg2)}
    .league-body.collapsed{display:none}

    /* ── Match Card ── */
    .match-card{
      padding:.6rem .75rem;border-bottom:1px solid var(--border);
      cursor:pointer;transition:background .15s;display:block;text-decoration:none;color:inherit
    }
    .match-card:last-child{border-bottom:none}
    .match-card:active{background:var(--bg3)}
    .match-row{display:flex;align-items:center;gap:.4rem}
    .team-col{flex:1;display:flex;align-items:center;gap:.45rem}
    .team-col.away{flex-direction:row-reverse}
    .team-logo{width:26px;height:26px;object-fit:contain;flex-shrink:0}
    .team-logo-placeholder{width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem}
    .team-name{font-size:.82rem;font-weight:700;line-height:1.2}
    .team-col.away .team-name{text-align:left}
    .score-col{min-width:72px;text-align:center;flex-shrink:0}
    .score-val{font-size:1.1rem;font-weight:900;letter-spacing:1px}
    .score-val.live{color:var(--red)}
    .score-val.pre{color:var(--text2);font-size:.82rem}
    .status-row{display:flex;align-items:center;justify-content:center;margin-top:.2rem;gap:.3rem}
    .live-dot{width:6px;height:6px;background:var(--red);border-radius:50%;animation:blink 1s ease infinite}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
    .status-text{font-size:.65rem;color:var(--text2)}
    .status-text.live-txt{color:var(--red);font-weight:700}
    .match-stage{font-size:.62rem;color:var(--text2);text-align:center;margin-top:.1rem}

    /* ── Filter bar ── */
    .filter-bar{
      display:flex;gap:.4rem;padding:.5rem .6rem;overflow-x:auto;scrollbar-width:none;
      border-bottom:1px solid var(--border);background:var(--bg2)
    }
    .filter-bar::-webkit-scrollbar{display:none}
    .filter-btn{
      flex-shrink:0;padding:.3rem .75rem;border-radius:16px;border:1px solid var(--border);
      background:none;color:var(--text2);font-size:.75rem;font-weight:700;cursor:pointer;
      white-space:nowrap;transition:all .15s;font-family:inherit
    }
    .filter-btn.active{background:var(--blue);border-color:var(--blue);color:#fff}

    /* ── Loading / Empty ── */
    .loading{text-align:center;padding:3rem;color:var(--text2)}
    .spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 1rem}
    @keyframes spin{to{transform:rotate(360deg)}}
    .empty{text-align:center;padding:2rem;color:var(--text2);font-size:.9rem}

    /* ── Bottom Nav ── */
    .bottom-nav{
      position:fixed;bottom:0;left:50%;transform:translateX(-50%);
      max-width:650px;width:100%;background:var(--bg2);
      border-top:1px solid var(--border);display:flex;z-index:300
    }
    .nav-item{
      flex:1;text-align:center;padding:.55rem .3rem;background:none;border:none;
      color:var(--text2);font-weight:700;cursor:pointer;font-size:.78rem;
      font-family:inherit;transition:color .2s
    }
    .nav-item.active{color:var(--blue)}
    .nav-icon{font-size:1.1rem;display:block;margin-bottom:.1rem}
  </style>
</head>
<body>

<!-- HEADER -->
<div class="app-header">
  <div class="app-logo">⚽ Scorio <span>مباريات كرة القدم</span></div>
</div>

<!-- DATE BAR -->
<div class="date-bar" id="dateBar">
  <button class="date-nav" id="prevDay">◀</button>
  <div id="datePills" style="display:flex;gap:.4rem;overflow-x:auto;scrollbar-width:none"></div>
  <button class="date-nav" id="nextDay">▶</button>
</div>

<!-- FILTER BAR -->
<div class="filter-bar" id="filterBar">
  <button class="filter-btn active" data-filter="all">📋 الكل</button>
  <button class="filter-btn" data-filter="in">🔴 مباشر</button>
  <button class="filter-btn" data-filter="post">✅ منتهية</button>
  <button class="filter-btn" data-filter="pre">⏳ قادمة</button>
</div>

<!-- MAIN CONTENT -->
<div class="content" id="content">
  <div class="loading"><div class="spinner"></div>جارٍ التحميل...</div>
</div>

<!-- BOTTOM NAV -->
<div class="bottom-nav">
  <button class="nav-item active" id="navMatches">
    <span class="nav-icon">⚽</span>مباريات
  </button>
  <button class="nav-item" id="navLeague" onclick="location.href='league.html'">
    <span class="nav-icon">🏆</span>بطولات
  </button>
</div>

<script>
const WORKER = 'https://football-worker.mahdijadir38.workers.dev';

/* ═══ STATE ════════════════════════════════════════════════════════════ */
let allMatches   = [];
let currentDate  = new Date();
let currentFilter = 'all';

/* ═══ DATE HELPERS ═════════════════════════════════════════════════════ */
function fmtApi(d) {
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate()+n); return r;
}
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function dateLabel(d) {
  const today = new Date(), tom = addDays(today,1), yes = addDays(today,-1);
  if (isSameDay(d,today)) return 'اليوم';
  if (isSameDay(d,tom))   return 'غداً';
  if (isSameDay(d,yes))   return 'أمس';
  const days  = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months= ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

/* ═══ BUILD DATE PILLS ══════════════════════════════════════════════════ */
function buildDatePills() {
  const pills = document.getElementById('datePills');
  pills.innerHTML = '';
  const today = new Date();
  for (let i = -3; i <= 3; i++) {
    const d   = addDays(today, i);
    const btn = document.createElement('button');
    btn.className = 'date-pill' + (isSameDay(d,currentDate)?' active':'');
    btn.textContent = dateLabel(d);
    btn.onclick = () => { currentDate = d; buildDatePills(); loadMatches(); };
    pills.appendChild(btn);
  }
  // scroll active into view
  const active = pills.querySelector('.active');
  if (active) active.scrollIntoView({inline:'center',behavior:'smooth'});
}

/* ═══ LOAD MATCHES ══════════════════════════════════════════════════════ */
async function loadMatches() {
  document.getElementById('content').innerHTML = '<div class="loading"><div class="spinner"></div>جارٍ التحميل...</div>';
  try {
    const res  = await fetch(`${WORKER}/api/matches?date=${fmtApi(currentDate)}`);
    const data = await res.json();
    allMatches = data.matches || [];
    renderMatches();
  } catch(e) {
    document.getElementById('content').innerHTML = `<div class="empty">⚠️ خطأ: ${e.message}</div>`;
  }
}

/* ═══ RENDER ════════════════════════════════════════════════════════════ */
function renderMatches() {
  const filtered = currentFilter === 'all'
    ? allMatches
    : allMatches.filter(m => m.status === currentFilter);

  if (!filtered.length) {
    document.getElementById('content').innerHTML = '<div class="empty">⚽ لا توجد مباريات</div>';
    return;
  }

  // تجميع حسب الدوري
  const groups = {};
  filtered.forEach(m => {
    const key = m.leagueNameOnly || m.leagueName || 'مباريات';
    if (!groups[key]) groups[key] = { flag: m.leagueFlag||'⚽', matches: [] };
    groups[key].matches.push(m);
  });

  let html = '';
  for (const [lgName, grp] of Object.entries(groups)) {
    const blockId = 'lg_' + lgName.replace(/\W/g,'_');
    html += `
      <div class="league-block">
        <div class="league-head" onclick="toggleLeague('${blockId}')">
          <span class="league-flag">${grp.flag}</span>
          <span class="league-name-text">${lgName}</span>
          <span class="league-count">${grp.matches.length}</span>
          <span class="league-toggle" id="tog_${blockId}">▲</span>
        </div>
        <div class="league-body" id="${blockId}">
          ${grp.matches.map(matchCard).join('')}
        </div>
      </div>`;
  }
  document.getElementById('content').innerHTML = html;
}

/* ═══ MATCH CARD HTML ═══════════════════════════════════════════════════ */
function matchCard(m) {
  const isLive = m.status === 'in';
  const isPre  = m.status === 'pre';

  // الوقت المحلي للمباراة إذا لم تبدأ
  let timeStr = '';
  if (isPre && m.date) {
    try {
      timeStr = new Date(m.date).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
    } catch(_){}
  }

  const scoreHtml = isPre
    ? `<div class="score-val pre">${timeStr||'--:--'}</div>`
    : `<div class="score-val${isLive?' live':''}"> ${m.homeScore??0} - ${m.awayScore??0}</div>`;

  const statusHtml = isLive
    ? `<div class="status-row"><div class="live-dot"></div><span class="status-text live-txt">${m.minute||'LIVE'}</span></div>`
    : isPre
      ? `<div class="status-row"><span class="status-text">لم تبدأ</span></div>`
      : `<div class="status-row"><span class="status-text">✅ انتهت</span></div>`;

  const stageHtml = m.leagueStage
    ? `<div class="match-stage">${m.leagueStage}</div>` : '';

  const homeLogo = m.homeLogo
    ? `<img class="team-logo" src="${m.homeLogo}" onerror="this.outerHTML='<span class=team-logo-placeholder>🏠</span>'">`
    : `<span class="team-logo-placeholder">🏠</span>`;

  const awayLogo = m.awayLogo
    ? `<img class="team-logo" src="${m.awayLogo}" onerror="this.outerHTML='<span class=team-logo-placeholder>✈️</span>'">`
    : `<span class="team-logo-placeholder">✈️</span>`;

  return `
    <a class="match-card" href="match.html?id=${m.id}&league=${m.league}">
      <div class="match-row">
        <div class="team-col home">
          ${homeLogo}
          <span class="team-name">${m.homeTeam}</span>
        </div>
        <div class="score-col">
          ${scoreHtml}
          ${statusHtml}
          ${stageHtml}
        </div>
        <div class="team-col away">
          ${awayLogo}
          <span class="team-name">${m.awayTeam}</span>
        </div>
      </div>
    </a>`;
}

/* ═══ TOGGLE LEAGUE ════════════════════════════════════════════════════ */
function toggleLeague(blockId) {
  const body = document.getElementById(blockId);
  const tog  = document.getElementById('tog_'+blockId);
  if (!body) return;
  const collapsed = body.classList.toggle('collapsed');
  if (tog) tog.textContent = collapsed ? '▼' : '▲';
}

/* ═══ FILTER ════════════════════════════════════════════════════════════ */
document.getElementById('filterBar').addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  renderMatches();
});

/* ═══ DATE NAV ══════════════════════════════════════════════════════════ */
document.getElementById('prevDay').onclick = () => {
  currentDate = addDays(currentDate, -1);
  buildDatePills();
  loadMatches();
};
document.getElementById('nextDay').onclick = () => {
  currentDate = addDays(currentDate, 1);
  buildDatePills();
  loadMatches();
};

/* ═══ AUTO-REFRESH FOR LIVE ═════════════════════════════════════════════ */
setInterval(() => {
  const hasLive = allMatches.some(m => m.status === 'in');
  if (hasLive) loadMatches();
}, 60000);

/* ═══ INIT ══════════════════════════════════════════════════════════════ */
buildDatePills();
loadMatches();
</script>
</body>
</html>
