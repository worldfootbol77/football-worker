// ═══════════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers
// Architecture: ESPN API + Smart Cron + KV Cache
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer';
const ESPN_STATISTICS = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer';

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// ─── GitHub Upload ────────────────────────────────────────────────────────────
async function uploadToGitHub(path, data, env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return false;
  const branch = env.GITHUB_BRANCH || 'main';
  const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  const headers = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'football-worker/1.0',
    'Accept': 'application/vnd.github+json',
  };

  let sha;
  try {
    const chk = await fetch(`${apiUrl}?ref=${branch}`, { headers });
    if (chk.ok) sha = (await chk.json()).sha;
  } catch {}

  try {
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `data: ${path}`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    return res.status === 200 || res.status === 201;
  } catch { return false; }
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function formatDate(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function generateWeekRanges(startDateStr, endDateStr) {
  const weeks = [];
  const start = new Date(`${startDateStr.slice(0, 4)}-${startDateStr.slice(4, 6)}-${startDateStr.slice(6, 8)}`);
  const end = new Date(`${endDateStr.slice(0, 4)}-${endDateStr.slice(4, 6)}-${endDateStr.slice(6, 8)}`);
  let current = new Date(start);
  while (current < end) {
    const weekStart = formatDate(current);
    current.setDate(current.getDate() + 6);
    const weekEnd = formatDate(current < end ? current : end);
    weeks.push(`${weekStart}-${weekEnd}`);
    current.setDate(current.getDate() + 1);
  }
  return weeks;
}

// ─── KV Helpers ──────────────────────────────────────────────────────────────
async function kvGet(env, key) {
  if (!env.FOOTBALL_KV) return null;
  try { return await env.FOOTBALL_KV.get(key, { type: 'json' }); }
  catch { return null; }
}

async function kvGetStr(env, key) {
  if (!env.FOOTBALL_KV) return null;
  try { return await env.FOOTBALL_KV.get(key); }
  catch { return null; }
}

async function kvPut(env, key, value, ttl = 86400) {
  if (!env.FOOTBALL_KV) return;
  try { await env.FOOTBALL_KV.put(key, JSON.stringify(value), { expirationTtl: ttl }); }
  catch {}
}

async function kvPutStr(env, key, value, ttl = 86400) {
  if (!env.FOOTBALL_KV) return;
  try { await env.FOOTBALL_KV.put(key, value, { expirationTtl: ttl }); }
  catch {}
}

// ─── ESPN Fetch ───────────────────────────────────────────────────────────────
async function espnFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FootballBot/1.0)' },
  });
  if (!res.ok) throw new Error(`ESPN ${res.status}: ${url}`);
  return res.json();
}

// ─── Map season slug → ESPN league code ──────────────────────────────────────
function slugToLeagueCode(slug) {
  if (!slug) return null;
  const s = slug.toLowerCase();

  if (s.includes('english-premier-league')) return 'eng.1';
  if (s.includes('championship') && s.includes('english')) return 'eng.2';
  if (s.includes('laliga') || s.includes('la-liga')) return 'esp.1';
  if (s.includes('german-bundesliga') && !s.includes('2-bundesliga')) return 'ger.1';
  if (s.includes('2-bundesliga')) return 'ger.2';
  if (s.includes('italian-serie-a') && !s.includes('serie-b')) return 'ita.1';
  if (s.includes('italian-serie-b')) return 'ita.2';
  if ((s.includes('ligue-1') || s.includes('ligue1')) && !s.includes('ligue-2')) return 'fra.1';
  if (s.includes('ligue-2')) return 'fra.2';
  if (s.includes('portuguesa-primeira') || s.includes('primeira-liga')) return 'por.1';
  if (s.includes('eredivisie') && !s.includes('tweede')) return 'ned.1';
  if (s.includes('scottish-premiership')) return 'sco.1';
  if (s.includes('saudi-pro-league') || s.includes('saudi-professional-league')) return 'ksa.1';
  if (s.includes('champions-league') && !s.includes('qualifier')) return 'uefa.champions';
  if (s.includes('europa-league') && !s.includes('conference')) return 'uefa.europa';
  if (s.includes('conference-league')) return 'uefa.europa.conf';
  if (s.includes('brasileiro-serie-a')) return 'bra.1';
  if (s.includes('argentine-liga') || s.includes('liga-profesional-argentina')) return 'arg.1';
  if (s.includes('libertadores')) return 'conmebol.libertadores';
  if (s.includes('sudamericana')) return 'conmebol.sudamericana';
  if (s.includes('arabian-gulf') || s.includes('uae-pro-league')) return 'uae.pro';
  if (s.includes('qatar-stars') || s.includes('qatari-stars')) return 'qat.1';
  if (s.includes('egyptian-premier') || s.includes('egyptian-league')) return 'egy.1';
  if (s.includes('moroccan-botola') || s.includes('botola')) return 'mar.1';
  if (s.includes('major-league-soccer') || s.includes('-mls')) return 'usa.1';
  if (s.includes('liga-mx') || s.includes('liga-bbva')) return 'mex.1';
  if (s.includes('world-cup') && !s.includes('qualifier')) return 'fifa.world';
  if (s.includes('world-cup-qualifying') && s.includes('uefa')) return 'uefa.world';
  if (s.includes('world-cup-qualifying') && s.includes('afc')) return 'afc.world';
  if (s.includes('world-cup-qualifying') && s.includes('caf')) return 'caf.world';
  if (s.includes('world-cup-qualifying') && s.includes('concacaf')) return 'concacaf.world';
  if (s.includes('world-cup-qualifying') && s.includes('conmebol')) return 'conmebol.world';

  return null;
}

