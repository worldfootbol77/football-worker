// ═══════════════════════════════════════════════════════════════════════════════
// src/worker.js — النسخة الكاملة والموحدة لتطبيق Scorio
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL    = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── جدول تحويل معرّفات ESPN الرقمية إلى رموز الدوريات ─────────────────────────
const ID_TO_CODE = {
  "2":    "uefa.champions",
  "3":    "uefa.europa",
  "9":    "fra.1",
  "10":   "ger.1",
  "11":   "ger.2",
  "12":   "ger.dfb_pokal",
  "13":   "ita.1",
  "14":   "ita.2",
  "15":   "esp.1",
  "16":   "esp.2",
  "17":   "esp.copa_del_rey",
  "18":   "ita.coppa_italia",
  "19":   "fra.coupe_de_france",
  "22":   "eng.1",
  "23":   "eng.2",
  "24":   "eng.fa",
  "25":   "eng.le league_cup",
  "199":  "uefa.nations",
  "211":  "uefa.euro",
  "561":  "fifa.world"
};

// ─── قواعد الألوان للتأهل والهبوط ──────────────────────────────────────────────
const CONTINENTAL_RULES = {
  "uefa.euro": {
    1: { color: "#81D6AC", desc: "تأهل لدور الـ 16" },
    2: { color: "#81D6AC", desc: "تأهل لدور الـ 16" },
    3: { color: "#B2BFD0", desc: "أفضل ثوالث (تأهل لدور الـ 16)" }
  },
  "fifa.world": {
    1: { color: "#81D6AC", desc: "تأهل لدور الـ 16" },
    2: { color: "#81D6AC", desc: "تأهل لدور الـ 16" }
  },
  "uefa.champions": {
    1: { color: "#81D6AC", desc: "مرحلة خروج المغلوب" },
    2: { color: "#81D6AC", desc: "مرحلة خروج المغلوب" },
    3: { color: "#81D6AC", desc: "مرحلة خروج المغلوب" },
    4: { color: "#81D6AC", desc: "مرحلة خروج المغلوب" },
    5: { color: "#81D6AC", desc: "مرحلة خروج المغلوب" },
    6: { color: "#81D6AC", desc: "مرحلة خروج المغلوب" },
    7: { color: "#81D6AC", desc: "مرحلة خروج المغلوب" },
    8: { color: "#81D6AC", desc: "مرحلة خروج المغلوب" },
    9: { color: "#A2DBEE", desc: "جولة التصفيات" },
    10: { color: "#A2DBEE", desc: "جولة التصفيات" },
    11: { color: "#A2DBEE", desc: "جولة التصفيات" },
    12: { color: "#A2DBEE", desc: "جولة التصفيات" },
    13: { color: "#A2DBEE", desc: "جولة التصفيات" },
    14: { color: "#A2DBEE", desc: "جولة التصفيات" },
    15: { color: "#A2DBEE", desc: "جولة التصفيات" },
    16: { color: "#A2DBEE", desc: "جولة التصفيات" },
    17: { color: "#A2DBEE", desc: "جولة التصفيات" },
    18: { color: "#A2DBEE", desc: "جولة التصفيات" },
    19: { color: "#A2DBEE", desc: "جولة التصفيات" },
    20: { color: "#A2DBEE", desc: "جولة التصفيات" },
    21: { color: "#A2DBEE", desc: "جولة التصفيات" },
    22: { color: "#A2DBEE", desc: "جولة التصفيات" },
    23: { color: "#A2DBEE", desc: "جولة التصفيات" },
    24: { color: "#A2DBEE", desc: "جولة التصفيات" }
  },
  "eng.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    5: { color: "#A2DBEE", desc: "الدوري الأوروبي" },
    18: { color: "#F7ADB6", desc: "هبوط لدوري البطولة الإنجليزية" },
    19: { color: "#F7ADB6", desc: "هبوط لدوري البطولة الإنجليزية" },
    20: { color: "#F7ADB6", desc: "هبوط لدوري البطولة الإنجليزية" }
  },
  "esp.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    5: { color: "#A2DBEE", desc: "الدوري الأوروبي" },
    18: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" },
    19: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" },
    20: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" }
  },
  "ita.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    5: { color: "#A2DBEE", desc: "الدوري الأوروبي" },
    18: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" },
    19: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" },
    20: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" }
  },
  "ger.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    5: { color: "#A2DBEE", desc: "الدوري الأوروبي" },
    16: { color: "#FAD3A2", desc: "ملحق الهبوط" },
    17: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" },
    18: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" }
  },
  "fra.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#A2DBEE", desc: "تصفيات دوري الأبطال" },
    5: { color: "#B2BFD0", desc: "الدوري الأوروبي" },
    16: { color: "#FAD3A2", desc: "ملحق الهبوط" },
    17: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" },
    18: { color: "#F7ADB6", desc: "هبوط للدرجة الثانية" }
  }
};

