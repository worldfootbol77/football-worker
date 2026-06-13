// ═══════════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers (النسخة النهائية التي تعمل)
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// خريطة لحفظ أسماء البطولات
const leagueNameCache = new Map();

// ─── دالة جلب اسم البطولة من summary ─────────────────────────────────────────
async function fetchLeagueNameFromSummary(matchId, league) {
  const cacheKey = `${league}`;
  
  // التحقق من الكاش
  if (leagueNameCache.has(cacheKey)) {
    return leagueNameCache.get(cacheKey);
  }
  
  try {
    const url = `${ESPN_LEAGUE}/${league}/summary?event=${matchId}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.ok) {
      const data = await res.json();
      const leagueName = data.header?.league?.name || '';
      if (leagueName && !leagueName.includes(' at ')) {
        leagueNameCache.set(cacheKey, leagueName);
        return leagueName;
      }
    }
  } catch (e) {
    console.log('فشل جلب اسم البطولة:', league);
  }
  return null;
}

// ─── دالة تحسين المباريات بإضافة اسم البطولة الصحيح ────────────────────────────
async function enhanceMatches(matches) {
  const enhanced = [];
  const leaguesToFetch = new Map();
  
  // تحديد الدوريات الفريدة
  for (const m of matches) {
    const league = m.league;
    if (league && !leaguesToFetch.has(league)) {
      leaguesToFetch.set(league, m.id);
    }
  }
  
  // جلب أسماء البطولات لكل دوري
  const promises = [];
  for (const [league, matchId] of leaguesToFetch) {
    promises.push(fetchLeagueNameFromSummary(matchId, league));
  }
  await Promise.all(promises);
  
  // تحديث المباريات بالأسماء الصحيحة
  for (const m of matches) {
    const cachedName = leagueNameCache.get(m.league);
    if (cachedName) {
      m.leagueName = cachedName;
    }
    enhanced.push(m);
  }
  
  return enhanced;
}

function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};

  return {
    id: ev.id,
    league: ev.league?.slug || ev.season?.slug || '',
    leagueName: ev.league?.displayName || ev.season?.displayName || ev.name?.split(':')[0]?.trim() || '',
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
    const espnUrl = `${ESPN_ALL}?dates=${date}&limit=500`;
    const res = await fetch(espnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    let matches = (data.events || []).map(parseEvent);
    
    // تحسين أسماء البطولات
    matches = await enhanceMatches(matches);
    
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