// ========== دوال إصلاح اسم الدوري (الحل من Replit) ==========

// الخطوة 1: استخراج league_id من الـ uid
function extractLeagueId(uid = '') {
  const m = uid.match(/~l:(\d+)~/);
  return m ? parseInt(m[1]) : 0;
}

// الخطوة 2: قاموس league_id → اسم الدوري الحقيقي
const LEAGUE_ID_DISPLAY = {
  606: '🌍 كأس العالم',
  659: '🏆 دوري أبطال أوروبا',
  660: '🏆 الدوري الأوروبي',
  672: '🌍 تصفيات كأس العالم',
  687: '🏆 كأس الكونكاكاف الذهبية',
  700: '🏆 كوبا أمريكا',
  668: '🏆 دوري الأمم الأوروبية',
  681: '🏆 كأس الأمم الأفريقية',
  684: '🏆 كأس آسيا',
  523: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 الدوري الإنجليزي الممتاز',
  524: '🇪🇸 الدوري الإسباني',
  525: '🇩🇪 الدوري الألماني',
  526: '🇮🇹 الدوري الإيطالي',
  527: '🇫🇷 الدوري الفرنسي',
  528: '🇳🇱 الدوري الهولندي',
  529: '🇵🇹 الدوري البرتغالي',
  530: '🇹🇷 الدوري التركي',
  531: '🇷🇺 الدوري الروسي',
  532: '🇧🇪 الدوري البلجيكي',
  533: '🇬🇷 الدوري اليوناني',
  544: '🇸🇦 الدوري السعودي',
  545: '🇦🇪 دوري الخليج العربي',
  546: '🇶🇦 الدوري القطري',
  547: '🇪🇬 الدوري المصري',
  548: '🇲🇦 الدوري المغربي',
  549: '🇹🇳 الرابطة التونسية',
  551: '🇧🇷 الدوري البرازيلي',
  552: '🇦🇷 الدوري الأرجنتيني',
  553: '🇲🇽 الدوري المكسيكي',
  554: '🇺🇸 الدوري الأمريكي MLS',
  563: '🇯🇵 الدوري الياباني',
  564: '🇰🇷 الدوري الكوري',
  566: '🇦🇺 الدوري الأسترالي',
};

