<script>
  const WORKER_URL = 'https://football-worker.mahdijadir38.workers.dev';
  let currentDate = new Date();

  function formatDate(date) {
    return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
  }

  function formatDisplayDate(date) {
    const today = new Date();
    if (formatDate(date) === formatDate(today)) return 'اليوم';
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  // ─── استخراج اسم الدوري من البيانات المتاحة ─────────────────────────
  function getLeagueName(m) {
    // إذا كان الـ Worker الجديد يعمل → leagueName صحيح مباشرة
    const raw = m.leagueName || '';

    // إذا كان يحتوي على " at " → هذا اسم مباراة وليس دوري (Worker القديم)
    if (raw.includes(' at ') || raw === '') {
      // نستخدم league slug كمعرّف
      const leagueMap = {
        'group-stage': m.name?.includes('World Cup') ? '🌍 كأس العالم FIFA' : '⚽ مباريات',
      };
      return leagueMap[m.league] || m.league || 'مباريات أخرى';
    }

    return raw;
  }

  async function loadMatches() {
    const container = document.getElementById('matchesContainer');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const url = `${WORKER_URL}/api/matches?date=${formatDate(currentDate)}&force=true`;
      const response = await fetch(url);
      const data = await response.json();
      const matches = data.matches || [];

      if (matches.length === 0) {
        container.innerHTML = '<div class="loading">⚽ لا توجد مباريات</div>';
        return;
      }

      // ─── تجميع حسب الدوري ────────────────────────────────────────────
      const groups = {};
      for (const m of matches) {
        const leagueName = getLeagueName(m);
        if (!groups[leagueName]) groups[leagueName] = [];
        groups[leagueName].push(m);
      }

      let html = '';
      for (const [leagueName, groupMatches] of Object.entries(groups)) {
        html += `<div class="league-header">${leagueName}</div>`;

        for (const m of groupMatches) {
          const isLive = m.status === 'in';
          const scoreText = m.status === 'pre' ? '-  -' : `${m.homeScore ?? 0}  -  ${m.awayScore ?? 0}`;
          const statusText = m.status === 'pre' ? '⏱️ لم تبدأ' : (isLive ? '🟢 مباشر' : '✅ انتهت');

          html += `
            <div class="match-card" onclick="location.href='match.html?id=${m.id}&league=${m.league}'">
              <div class="match-teams">
                <div class="team">
                  ${m.homeLogo ? `<img style="width:28px;height:28px;object-fit:contain" src="${m.homeLogo}" onerror="this.style.display='none'">` : ''}
                  <div class="team-name">${m.homeTeam}</div>
                </div>
                <div class="score ${isLive ? 'live' : ''}">${scoreText}</div>
                <div class="team">
                  ${m.awayLogo ? `<img style="width:28px;height:28px;object-fit:contain" src="${m.awayLogo}" onerror="this.style.display='none'">` : ''}
                  <div class="team-name">${m.awayTeam}</div>
                </div>
              </div>
              <div class="status">${statusText}${m.minute ? ' ' + m.minute + "'" : ''}</div>
            </div>
          `;
        }
      }

      container.innerHTML = html;

    } catch (error) {
      container.innerHTML = `<div class="loading">⚠️ خطأ: ${error.message}</div>`;
    }
  }

  document.getElementById('prevDay').onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    document.getElementById('dateDisplay').textContent = formatDisplayDate(currentDate);
    loadMatches();
  };
  document.getElementById('nextDay').onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    document.getElementById('dateDisplay').textContent = formatDisplayDate(currentDate);
    loadMatches();
  };
  document.getElementById('dateDisplay').onclick = () => {
    currentDate = new Date();
    document.getElementById('dateDisplay').textContent = formatDisplayDate(currentDate);
    loadMatches();
  };
  document.getElementById('navLeague').onclick = () => location.href = 'league.html';

  document.getElementById('dateDisplay').textContent = formatDisplayDate(currentDate);
  loadMatches();
</script>