// ─── KV Cache helpers ──────────────────────────────────────────────────────────
async function kvGet(env, key) {
  try { return await env?.FOOTBALL_KV?.get(key, 'json'); } catch(_) { return null; }
}
async function kvPut(env, key, value, ttl) {
  try { await env?.FOOTBALL_KV?.put(key, JSON.stringify(value), { expirationTtl: ttl }); } catch(_) {}
}

const TTL_LIVE      = 60;    // مباريات مباشرة — دقيقة واحدة
const TTL_MATCHES   = 300;   // مباريات اليوم — 5 دقائق
const TTL_SUMMARY   = 90;    // تفاصيل مباراة — 90 ثانية
const TTL_FINISHED  = 3600;  // مباريات منتهية — ساعة
const TTL_STANDINGS = 7200;  // الترتيب — ساعتان
const TTL_SCORERS   = 7200;  // الهدافون — ساعتان

// ─── دالة استخراج وتنسيق بيانات المباراة ─────────────────────────────────────────
function parseMatch(event, targetLeagueCode = null) {
  const statusType = event.status?.type?.state; 
  const statusText = event.status?.type?.detail || '';
  const isLive     = statusType === 'in';
  const isFinished = statusType === 'post';

  const espnLeagueId = event.leagueId || '';
  const leagueCode   = targetLeagueCode || ID_TO_CODE[espnLeagueId] || 'all';

  const comp  = event.competitions?.[0];
  const home  = comp?.competitors?.[0];
  const away  = comp?.competitors?.[1];

  let homeScore = '', awayScore = '';
  if (isLive || isFinished || comp?.score) {
    homeScore = home?.score ?? '';
    awayScore = away?.score ?? '';
  }

  // استخراج التوقيت
  let timeStr = '';
  if (!isLive && !isFinished && event.date) {
    try {
      const d = new Date(event.date);
      timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch(_) {
      timeStr = statusText;
    }
  } else {
    timeStr = statusText;
  }

  return {
    id: event.id,
    league: leagueCode,
    homeTeam: home?.team?.displayName || 'Home Team',
    homeLogo: home?.team?.logo || '',
    homeScore: homeScore,
    awayTeam: away?.team?.displayName || 'Away Team',
    awayLogo: away?.team?.logo || '',
    awayScore: awayScore,
    time: timeStr,
    isLive,
    isFinished,
    statusCode: event.status?.type?.name
  };
}

// ─── 1. معالج مباريات اليوم / البطولة ──────────────────────────────────────────
async function handleMatches(url, env) {
  const league = url.searchParams.get('league') || 'all';
  let date     = url.searchParams.get('date') || '';
  if (date.includes('T')) date = date.split('T')[0];

  const kvKey = `matches_${league}_${date || 'today'}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return new Response(JSON.stringify(cached), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  let fetchUrl = ESPN_ALL;
  if (league !== 'all') {
    fetchUrl = `${ESPN_LEAGUE}/${league}/scoreboard`;
  }
  if (date) {
    const cleanDate = date.replace(/-/g, '');
    fetchUrl += `?dates=${cleanDate}`;
  }

  try {
    const res = await fetch(fetchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();

    let matches = [];
    let leagueName = 'كل البطولات';
    let leagueLogo = '';

    if (league === 'all') {
      const events = data.events || [];
      events.forEach(ev => {
        const espnId = ev.leagues?.[0]?.id;
        if (ID_TO_CODE[espnId]) {
          ev.leagueId = espnId;
          matches.push(parseMatch(ev));
        }
      });
    } else {
      const events = data.events || [];
      const leagueInfo = data.leagues?.[0] || {};
      leagueName = leagueInfo.displayName || league;
      leagueLogo = leagueInfo.logos?.[0]?.href || '';

      events.forEach(ev => {
        matches.push(parseMatch(ev, league));
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday  = !date || date === todayStr;
    const hasLive  = matches.some(m => m.isLive);

    const result = { success: true, league, date, leagueName, leagueLogo, count: matches.length, matches };
    const ttl    = hasLive ? TTL_LIVE : isToday ? TTL_MATCHES : TTL_FINISHED;
    await kvPut(env, kvKey, result, ttl);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── 2. معالج تفاصيل وملخص المباراة ───────────────────────────────────────────
async function handleSummary(url, env) {
  const id     = url.searchParams.get('id');
  const league = url.searchParams.get('league') || 'all';
  if (!id) return new Response(JSON.stringify({ success: false, error: 'Missing match id' }), { status: 400, headers: CORS });

  const kvKey = `summary_${id}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return new Response(JSON.stringify(cached), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  const fetchUrl = `${ESPN_LEAGUE}/${league}/summary?event=${id}`;

  try {
    const res = await fetch(fetchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();

    const header  = data.header || {};
    const evInfo  = header.competitions?.[0] || {};
    const homeObj = evInfo.competitors?.[0] || {};
    const awayObj = evInfo.competitors?.[1] || {};

    const statusType = header.status?.type?.state;
    const isLive     = statusType === 'in';
    const isFinished = statusType === 'post';

    const info = {
      id: header.id,
      league: league,
      homeTeam: homeObj.team?.displayName || '',
      homeLogo: homeObj.team?.logo || '',
      homeScore: homeObj.score || '0',
      awayTeam: awayObj.team?.displayName || '',
      awayLogo: awayObj.team?.logo || '',
      awayScore: awayObj.score || '0',
      statusText: header.status?.type?.detail || '',
      isLive,
      isFinished
    };

    // التشكيلة (Lineups)
    const rosters = data.rosters || [];
    const parseLineup = (roster) => {
      if (!roster) return { formation: '', starters: [], substitutes: [] };
      const formation = roster.formation || '';
      const rosterList = roster.roster || [];
      const starters = rosterList.filter(p => p.starter).map(p => ({
        name: p.athlete?.displayName || '',
        jersey: p.jersey || '',
        position: p.athlete?.position?.abbreviation || '',
        coord: p.position?.coordinate || null
      }));
      const substitutes = rosterList.filter(p => !p.starter).map(p => ({
        name: p.athlete?.displayName || '',
        jersey: p.jersey || '',
        position: p.athlete?.position?.abbreviation || ''
      }));
      return { formation, starters, substitutes };
    };
    const lineups = {
      home: parseLineup(rosters.find(r => r.teamId === homeObj.id)),
      away: parseLineup(rosters.find(r => r.teamId === awayObj.id))
    };

    // الإحصائيات (Stats)
    const boxscore = data.boxscore || {};
    const teamsStats = boxscore.teams || [];
    const homeStats = teamsStats.find(t => t.team?.id === homeObj.id)?.statistics || [];
    const awayStats = teamsStats.find(t => t.team?.id === awayObj.id)?.statistics || [];

    const allLabels = Array.from(new Set([...homeStats.map(s => s.label), ...awayStats.map(s => s.label)]));
    const stats = allLabels.map(label => {
      const h = homeStats.find(s => s.label === label);
      const a = awayStats.find(s => s.label === label);
      return {
        label,
        home: h?.displayValue || '0',
        away: a?.displayValue || '0'
      };
    });

    // الأحداث (Events)
    const keyEvents = data.keyEvents || [];
    const events = keyEvents.map(e => ({
      id: e.id,
      text: e.text || '',
      type: e.type?.text || '',
      clock: e.clock?.displayValue || '',
      teamId: e.team?.id || ''
    }));

    const result = { success: true, info, lineups, stats, events };
    const ttl    = isLive ? TTL_LIVE : isFinished ? TTL_FINISHED : TTL_SUMMARY;
    await kvPut(env, kvKey, result, ttl);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── 3. معالج جدول الترتيب ────────────────────────────────────────────────────
async function handleStandings(url, env) {
  const league = url.searchParams.get('league');
  if (!league || league === 'all') return new Response(JSON.stringify({ success: false, error: 'يجب اختيار بطولة محددة لعرض الترتيب' }), { status: 400, headers: CORS });

  const kvKey = `standings_${league}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return new Response(JSON.stringify(cached), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  const fetchUrl = `${ESPN_LEAGUE}/${league}/standings`;

  try {
    const res = await fetch(fetchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();

    const children = data.standings?.children || [];
    let parsedGroups = [];

    const extractTable = (groupObj) => {
      const teamsList = groupObj.standings?.entries || [];
      return teamsList.map(entry => {
        const team  = entry.team || {};
        const stats = entry.stats || [];

        const getStat = (id) => stats.find(s => s.id === id || s.name === id)?.value ?? 0;
        const getStatDisplay = (id) => stats.find(s => s.id === id || s.name === id)?.displayValue ?? '0';

        const rank = entry.summary || '';

        // استخراج تفاصيل التأهل والهبوط
        let note = { color: '', desc: '' };
        if (CONTINENTAL_RULES[league] && CONTINENTAL_RULES[league][parseInt(rank)]) {
          note = CONTINENTAL_RULES[league][parseInt(rank)];
        } else if (entry.note?.text) {
          note = { color: '#B2BFD0', desc: entry.note.text };
        }

        return {
          rank:      parseInt(rank) || 0,
          teamName:  team.displayName || '',
          teamLogo:  team.logos?.[0]?.href || '',
          played:    getStat('gamesPlayed'),
          won:       getStat('wins'),
          drawn:     getStat('ties'),
          lost:      getStat('losses'),
          goalsFor:  getStat('pointsFor'),
          goalsAgainst: getStat('pointsAgainst'),
          goalDiff:  getStatDisplay('pointDifferential'),
          points:    getStat('points'),
          note:      note
        };
      });
    };

    if (children.length > 0 && children[0].standings) {
      // دوري بنظام المجموعات (مثل دوري الأبطال أو كأس العالم)
      children.forEach(child => {
        parsedGroups.push({
          groupName: child.displayName || '',
          table: extractTable(child)
        });
      });
    } else if (data.standings) {
      // دوري محلي بنظام جدول واحد
      parsedGroups.push({
        groupName: data.standings.displayName || 'جدول الترتيب',
        table: extractTable(data)
      });
    }

    const result = { success: true, league, groups: parsedGroups };
    await kvPut(env, kvKey, result, TTL_STANDINGS);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── 4. معالج الهدافين ───────────────────────────────────────────────────────
async function handleScorers(url, env) {
  const league = url.searchParams.get('league');
  if (!league || league === 'all') return new Response(JSON.stringify({ success: false, error: 'يجب اختيار بطولة محددة لعرض الهدافين' }), { status: 400, headers: CORS });

  const kvKey = `scorers_${league}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return new Response(JSON.stringify(cached), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  const fetchUrl = `${ESPN_LEAGUE}/${league}/leaders`;

  try {
    const res = await fetch(fetchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();

    const categories = data.leaders?.categories || [];
    // البحث عن الفئة الخاصة بالأهداف (goals)
    const goalsCat = categories.find(c => c.name === 'goals' || c.displayName?.toLowerCase().includes('goal'));
    const leadersList = goalsCat?.leaders || [];

    const scorers = leadersList.map((l, i) => ({
      rank:     i + 1,
      name:     l.athlete?.displayName || l.displayName || '',
      photo:    l.athlete?.headshot?.href || '',
      team:     l.team?.displayName || l.team?.name || '',
      teamLogo: l.team?.logos?.[0]?.href || l.team?.logo || '',
      goals:    parseInt(l.value) || 0,
    }));

    const result = { success: true, league, scorers };
    await kvPut(env, kvKey, result, TTL_SCORERS);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    
    const url  = new URL(request.url);
    const path = url.pathname;

    if (path === '/ping')                return new Response('pong', { headers: CORS });
    if (path === '/api/matches')         return await handleMatches(url, env);
    if (path === '/api/summary')         return await handleSummary(url, env);
    if (path === '/api/standings')       return await handleStandings(url, env);
    if (path === '/api/scorers')         return await handleScorers(url, env);

    return new Response(JSON.stringify({ success: false, error: 'Not Found' }), { status: 404, headers: CORS });
  }
};
