// ═══════════════════════════════════════════════════════════════════════════════
// src/worker.js — النسخة الكاملة مع الأهداف والبطاقات والتبديلات والملعب
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL    = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── علم الدوري ──────────────────────────────────────────────────────────────
function getFlag(name = '') {
  const n = name.toLowerCase();
  if (n.includes('fifa world cup')) return '🌍';
  if (n.includes('champions league')) return '🏆';
  if (n.includes('europa league')) return '🥈';
  if (n.includes('conference')) return '🥉';
  if (n.includes('premier league')) return '🏴';
  if (n.includes('laliga') || n.includes('la liga')) return '🇪🇸';
  if (n.includes('bundesliga')) return '🇩🇪';
  if (n.includes('serie a')) return '🇮🇹';
  if (n.includes('ligue 1')) return '🇫🇷';
  if (n.includes('saudi') || n.includes('roshn')) return '🇸🇦';
  if (n.includes('egyptian')) return '🇪🇬';
  if (n.includes('morocc') || n.includes('botola')) return '🇲🇦';
  if (n.includes('brasileiro') || n.includes('brazil')) return '🇧🇷';
  if (n.includes('argentin')) return '🇦🇷';
  if (n.includes('chile') || n.includes('chilean')) return '🇨🇱';
  if (n.includes('bolivian')) return '🇧🇴';
  if (n.includes('libertadores')) return '🏆';
  if (n.includes('usl') || n.includes('mls')) return '🇺🇸';
  return '⚽';
}

function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};
  const leagueId = (ev.uid || '').match(/~l:(\d+)~/)?.[1] || '';
  const altNote = comp.altGameNote || '';
  const parts = altNote.split(',').map(s => s.trim());
  const leagueNameOnly = parts[0] || '';
  const leagueStage = parts.slice(1).join(', ') || '';
  const leagueFlag = getFlag(leagueNameOnly);

  const leagueName = leagueNameOnly
    ? `${leagueFlag} ${leagueNameOnly}${leagueStage ? ' - ' + leagueStage : ''}`
    : '';

  return {
    id: ev.id,
    leagueId,
    league: leagueId,
    leagueName,
    leagueNameOnly,
    leagueFlag,
    leagueStage,
    leagueYear: ev.season?.year ? String(ev.season.year) : '',
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

    return new Response(
      JSON.stringify({ success: true, date, count: matches.length, matches }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/ping') {
      return new Response('pong', { headers: CORS });
    }

    if (path === '/api/matches') {
      return await handleMatches(url);
    }

    if (path === '/api/summary') {
      return await handleSummary(url);
    }

    return new Response('Not Found', { status: 404 });
  }
};