// الخطوة 3: دالة إصلاح اسم الدوري
function fixLeagueName(ev) {
  const leagueId = extractLeagueId(ev.uid || '');
  const slug = ev.season?.slug || '';
  const year = ev.season?.year || '';
  
  const isNational = (ev.competitions?.[0]?.competitors || [])
    .some(c => c.team?.logo?.includes('/countries/'));
  
  // 1. league_id من uid — الأدق دائماً
  if (leagueId && LEAGUE_ID_DISPLAY[leagueId]) {
    const name = LEAGUE_ID_DISPLAY[leagueId];
    return year && !name.includes(year) ? `${name} ${year}` : name;
  }
  
  // 2. raw_name إذا كان سليماً (لا يحتوي " at " أو " vs ")
  const raw = ev.league?.displayName || ev.season?.displayName || ev.league?.name || '';
  if (raw && !raw.includes(' at ') && !raw.includes(' vs ')) {
    return raw;
  }
  
  // 3. استنتج من الـ slug
  if (slug === 'group-stage') {
    return isNational ? `🏆 بطولة دولية ${year || ''} - دور المجموعات` : '🏆 دور المجموعات';
  }
  if (slug === 'regular-season') return '🏆 الدوري';
  if (slug === 'round-of-32') return '🏆 دور الـ 32';
  if (slug === 'round-of-16') return '🏆 دور الـ 16';
  if (slug === 'quarter-final') return '🏆 ربع النهائي';
  if (slug === 'semi-final') return '🏆 نصف النهائي';
  if (slug === 'final') return '🏆 النهائي';
  
  // 4. أزل بادئة السنة وحوّل إلى Title Case
  const clean = slug.replace(/^\d{4}-/, '');
  if (/^[a-z]{2,4}\.\d/.test(clean)) return clean;
  
  const titleCase = clean.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  if (titleCase.includes('Ireland Premier')) return `🇮🇪 ${titleCase}`;
  if (titleCase.includes('Bolivian')) return `🇧🇴 ${titleCase}`;
  if (titleCase.includes('Brasileiro')) return `🇧🇷 ${titleCase}`;
  if (titleCase.includes('Argentina')) return `🇦🇷 ${titleCase}`;
  
  return titleCase || leagueId || '🏆 بطولة';
}

// ─── Parse ESPN Event (معدل بالكامل) ─────────────────────────────────────────
function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};
  const seasonSlug = ev.season?.slug || ev.league?.slug || '';
  const leagueCode = slugToLeagueCode(seasonSlug) || seasonSlug;
  
  // استخدم الدالة الجديدة
  const leagueName = fixLeagueName(ev);
  const round = comp.notes?.[0]?.headline || (ev.season?.slug === 'group-stage' ? 'دور المجموعات' : '');

  return {
    id: ev.id,
    league: leagueCode,
    leagueName: leagueName,
    region: ev.season?.type?.displayName || '',
    date: ev.date,
    homeTeam: home.team?.displayName || '',
    homeLogo: home.team?.logos?.[0]?.href || home.team?.logo || '',
    homeScore: home.score ?? '',
    awayTeam: away.team?.displayName || '',
    awayLogo: away.team?.logos?.[0]?.href || away.team?.logo || '',
    awayScore: away.score ?? '',
    status: status.state || 'pre',
    statusText: status.shortDetail || status.description || '',
    minute: ev.status?.displayClock || '',
    venue: comp.venue?.fullName || '',
    round: round,
    season: ev.season?.year || '',
  };
}

// ─── Fetch Scoreboard ─────────────────────────────────────────────────────────
async function fetchScoreboard(dateOrRange, env, forceRefresh = false) {
  const kvKey = `scoreboard:${dateOrRange}`;

  if (!forceRefresh) {
    const cached = await kvGet(env, kvKey);
    if (cached) return cached;
  }

  try {
    let allMatches = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = `${ESPN_ALL}?dates=${dateOrRange}&limit=500${page > 1 ? `&page=${page}` : ''}`;
      const data = await espnFetch(url);
      const events = data.events || [];
      allMatches.push(...events.map(parseEvent));
      totalPages = data.pageCount || 1;
      page++;
    } while (page <= totalPages && page <= 3);

    allMatches.sort((a, b) => new Date(a.date) - new Date(b.date));

    const today = todayStr();
    const isToday = dateOrRange === today || dateOrRange.startsWith(today);
    const hasLive = allMatches.some(m => m.status === 'in');
    const ttl = hasLive ? 60 : isToday ? 300 : 2592000;

    await kvPut(env, kvKey, allMatches, ttl);
    return allMatches;
  } catch (e) {
    const cached = await kvGet(env, kvKey);
    return cached || [];
  }
}

