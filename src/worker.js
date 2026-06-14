// ═══════════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers (النسخة الصحيحة النهائية)
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getFlagForLeague(name = '') {
  const n = name.toLowerCase();
  if (n.includes('england') || n.includes('premier league')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (n.includes('laliga') || n.includes('spain'))   return '🇪🇸';
  if (n.includes('bundesliga') || n.includes('german')) return '🇩🇪';
  if (n.includes('serie a') || n.includes('italy'))  return '🇮🇹';
  if (n.includes('ligue') || n.includes('france'))   return '🇫🇷';
  if (n.includes('fifa world cup'))                  return '🌍';
  if (n.includes('champions league'))                return '🏆';
  if (n.includes('europa league'))                   return '🏆';
  if (n.includes('brazil') || n.includes('brasileiro')) return '🇧🇷';
  if (n.includes('argentin'))                        return '🇦🇷';
  if (n.includes('chile') || n.includes('chilean'))  return '🇨🇱';
  if (n.includes('bolivia'))                         return '🇧🇴';
  if (n.includes('usl') || n.includes('mls'))        return '🇺🇸';
  return '⚽';
}

function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};

  // ✅ الحل: اسم الدوري موجود في altGameNote (مثال: "FIFA World Cup, Group D")
  const altNote = comp.altGameNote || '';
  const leagueName = altNote.split(',')[0].trim() || ev.name || 'مباريات';
  const flag = getFlagForLeague(leagueName);

  return {
    id: ev.id,
    league: ev.uid?.match(/~l:(\d+)~/)?.[1] || '',
    leagueName: `${flag} ${leagueName}`,
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

async function handleMatches(url) {
  const date = url.searchParams.get('date') || todayStr();

  try {
    const res = await fetch(`${ESPN_ALL}?dates=${date}&limit=500`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();

    const matches = (data.events || []).map(parseEvent);

    return new Response(JSON.stringify({ success: true, date, count: matches.length, matches }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
}

async function handleSummary(url) {
  const matchId = url.searchParams.get('matchId');
  const league = url.searchParams.get('league');
  if (!matchId) {
    return new Response(JSON.stringify({ error: 'matchId required' }), { status: 400, headers: CORS });
  }

  try {
    const res = await fetch(`${ESPN_LEAGUE}/${league}/summary?event=${matchId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const hdr = data.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const status = comp.status?.type || {};

    return new Response(JSON.stringify({
      success: true,
      id: matchId,
      league,
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
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === '/ping')         return new Response('pong', { headers: CORS });
    if (url.pathname === '/api/matches')  return await handleMatches(url);
    if (url.pathname === '/api/summary')  return await handleSummary(url);
    return new Response('Not Found', { status: 404 });
  }
};
