// ═══════════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers (النسخة المحسنة)
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_LEAGUES_LIST = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/leagues';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── خريطة أسماء الدوريات والبطولات (جلبها مرة واحدة) ──────────────────────────
let leaguesCache = null;
let leaguesCacheTime = 0;

async function getLeaguesList() {
  // التحقق من الكاش (كل 24 ساعة)
  if (leaguesCache && (Date.now() - leaguesCacheTime) < 24 * 60 * 60 * 1000) {
    return leaguesCache;
  }
  
  try {
    const res = await fetch(ESPN_LEAGUES_LIST, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const leagues = {};
    
    // بناء خريطة من slug إلى اسم الدوري
    for (const league of data.sports?.[0]?.leagues || []) {
      if (league.slug) {
        leagues[league.slug] = {
          name: league.name,
          flag: getFlagForLeague(league.slug),
        };
      }
    }
    
    leaguesCache = leagues;
    leaguesCacheTime = Date.now();
    return leagues;
  } catch (e) {
    return {};
  }
}

// دالة تحديد علم الدوري
function getFlagForLeague(slug) {
  const flags = {
    'eng.1': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'esp.1': '🇪🇸',
    'ger.1': '🇩🇪',
    'ita.1': '🇮🇹',
    'fra.1': '🇫🇷',
    'uefa.champions': '🏆',
    'fifa.world': '🌍',
  };
  return flags[slug] || '⚽';
}

function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};

  return {
    id: ev.id,
    league: ev.league?.slug || ev.season?.slug || '',
    leagueName: ev.league?.displayName || ev.season?.displayName || '',
    date: ev.date,
    homeTeam: home.team?.displayName || '',
    homeLogo: home.team?.logos?.[0]?.href || '',
    homeScore: home.score ?? '',
    awayTeam: away.team?.displayName || '',
    awayLogo: away.team?.logos?.[0]?.href || '',
    awayScore: away.score ?? '',
    status: status.state || 'pre',
    statusText: status.shortDetail || '',
    minute: ev.status?.displayClock || '',
    venue: comp.venue?.fullName || '',
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

async function handleMatches(url, env) {
  const date = url.searchParams.get('date') || todayStr();
  
  try {
    // جلب المباريات من ESPN
    const espnUrl = `${ESPN_ALL}?dates=${date}&limit=500`;
    const res = await fetch(espnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    let matches = (data.events || []).map(parseEvent);
    
    // جلب قائمة الدوريات لتحسين الأسماء
    const leagues = await getLeaguesList();
    
    // تحسين أسماء الدوريات
    for (const m of matches) {
      if (leagues[m.league]) {
        m.leagueName = `${leagues[m.league].flag} ${leagues[m.league].name}`;
      }
    }
    
    return new Response(JSON.stringify({ success: true, date, count: matches.length, matches }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
}

async function handleSummary(url, env) {
  const matchId = url.searchParams.get('matchId');
  const league = url.searchParams.get('league');
  if (!matchId) {
    return new Response(JSON.stringify({ error: 'matchId required' }), { status: 400, headers: CORS });
  }
  
  try {
    const espnUrl = `${ESPN_LEAGUE}/${league}/summary?event=${matchId}`;
    const res = await fetch(espnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    
    const hdr = data.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const status = comp.status?.type || {};
    
    const goals = (data.plays || [])
      .filter(p => p.type?.text === 'Goal')
      .map(g => ({
        minute: g.clock?.displayValue,
        player: g.participants?.[0]?.athlete?.displayName,
        team: g.team?.displayName,
      }));
    
    const summary = {
      id: matchId,
      league: league,
      leagueName: hdr.league?.name || '',
      date: comp.date,
      homeTeam: home.team?.displayName || '',
      homeLogo: home.team?.logos?.[0]?.href || '',
      homeScore: home.score || '0',
      awayTeam: away.team?.displayName || '',
      awayLogo: away.team?.logos?.[0]?.href || '',
      awayScore: away.score || '0',
      status: status.state || 'post',
      statusText: status.shortDetail || '',
      minute: comp.status?.displayClock || '',
      venue: comp.venue?.fullName || '',
      goals: goals,
    };
    
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/ping') {
      return new Response('pong', { headers: CORS });
    }
    if (path === '/api/matches') {
      return await handleMatches(url, env);
    }
    if (path === '/api/summary') {
      return await handleSummary(url, env);
    }
    
    return new Response('Not Found', { status: 404, headers: CORS });
  }
};