// ─── Fetch Match Summary ──────────────────────────────────────────────────────
async function fetchAndStoreSummary(matchId, league, env) {
  if (!league || !matchId) return null;
  try {
    const raw = await espnFetch(`${ESPN_LEAGUE}/${league}/summary?event=${matchId}`);
    const hdr = raw.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const bx = raw.boxscore || {};
    const st = comp.status?.type || {};

    const goals = [];
    const cards = [];
    const subs = [];

    (raw.plays || []).forEach(p => {
      const type = p.type?.text || '';
      if (type === 'Goal' || type === 'Own Goal') {
        goals.push({
          minute: p.clock?.displayValue,
          team: p.team?.displayName,
          player: p.participants?.[0]?.athlete?.displayName,
          type: type === 'Own Goal' ? 'OG' : 'G',
        });
      }
      if (type.includes('Card')) {
        cards.push({
          minute: p.clock?.displayValue,
          team: p.team?.displayName,
          player: p.participants?.[0]?.athlete?.displayName,
          type: type,
        });
      }
      if (type === 'Substitution') {
        subs.push({
          minute: p.clock?.displayValue,
          team: p.team?.displayName,
          playerIn: p.participants?.[0]?.athlete?.displayName,
          playerOut: p.participants?.[1]?.athlete?.displayName,
        });
      }
    });

    const statsRaw = bx.teams || [];
    const homeStats = statsRaw.find(t => t.homeAway === 'home')?.statistics || [];
    const awayStats = statsRaw.find(t => t.homeAway === 'away')?.statistics || [];

    const rosters = raw.rosters || [];
    const homeRoster = rosters.find(r => r.homeAway === 'home')?.entries || [];
    const awayRoster = rosters.find(r => r.homeAway === 'away')?.entries || [];

    const note = comp.notes?.[0]?.headline || '';
    let advancement = '';
    (raw.header?.competitions?.[0]?.situation?.team || []).forEach(t => {
      if (t.isWinner) advancement = t.displayName;
    });
    const penaltyWinner = raw.header?.competitions?.[0]?.situation?.lastPlay?.team?.displayName || '';

    const summary = {
      id: matchId,
      league: league,
      leagueName: raw.header?.league?.name || hdr.league?.name || '',
      date: comp.date,
      homeTeam: home.team?.displayName || '',
      homeLogo: home.team?.logos?.[0]?.href || home.team?.logo || '',
      homeScore: home.score || '0',
      awayTeam: away.team?.displayName || '',
      awayLogo: away.team?.logos?.[0]?.href || away.team?.logo || '',
      awayScore: away.score || '0',
      status: st.state || 'post',
      statusText: st.shortDetail || '',
      minute: hdr.competitions?.[0]?.status?.displayClock || '',
      venue: comp.venue?.fullName || '',
      round: note,
      season: raw.header?.season?.year || '',
      goals,
      cards,
      subs,
      homeStats: homeStats.map(s => ({ name: s.name, value: s.displayValue })),
      awayStats: awayStats.map(s => ({ name: s.name, value: s.displayValue })),
      homeLineup: homeRoster.map(e => ({ name: e.athlete?.displayName, position: e.position?.abbreviation, starter: e.starter, jersey: e.jersey })),
      awayLineup: awayRoster.map(e => ({ name: e.athlete?.displayName, position: e.position?.abbreviation, starter: e.starter, jersey: e.jersey })),
      advancement,
      penaltyWinner,
      lineupFetched: homeRoster.length > 0,
    };

    const isLive = st.state === 'in';
    const ttl = isLive ? 1020 : 7776000;

    await kvPut(env, `summary:${matchId}`, summary, ttl);
    return summary;
  } catch {
    return null;
  }
}

// ─── Group matches by exact start time ───────────────────────────────────────
function groupByStartTime(matches) {
  const groups = {};
  for (const m of matches) {
    const t = new Date(m.date).getTime();
    if (isNaN(t)) continue;
    if (!groups[t]) groups[t] = { anchorTime: t, matches: [] };
    groups[t].matches.push(m);
  }
  return Object.values(groups).sort((a, b) => a.anchorTime - b.anchorTime);
}

