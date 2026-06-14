// ═══════════════════════════════════════════════════════════════════════════════
// src/worker.js — النسخة النهائية الصحيحة
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL    = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── خريطة الأعلام حسب اسم الدوري ────────────────────────────────────────────
function getFlag(name = '') {
  const n = name.toLowerCase();
  if (n.includes('fifa world cup') || n.includes('كأس العالم')) return '🌍';
  if (n.includes('champions league'))     return '🏆';
  if (n.includes('europa league'))        return '🥈';
  if (n.includes('conference'))           return '🥉';
  if (n.includes('premier league'))       return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (n.includes('laliga') || n.includes('la liga')) return '🇪🇸';
  if (n.includes('bundesliga'))           return '🇩🇪';
  if (n.includes('serie a'))              return '🇮🇹';
  if (n.includes('ligue 1'))              return '🇫🇷';
  if (n.includes('primeira liga') || n.includes('portugal')) return '🇵🇹';
  if (n.includes('eredivisie'))           return '🇳🇱';
  if (n.includes('saudi') || n.includes('roshn')) return '🇸🇦';
  if (n.includes('egyptian') || n.includes('egypt')) return '🇪🇬';
  if (n.includes('morocc') || n.includes('botola')) return '🇲🇦';
  if (n.includes('brasileiro') || n.includes('brazil')) return '🇧🇷';
  if (n.includes('argentin'))             return '🇦🇷';
  if (n.includes('chile') || n.includes('chilean')) return '🇨🇱';
  if (n.includes('bolivian'))             return '🇧🇴';
  if (n.includes('libertadores'))         return '🏆';
  if (n.includes('usl') || n.includes('mls')) return '🇺🇸';
  if (n.includes('northern super'))       return '🇨🇦';
  return '⚽';
}

// ─── تحليل المباراة ────────────────────────────────────────────────────────────
function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};

  // استخراج معرّف الدوري الرقمي من uid (s:600~l:606~e:760421)
  const leagueId = (ev.uid || '').match(/~l:(\d+)~/)?.[1] || '';

  // ✅ اسم الدوري من altGameNote (أصح مصدر)
  // مثال: "FIFA World Cup, Group D"  →  leagueNameOnly="FIFA World Cup", leagueStage="Group D"
  const altNote = comp.altGameNote || '';
  let leagueNameOnly = '';
  let leagueStage = '';

  if (altNote) {
    const parts = altNote.split(',').map(s => s.trim());
    leagueNameOnly = parts[0] || '';
    leagueStage    = parts.slice(1).join(', ') || '';
  }

  const leagueFlag = getFlag(leagueNameOnly);
  const leagueName = leagueNameOnly
    ? `${leagueFlag} ${leagueNameOnly}${leagueStage ? ' - ' + leagueStage : ''}`
    : '';

  // السنة من season
  const leagueYear = ev.season?.year ? String(ev.season.year) : '';

  return {
    id:             ev.id,
    leagueId,                   // "606" ← مفتاح التجميع في app.js
    league:         leagueId,   // للتوافق مع الروابط القديمة
    leagueName,                 // "🌍 FIFA World Cup - Group D"
    leagueNameOnly,             // "FIFA World Cup"
    leagueFlag,                 // "🌍"
    leagueStage,                // "Group D"
    leagueYear,                 // "2026"
    date:           ev.date,
    homeTeam:       home.team?.displayName || '',
    homeLogo:       home.team?.logos?.[0]?.href || '',
    homeScore:      home.score ?? '',
    awayTeam:       away.team?.displayName || '',
    awayLogo:       away.team?.logos?.[0]?.href || '',
    awayScore:      away.score ?? '',
    status:         status.state || 'pre',
    statusText:     status.shortDetail || '',
    minute:         ev.status?.displayClock || '',
    venue:          comp.venue?.fullName || '',
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ─── /api/matches ──────────────────────────────────────────────────────────────
async function handleMatches(url) {
  const date = url.searchParams.get('date') || todayStr();

  try {
    const res  = await fetch(`${ESPN_ALL}?dates=${date}&limit=500`, {
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

// ─── /api/summary ──────────────────────────────────────────────────────────────
async function handleSummary(url) {
  const matchId = url.searchParams.get('matchId');
  const league  = url.searchParams.get('league');
  if (!matchId) {
    return new Response(JSON.stringify({ error: 'matchId required' }), { status: 400, headers: CORS });
  }

  try {
    const res  = await fetch(`${ESPN_LEAGUE}/${league}/summary?event=${matchId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();

    const hdr  = data.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const st   = comp.status?.type || {};

    const goals = (data.plays || [])
      .filter(p => p.type?.text === 'Goal' || p.scoringPlay)
      .map(g => ({
        minute: g.clock?.displayValue || '',
        player: g.participants?.[0]?.athlete?.displayName || '',
        team:   g.team?.displayName || '',
      }));

    const cards = (data.plays || [])
      .filter(p => p.type?.text?.toLowerCase().includes('card'))
      .map(c => ({
        minute: c.clock?.displayValue || '',
        player: c.participants?.[0]?.athlete?.displayName || '',
        team:   c.team?.displayName || '',
        type:   c.type?.text || '',
      }));

    const mapLineup = (roster) => (roster || []).map(p => ({
      name:     p.athlete?.displayName || '',
      jersey:   p.jersey || '',
      position: p.position?.abbreviation || '',
      starter:  p.starter ?? false,
    }));

    const homeRoster = data.rosters?.find(r => r.homeAway === 'home');
    const awayRoster = data.rosters?.find(r => r.homeAway === 'away');

    const homeStats = data.boxscore?.teams?.[0]?.statistics || [];
    const awayStats = data.boxscore?.teams?.[1]?.statistics || [];

    return new Response(JSON.stringify({
      success:     true,
      id:          matchId,
      league,
      leagueName:  hdr.league?.name || '',
      date:        comp.date,
      homeTeam:    home.team?.displayName || '',
      homeLogo:    home.team?.logos?.[0]?.href || '',
      homeScore:   home.score || '0',
      awayTeam:    away.team?.displayName || '',
      awayLogo:    away.team?.logos?.[0]?.href || '',
      awayScore:   away.score || '0',
      status:      st.state || 'post',
      statusText:  st.shortDetail || '',
      minute:      comp.status?.displayClock || '',
      venue:       comp.venue?.fullName || '',
      goals,
      cards,
      homeLineup:  mapLineup(homeRoster?.roster),
      awayLineup:  mapLineup(awayRoster?.roster),
      homeStats:   homeStats.map(s => ({ name: s.label, value: s.displayValue })),
      awayStats:   awayStats.map(s => ({ name: s.label, value: s.displayValue })),
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: CORS }
    );
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url  = new URL(request.url);
    const path = url.pathname;

    if (path === '/ping')          return new Response('pong', { headers: CORS });
    if (path === '/api/matches')   return await handleMatches(url);
    if (path === '/api/summary')   return await handleSummary(url);

    return new Response('Not Found', { status: 404 });
  }
};
