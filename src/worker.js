// ═══════════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers (النسخة النهائية الصحيحة)
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── دالة تحديد علم الدوري من الـ slug ────────────────────────────────────────
function getFlagForLeague(slug) {
  const flags = {
    'eng.1': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'esp.1': '🇪🇸',
    'ger.1': '🇩🇪',
    'ita.1': '🇮🇹',
    'fra.1': '🇫🇷',
    'por.1': '🇵🇹',
    'ned.1': '🇳🇱',
    'sco.1': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'uefa.champions': '🏆',
    'uefa.europa': '🏆',
    'fifa.world': '🌍',
    'conmebol.libertadores': '🏆',
  };
  return flags[slug] || '⚽';
}

// ─── دالة تحليل المباراة باستخدام leagueMap ───────────────────────────────────
function parseEvent(ev, leagueMap) {
  const comp = ev.competitions?.[0] || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};
  
  // استخراج معرف الدوري من uid (صيغة: s:600~l:606~e:760419)
  const uidMatch = (ev.uid || '').match(/~l:(\d+)~/);
  const leagueId = uidMatch ? uidMatch[1] : null;
  const leagueInfo = leagueId ? leagueMap[leagueId] : null;
  
  let leagueName = '';
  let leagueSlug = '';
  
  if (leagueInfo) {
    leagueSlug = leagueInfo.slug;
    leagueName = `${leagueInfo.flag} ${leagueInfo.name}`;
  } else {
    leagueSlug = ev.league?.slug || ev.season?.slug || '';
    leagueName = ev.league?.displayName || ev.season?.displayName || '';
    if (leagueName.includes(' at ')) {
      leagueName = leagueName.split(' at ')[0];
    }
  }
  
  return {
    id: ev.id,
    league: leagueSlug,
    leagueName: leagueName,
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
    
    // ─── بناء خريطة الدوريات من مصفوفة leagues في جذر الاستجابة ───
    const leagueMap = {};
    for (const league of data.leagues || []) {
      leagueMap[league.id] = {
        slug: league.slug,
        name: league.name,
        flag: getFlagForLeague(league.slug),
      };
    }
    
    // تمرير الخريطة لكل مباراة
    const matches = (data.events || []).map(ev => parseEvent(ev, leagueMap));
    
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