// ─── Smart Scoreboard Refresh ─────────────────────────────────────────────────
async function smartRefresh(env) {
  const today = todayStr();
  const now = Date.now();

  let state = await kvGet(env, `state:${today}`) || {
    date: today,
    lastScoreboardFetch: 0,
    processedGroupTimes: [],
    matchWindows: [],
    activeMatchIds: [],
    lastSummaryFetch: {},
    lineupAttempts: {},
  };

  if (state.matchWindows.length === 0) {
    const matches = await fetchScoreboard(today, env, true);
    if (matches.length === 0) {
      console.log('📭 لا توجد مباريات اليوم، لن يتم إرسال أي طلبات');
      return;
    }

    const times = matches.map(m => new Date(m.date).getTime()).filter(t => !isNaN(t));
    const groups = [];
    let grpStart = null, grpEnd = null;
    times.sort((a, b) => a - b).forEach(t => {
      if (!grpStart) { grpStart = t; grpEnd = t; }
      else if (t - grpEnd > 2 * 60 * 60 * 1000) {
        groups.push({ start: grpStart, end: grpEnd });
        grpStart = t; grpEnd = t;
      } else {
        grpEnd = t + 2 * 60 * 60 * 1000;
      }
    });
    if (grpStart) groups.push({ start: grpStart, end: grpEnd });
    state.matchWindows = groups;
    await kvPut(env, `state:${today}`, state, 86400);

    if (state.matchWindows.length === 0) return;
  }

  const interval = (2 + Math.random() * 1.5) * 60 * 1000;
  const inWindow = state.matchWindows.some(w => now >= w.start - 5 * 60 * 1000 && now <= w.end + 30 * 60 * 1000);

  if (!inWindow) return;
  if (now - state.lastScoreboardFetch < interval) return;

  const matches = await fetchScoreboard(today, env, true);
  state.lastScoreboardFetch = now;

  const liveMatches = matches.filter(m => m.status === 'in');
  const summaryFetches = [];

  for (const m of liveMatches) {
    const score = `${m.homeScore}-${m.awayScore}`;
    const prevKey = `prev:${m.id}`;
    const prevScore = await kvGetStr(env, prevKey);
    const existing = await kvGet(env, `summary:${m.id}`);
    const lineupDone = existing?.lineupFetched === true;
    const lineupAttempts = (state.lineupAttempts?.[m.id]) || 0;

    let willFetch = false;

    if (prevScore !== score) {
      summaryFetches.push(fetchAndStoreSummary(m.id, m.league, env));
      await kvPutStr(env, prevKey, score, 86400);
      willFetch = true;
    } else {
      const lastFetch = state.lastSummaryFetch?.[m.id] || 0;
      const summaryInterval = (15 + Math.random() * 5) * 60 * 1000;
      if (now - lastFetch > summaryInterval) {
        summaryFetches.push(fetchAndStoreSummary(m.id, m.league, env));
        if (!state.lastSummaryFetch) state.lastSummaryFetch = {};
        state.lastSummaryFetch[m.id] = now;
        willFetch = true;
      }
    }

    if (!lineupDone && lineupAttempts < 2 && !willFetch) {
      summaryFetches.push(fetchAndStoreSummary(m.id, m.league, env));
      if (!state.lineupAttempts) state.lineupAttempts = {};
      state.lineupAttempts[m.id] = lineupAttempts + 1;
    }
  }

  await Promise.allSettled(summaryFetches);

  const processedTimes = new Set(state.processedGroupTimes || []);
  const timeGroups = groupByStartTime(matches);
  const standingsFetches = [];

  for (const group of timeGroups) {
    if (processedTimes.has(group.anchorTime)) continue;

    const allFinished = group.matches.every(m => m.status === 'post');
    if (!allFinished) continue;

    const leagueSeasonMap = {};
    for (const m of group.matches) {
      if (m.league) leagueSeasonMap[m.league] = m.season || '';
    }

    for (const [league, season] of Object.entries(leagueSeasonMap)) {
      standingsFetches.push(refreshStandingsForLeague(league, season, env));
      standingsFetches.push(refreshScorersForLeague(league, season, env));
    }

    processedTimes.add(group.anchorTime);
  }

  state.processedGroupTimes = [...processedTimes];
  await Promise.allSettled(standingsFetches);
  await kvPut(env, `state:${today}`, state, 86400);
}

