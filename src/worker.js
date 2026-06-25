<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>البطولات - Scorio</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{\n      --bg:#0d1117;--bg2:#161b22;--bg3:#1f2a3e;\n      --border:#30363d;--text:#e6edf3;--text2:#8b949e;\n      --green:#4ade80;--red:#e63946;--blue:#58a6ff;--yellow:#f59e0b;\n    }
    body{font-family:'Segoe UI','Cairo',sans-serif;background:var(--bg);color:var(--text);max-width:650px;margin:0 auto;padding-bottom:70px}

    /* ── Header ── */
    .app-header{background:var(--bg2);padding:.7rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:200}
    .app-logo{font-size:1.1rem;font-weight:900;color:var(--blue)}
    .header-back{background:none;border:none;color:var(--text2);cursor:pointer;font-size:1.1rem;text-decoration:none}

    /* ── League Selector ── */
    .lg-selector{background:var(--bg2);padding:.6rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:.5rem;overflow-x:auto;scrollbar-width:none}
    .lg-selector::-webkit-scrollbar{display:none}
    .lg-option{flex-shrink:0;padding:.4rem .8rem;background:var(--bg3);border:1px solid var(--border);border-radius:20px;color:var(--text2);font-size:.78rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:.3rem}
    .lg-option.selected{background:var(--blue);color:#fff;border-color:var(--blue)}
    .lg-flag{font-size:.95rem}

    /* ── Tabs Bar ── */
    .tabs-bar{display:flex;background:var(--bg2);border-bottom:1px solid var(--border);position:sticky;top:45px;z-index:180}
    .tab-btn{flex:1;background:none;border:none;padding:.75rem .3rem;color:var(--text2);font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;border-bottom:2px solid transparent}
    .tab-btn.active{color:var(--blue);border-bottom-color:var(--blue)}

    /* ── Content Panels ── */
    .tab-panel{display:none;padding:.6rem}
    .tab-panel.active{display:block}

    /* ── Standings Table ── */
    .grp-title{font-size:.85rem;font-weight:800;color:var(--blue);padding:.5rem .3rem;margin-top:.4rem}
    .table-container{background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:.8rem}
    table{width:100%;border-collapse:collapse;text-align:center;font-size:.78rem}
    th{background:var(--bg3);color:var(--text2);font-weight:700;padding:.55rem .3rem}
    td{padding:.6rem .3rem;border-bottom:1px solid var(--border)}
    tr:last-child td{border-bottom:none}
    .t-rank{font-weight:800;width:28px;position:relative}
    /* خط ملون جانبي للمراكز */
    .rank-indicator{position:absolute;right:0;top:0;bottom:0;width:3.5px}
    .t-team{text-align:right;display:flex;align-items:center;gap:.4rem;font-weight:700}
    .t-logo{width:18px;height:18px;object-fit:contain}
    .t-pts{font-weight:900;color:var(--text)}
    
    /* دليل الألوان السفلي */
    .legend-box{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:.6rem;margin-top:.5rem}
    .legend-item{display:flex;align-items:center;gap:.5rem;font-size:.72rem;color:var(--text2);margin-bottom:.3rem}
    .legend-item:last-child{margin-bottom:0}
    .legend-color{width:12px;height:12px;border-radius:3px;flex-shrink:0}

    /* ── Scorers List ── */
    .scorer-row{display:flex;align-items:center;padding:.6rem .8rem;background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:.4rem;gap:.6rem}
    .sc-rank{font-size:.85rem;font-weight:800;color:var(--text2);min-width:20px}
    .sc-photo{width:32px;height:32px;border-radius:50%;background:var(--bg3);object-fit:cover}
    .sc-info{flex:1}
    .sc-name{font-size:.82rem;font-weight:700;display:block}
    .sc-team{font-size:.68rem;color:var(--text2);display:flex;align-items:center;gap:.2rem;margin-top:.1rem}
    .sc-tlogo{width:12px;height:12px;object-fit:contain}
    .sc-goals{font-size:1.05rem;font-weight:900;color:var(--green)}
    .sc-goals span{font-size:.65rem;color:var(--text2);font-weight:400;margin-right:.1rem}

    /* ── Matches Layout ── */
    .lg-match-card{display:flex;align-items:center;padding:.7rem .8rem;background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:.4rem;text-decoration:none;color:inherit}
    .lgm-team{flex:1;display:flex;align-items:center;gap:.4rem;font-size:.8rem;font-weight:700}
    .lgm-team.away{flex-direction:row-reverse;text-align:left}
    .lgm-logo{width:22px;height:22px;object-fit:contain}
    .lgm-score{min-width:65px;text-align:center}
    .lgm-val{font-size:.95rem;font-weight:900;letter-spacing:0.5px}
    .lgm-val.live{color:var(--red)}
    .lgm-status{font-size:.6rem;color:var(--text2);margin-top:.15rem}

    /* ── UI Helpers ── */
    .loading{text-align:center;padding:3rem;color:var(--text2)}
    .spinner{width:30px;height:30px;border:3px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto .5rem}
    @keyframes spin{to{transform:rotate(360deg)}}
    .empty{text-align:center;padding:2rem;color:var(--text2);font-size:.82rem}
  </style>
</head>
<body>

<div class="app-header">
  <a class="header-back" href="index.html">↩ الرئيسية</a>
  <div class="app-logo" id="leagueTitle">البطولات والمنافسات</div>
</div>

<div class="lg-selector" id="leagueSelector">
  <button class="lg-option" onclick="switchLeague('eng.1')"><span class="lg-flag">🏴 Res</span><span class="lg-name">الدوري الإنجليزي</span></button>
  <button class="lg-option" onclick="switchLeague('esp.1')"><span class="lg-flag">🇪🇸</span><span class="lg-name">الدوري الإسباني</span></button>
  <button class="lg-option" onclick="switchLeague('ger.1')"><span class="lg-flag">🇩🇪</span><span class="lg-name">الدوري الألماني</span></button>
  <button class="lg-option" onclick="switchLeague('ita.1')"><span class="lg-flag">🇮🇹</span><span class="lg-name">الدوري الإيطالي</span></button>
  <button class="lg-option" onclick="switchLeague('fra.1')"><span class="lg-flag">🇫🇷</span><span class="lg-name">الدوري الفرنسي</span></button>
  <button class="lg-option" onclick="switchLeague('uefa.champions')"><span class="lg-flag">🏆</span><span class="lg-name">دوري الأبطال</span></button>
  <button class="lg-option" onclick="switchLeague('saudi.1')"><span class="lg-flag">🇸🇦</span><span class="lg-name">الدوري السعودي</span></button>
  <button class="lg-option" onclick="switchLeague('egy.1')"><span class="lg-flag">🇪🇬</span><span class="lg-name">الدوري المصري</span></button>
</div>

<div class="tabs-bar">
  <button class="tab-btn active" onclick="switchTab('standings')" id="tab-standings">📊 الترتيب</button>
  <button class="tab-btn" onclick="switchTab('matches')" id="tab-matches">⚽ المباريات</button>
  <button class="tab-btn" onclick="switchTab('scorers')" id="tab-scorers">🔥 الهدافون</button>
</div>

<div class="tab-panel active" id="panel-standings"></div>
<div class="tab-panel" id="panel-matches"></div>
<div class="tab-panel" id="panel-scorers"></div>

<script>
const WORKER = 'https://football-worker.mahdijadir38.workers.dev';
let currentLeague = 'eng.1';
let currentTab = 'standings';

/* ═══ TAB CONTROL ═══════════════════════════════════════════════════════ */
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.getElementById(`panel-${tabName}`).classList.add('active');
  
  fetchTabData();
}

/* ═══ LEAGUE SWITCHER ═══════════════════════════════════════════════════ */
function switchLeague(lgId) {
  currentLeague = lgId;
  document.querySelectorAll('.lg-option').forEach(opt => {
    opt.classList.toggle('selected', opt.getAttribute('onclick').includes(`'${lgId}'`));
  });
  fetchTabData();
}

/* ═══ DATA ROUTER ═══════════════════════════════════════════════════════ */
function fetchTabData() {
  if (currentTab === 'standings') loadStandings();
  if (currentTab === 'matches') loadLeagueMatches();
  if (currentTab === 'scorers') loadScorers();
}

/* ═══ 1. RENDER STANDINGS (WITH COLORED RULES) ═════════════════════════ */
async function loadStandings() {
  const panel = document.getElementById('panel-standings');
  panel.innerHTML = '<div class="loading"><div class="spinner"></div>جارٍ تحميل جدول الترتيب...</div>';
  
  try {
    const res = await fetch(`${WORKER}/api/standings?league=${currentLeague}`);
    const data = await res.json();
    
    if (!data.success || !data.groups || !data.groups.length) {
      panel.innerHTML = '<div class="empty">⚠️ لا يتوفر جدول ترتيب لهذه البطولة حالياً.</div>';
      return;
    }

    let html = '';
    let uniqueRules = new Map(); // لتجميع الشروحات للألوان أسفل الجدول

    data.groups.forEach(grp => {
      if (grp.name) html += `<div class="grp-title">${grp.name}</div>`;
      
      html += `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width:35px">#</th>
                <th style="text-align:right">الفريق</th>
                <th>لعب</th>
                <th>فاز</th>
                <th>تعدل</th>
                <th>خسر</th>
                <th>له/عليه</th>
                <th class="t-pts">نقاط</th>
              </tr>
            </thead>
            <tbody>
      `;

      grp.teams.forEach(t => {
        // إذا كان للمركز لون معين، نقوم بإضافته كـ Indicator جانبي
        const sideColor = t.color ? `background-color:${t.color}` : '';
        if (t.color && t.desc) {
          uniqueRules.set(t.color, t.desc);
        }

        html += `
          <tr>
            <td class="t-rank">
              <div class="rank-indicator" style="${sideColor}"></div>
              ${t.rank}
            </td>
            <td>
              <div class="t-team">
                <img class="t-logo" src="${t.logo}" onerror="this.src='⚽'">
                <span>${t.name}</span>
              </div>
            </td>
            <td>${t.played}</td>
            <td>${t.wins}</td>
            <td>${t.draws}</td>
            <td>${t.losses}</td>
            <td style="direction:ltr;color:var(--text2)">${t.gd}</td>
            <td class="t-pts">${t.points}</td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
    });

    // إضافة دليل الألوان (Legend) أسفل الجدول إذا وجد
    if (uniqueRules.size > 0) {
      html += `<div class="legend-box">`;
      uniqueRules.forEach((desc, color) => {
        html += `
          <div class="legend-item">
            <div class="legend-color" style="background-color:${color}"></div>
            <span>${desc}</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    panel.innerHTML = html;
  } catch (e) {
    panel.innerHTML = `<div class="empty">⚠️ خطأ أثناء التحميل: ${e.message}</div>`;
  }
}

/* ═══ 2. RENDER LEAGUE MATCHES ═════════════════════════════════════════ */
async function loadLeagueMatches() {
  const panel = document.getElementById('panel-matches');
  panel.innerHTML = '<div class="loading"><div class="spinner"></div>جارٍ تحميل المباريات...</div>';
  
  try {
    const res = await fetch(`${WORKER}/api/league-matches?league=${currentLeague}`);
    const data = await res.json();
    
    if (!data.success || !data.matches || !data.matches.length) {
      panel.innerHTML = '<div class="empty">⚽ لا توجد مباريات مجدولة لهذه البطولة اليوم.</div>';
      return;
    }

    let html = data.matches.map(m => {
      const isLive = m.status === 'in';
      const isPre  = m.status === 'pre';
      
      let timeStr = '';
      if (isPre && m.date) {
        try { timeStr = new Date(m.date).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}); } catch(_) {}
      }

      const scoreHtml = isPre 
        ? `<div class="lgm-val pre">${timeStr || '--:--'}</div>`
        : `<div class="lgm-val ${isLive?'live':''}">${m.homeScore} - ${m.awayScore}</div>`;

      const statusHtml = m.isHalfTime
        ? `<div class="lgm-status" style="color:var(--yellow);font-weight:bold">⏸️ استراحة</div>`
        : isLive
          ? `<div class="lgm-status" style="color:var(--red);font-weight:bold">🔴 د ${m.minute || '•'}</div>`
          : isPre 
            ? `<div class="lgm-status">لم تبدأ</div>`
            : `<div class="lgm-status">✅ انتهت</div>`;

      return `
        <a class="lg-match-card" href="match.html?id=${m.id}&league=${currentLeague}">
          <div class="lgm-team">
            <img class="lgm-logo" src="${m.homeLogo}" onerror="this.src='⚽'">
            <span>${m.homeTeam}</span>
          </div>
          <div class="lgm-score">
            ${scoreHtml}
            ${statusHtml}
          </div>
          <div class="lgm-team away">
            <img class="lgm-logo" src="${m.awayLogo}" onerror="this.src='⚽'">
            <span>${m.awayTeam}</span>
          </div>
        </a>
      `;
    }).join('');

    panel.innerHTML = html;
  } catch (e) {
    panel.innerHTML = `<div class="empty">⚠️ خطأ أثناء التحميل: ${e.message}</div>`;
  }
}

/* ═══ 3. RENDER SCORERS ════════════════════════════════════════════════ */
async function loadScorers() {
  const panel = document.getElementById('panel-scorers');
  panel.innerHTML = '<div class="loading"><div class="spinner"></div>جارٍ تحميل قائمة الهدافين...</div>';
  
  try {
    const res = await fetch(`${WORKER}/api/scorers?league=${currentLeague}`);
    const data = await res.json();
    
    if (!data.success || !data.scorers || !data.scorers.length) {
      panel.innerHTML = '<div class="empty">🔥 لا تتوفر إحصائيات الهدافين حالياً.</div>';
      return;
    }

    let html = data.scorers.map(s => `
      <div class="scorer-row">
        <div class="sc-rank">#${s.rank}</div>
        <img class="sc-photo" src="${s.photo}" onerror="this.src='👤'">
        <div class="sc-info">
          <span class="sc-name">${s.name}</span>
          <div class="sc-team">
            <img class="sc-tlogo" src="${s.teamLogo}" onerror="this.style.display='none'">
            <span>${s.team}</span>
          </div>
        </div>
        <div class="sc-goals">${s.goals} <span>أهداف</span></div>
      </div>
    `).join('');

    panel.innerHTML = html;
  } catch (e) {
    panel.innerHTML = `<div class="empty">⚠️ خطأ أثناء التحميل: ${e.message}</div>`;
  }
}

/* ═══ INIT ══════════════════════════════════════════════════════════════ */
(function init() {
  const params = new URLSearchParams(window.location.search);
  const lg = params.get('league');
  const tab = params.get('tab');
  
  if (lg) currentLeague = lg;
  if (tab) currentTab = tab;
  
  switchLeague(currentLeague);
  switchTab(currentTab);
})();
</script>
</body>
</html>