// ─── Known Leagues ────────────────────────────────────────────────────────────
const KNOWN_LEAGUES = [
  'eng.1', 'eng.2', 'esp.1', 'esp.2', 'ger.1', 'ger.2', 'ita.1', 'ita.2',
  'fra.1', 'fra.2', 'por.1', 'ned.1', 'sco.1', 'bel.1', 'gre.1', 'rus.1',
  'ksa.1', 'qat.1', 'uae.pro', 'egy.1', 'mar.1', 'tun.1', 'bra.1', 'arg.1',
  'mex.1', 'usa.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf',
  'conmebol.libertadores', 'conmebol.sudamericana', 'fifa.world',
  'uefa.world', 'afc.world', 'caf.world', 'concacaf.world', 'conmebol.world'
];

const NO_STANDINGS = new Set([
  'uefa.europa', 'uefa.europa.conf', 'fifa.world', 'uefa.world', 'afc.world', 
  'caf.world', 'concacaf.world', 'conmebol.world'
]);

// ─── Standings & Scorers Refresh ──────────────────────────────────────────────
async function refreshStandingsForLeague(league, season, env) {
  try {
    const seasonParam = season ? `?season=${season}` : '';
    const raw = await espnFetch(`${ESPN_STANDINGS}/${league}/standings${seasonParam}`);

    const children = raw.children || [];
    let entries = [];

    if (children.length > 0) {
      const child = children[0];
      const standingsEntries = child.standings?.entries || child.children?.[0]?.standings?.entries || [];
      entries = standingsEntries.map((entry, i) => {
        const stats = {};
        (entry.stats || []).forEach(s => { stats[s.name] = s.value; });
        return {
          rank: i + 1,
          team: entry.team?.displayName || '',
          logo: entry.team?.logos?.[0]?.href || '',
          gp: stats.gamesPlayed || 0,
          w: stats.wins || 0,
          d: stats.ties || 0,
          l: stats.losses || 0,
          gd: stats.pointDifferential || 0,
          pts: stats.points || 0,
        };
      });
    }

    const payload = {
      success: true,
      league,
      leagueName: raw.name || raw.standings?.name || league,
      season: season || raw.season?.year || '',
      entries,
    };
    await kvPut(env, `standings:${league}:${season || ''}`, payload, 21600);
    return payload;
  } catch { return null; }
}

async function refreshScorersForLeague(league, season, env) {
  try {
    const sep = season ? `?season=${season}&` : '?';
    const raw = await espnFetch(`${ESPN_STATISTICS}/${league}/statistics${sep}limit=30`);

    const goalsCat = (raw.stats || []).find(s =>
      s.name === 'goalsLeaders' ||
      s.abbreviation?.toLowerCase() === 'g' ||
      s.displayName?.toLowerCase().includes('goal')
    ) || raw.stats?.[0];

    const scorers = (goalsCat?.leaders || []).map((ld, i) => {
      const at = ld.athlete || {};
      return {
        rank: i + 1,
        name: at.displayName || '',
        photo: at.team?.logos?.[1]?.href || at.team?.logos?.[0]?.href || '',
        team: at.team?.displayName || '',
        teamLogo: at.team?.logos?.[0]?.href || '',
        goals: ld.value || 0,
      };
    });

    const payload = {
      success: true,
      league,
      leagueName: raw.league?.name || raw.name || league,
      season: season || raw.season?.year || '',
      scorers,
    };
    await kvPut(env, `scorers:${league}:${season || ''}`, payload, 21600);
    return payload;
  } catch { return null; }
}

// ─── Fixtures Refresh ─────────────────────────────────────────────────────────
async function refreshFixtures(env) {
  const today = todayStr();
  let days = 7;
  let allMatches = [];

  while (days <= 60 && allMatches.length === 0) {
    const end = addDays(today, days);
    try {
      const data = await espnFetch(`${ESPN_ALL}?dates=${today}-${end}&limit=500`);
      const events = (data.events || []).map(parseEvent).filter(m => m.status === 'pre');
      allMatches.push(...events);
      if (events.length === 0) days = days < 30 ? 30 : 60;
      else break;
    } catch { break; }
  }

  allMatches.sort((a, b) => new Date(a.date) - new Date(b.date));
  const payload = {
    success: true,
    fetchedDays: days,
    count: allMatches.length,
    matches: allMatches,
    updatedAt: new Date().toISOString(),
  };
  await kvPut(env, 'fixtures:cache', payload, 6 * 3600);
  return payload;
}

// ─── Archive Step ─────────────────────────────────────────────────────────────
async function archiveStep(env) {
  let archiveState = await kvGet(env, 'archive:state');

  if (!archiveState) {
    const weeks = generateWeekRanges('20200101', todayStr());
    archiveState = { weeks, currentIndex: 0, completed: false };
    await kvPut(env, 'archive:state', archiveState, 90 * 86400);
  }

  if (archiveState.completed) return;

  const { weeks, currentIndex } = archiveState;
  if (currentIndex >= weeks.length) {
    archiveState.completed = true;
    await kvPut(env, 'archive:state', archiveState, 90 * 86400);
    return;
  }

  const week = weeks[currentIndex];
  const ghPath = `data/archive/${week}.json`;
  const useGitHub = !!(env.GITHUB_TOKEN && env.GITHUB_REPO);

  let alreadyUploaded = false;
  if (useGitHub) {
    try {
      const chk = await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${ghPath}?ref=${env.GITHUB_BRANCH || 'main'}`,
        { headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'football-worker/1.0' } }
      );
      alreadyUploaded = chk.ok;
    } catch {}
  } else {
    alreadyUploaded = !!(await kvGet(env, `scoreboard:${week}`));
  }

  if (!alreadyUploaded) {
    try {
      let allMatches = [];
      let page = 1;
      let totalPages = 1;
      do {
        const url = `${ESPN_ALL}?dates=${week}&limit=500${page > 1 ? `&page=${page}` : ''}`;
        const data = await espnFetch(url);
        allMatches.push(...(data.events || []).map(parseEvent));
        totalPages = data.pageCount || 1;
        page++;
      } while (page <= totalPages && page <= 3);

      const byDate = {};
      allMatches.forEach(m => {
        const d = formatDate(m.date);
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(m);
      });

      if (useGitHub) {
        await uploadToGitHub(ghPath, allMatches, env);
        await Promise.allSettled(
          Object.entries(byDate).map(([d, matches]) =>
            uploadToGitHub(`data/scoreboard/${d}.json`, matches, env)
          )
        );
      } else {
        await kvPut(env, `scoreboard:${week}`, allMatches, 90 * 86400);
        for (const [d, matches] of Object.entries(byDate)) {
          await kvPut(env, `scoreboard:${d}`, matches, 90 * 86400);
        }
      }
    } catch {}
  }

  archiveState.currentIndex = currentIndex + 1;
  await kvPut(env, 'archive:state', archiveState, 90 * 86400);
}

// ─── Deep Future Scan ─────────────────────────────────────────────────────────
async function deepFutureScan(env) {
  const lastRun = await kvGet(env, 'deep:lastRun');
  if (lastRun && Date.now() - lastRun < 23 * 60 * 60 * 1000) return;

  const today = todayStr();

  let allMatches = [];
  try {
    let page = 1;
    let totalPages = 1;
    const range = `${today}-${addDays(today, 365)}`;
    do {
      const url = `${ESPN_ALL}?dates=${range}&limit=500${page > 1 ? `&page=${page}` : ''}`;
      const data = await espnFetch(url);
      allMatches.push(...(data.events || []).map(parseEvent));
      totalPages = data.pageCount || 1;
      page++;
    } while (page <= totalPages && page <= 3);
  } catch {}

  const upcoming = allMatches
    .filter(m => m.status === 'pre' && new Date(m.date) > new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  await kvPut(env, 'fixtures:future', upcoming, 30 * 86400);
  await kvPut(env, 'deep:lastRun', Date.now(), 86400);
}

// ─── Historical Standings & Scorers (مرة واحدة فقط) ──────────────────────────
async function checkAndRunHistorical(env) {
  const hasRun = await kvGet(env, 'historical:done');
  if (hasRun) return;

  console.log('🚀 بدء جلب المواسم السابقة...');
  const currentYear = new Date().getFullYear();
  const pastSeasons = [];
  for (let year = 2020; year < currentYear; year++) {
    pastSeasons.push(String(year));
  }

  for (const league of KNOWN_LEAGUES) {
    for (const season of pastSeasons) {
      if (!NO_STANDINGS.has(league)) {
        try {
          await refreshStandingsForLeague(league, season, env);
          await new Promise(r => setTimeout(r, 500));
        } catch {}
      }
      try {
        await refreshScorersForLeague(league, season, env);
        await new Promise(r => setTimeout(r, 500));
      } catch {}
    }
  }

  await kvPut(env, 'historical:done', true, 365 * 86400);
  console.log('✅ انتهى جلب المواسم السابقة');
}

// ─── API Handlers ─────────────────────────────────────────────────────────────
async function handleMatches(url, env) {
  const date = url.searchParams.get('date') || todayStr();
  const league = url.searchParams.get('league') || 'all';

  let matches = await fetchScoreboard(date, env);

  if (league !== 'all') {
    matches = matches.filter(m =>
      m.league === league ||
      m.leagueName?.toLowerCase().includes(league.toLowerCase())
    );
  }

  return jsonResp({ success: true, date, league, count: matches.length, matches });
}

async function handleSummaryAPI(url, env) {
  const matchId = url.searchParams.get('matchId');
  const league = url.searchParams.get('league');
  if (!matchId) return errResp('matchId required', 400);

  let data = await kvGet(env, `summary:${matchId}`);
  if (!data && league) data = await fetchAndStoreSummary(matchId, league, env);
  if (!data) return errResp('Match not found', 404);

  return jsonResp({ success: true, ...data });
}

async function handleStandingsAPI(url, env) {
  const league = url.searchParams.get('league') || 'eng.1';
  const season = url.searchParams.get('season') || '';

  let payload = await kvGet(env, `standings:${league}:${season}`);
  if (!payload) payload = await refreshStandingsForLeague(league, season, env);
  if (!payload) return errResp('No standings data', 404);

  return jsonResp(payload);
}

async function handleScorersAPI(url, env) {
  const league = url.searchParams.get('league') || 'eng.1';
  const season = url.searchParams.get('season') || '';

  let payload = await kvGet(env, `scorers:${league}:${season}`);
  if (!payload) payload = await refreshScorersForLeague(league, season, env);
  if (!payload) return errResp('No scorers data', 404);

  return jsonResp(payload);
}

async function handleFixturesAPI(url, env) {
  let payload = await kvGet(env, 'fixtures:cache');
  if (!payload) payload = await refreshFixtures(env);
  if (!payload) return errResp('No fixtures data', 404);

  const future = await kvGet(env, 'fixtures:future');
  if (Array.isArray(future) && future.length) {
    const ids = new Set(payload.matches.map(m => m.id));
    const extra = future.filter(m => !ids.has(m.id));
    if (extra.length) {
      const merged = [...payload.matches, ...extra].sort((a, b) => new Date(a.date) - new Date(b.date));
      payload = { ...payload, matches: merged, count: merged.length };
    }
  }

  const league = url.searchParams.get('league');
  if (league && league !== 'all') {
    payload = { ...payload, matches: payload.matches.filter(m => m.league === league || m.leagueName?.toLowerCase().includes(league.toLowerCase())) };
  }

  return jsonResp(payload);
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function errResp(msg, status = 500) {
  return jsonResp({ success: false, error: msg }, status);
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/ping') return new Response('pong', { headers: CORS });
      if (path === '/api/matches') return await handleMatches(url, env);
      if (path === '/api/summary') return await handleSummaryAPI(url, env);
      if (path === '/api/standings') return await handleStandingsAPI(url, env);
      if (path === '/api/scorers') return await handleScorersAPI(url, env);
      if (path === '/api/fixtures') return await handleFixturesAPI(url, env);

      return errResp('Not Found', 404);
    } catch (e) {
      return errResp(e.message);
    }
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron;

    if (cron === '* * * * *') {
      ctx.waitUntil(smartRefresh(env));
    }

    if (cron === '0 */6 * * *') {
      ctx.waitUntil(refreshFixtures(env));
    }

    if (cron === '*/20 * * * *') {
      const archiveState = await kvGet(env, 'archive:state');
      if (!archiveState?.completed) {
        ctx.waitUntil(archiveStep(env));
      } else {
        ctx.waitUntil(deepFutureScan(env));
      }
    }

    if (cron === '0 2 * * *') {
      ctx.waitUntil(checkAndRunHistorical(env));
    }
  },
};