// ═══════════════════════════════════════════════════════════════════════════════
// src/worker.js — النسخة النهائية مع التشكيلة البصرية
// ═══════════════════════════════════════════════════════════════════════════════
const ESPN_ALL    = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getFlag(name = '') {
  const n = name.toLowerCase();
  if (n.includes('fifa world cup')) return '🌍';
  if (n.includes('champions league')) return '🏆';
  if (n.includes('europa league')) return '🥈';
  if (n.includes('conference')) return '🥉';
  if (n.includes('premier league')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
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
  
  // حاول مع عدة مسارات للدوري حتى ينجح
  const leaguesToTry = league
    ? [league, `fifa.world`, `eng.1`]
    : [`fifa.world`, `eng.1`, `esp.1`, `ger.1`, `ita.1`, `fra.1`, `bra.1`, `arg.1`];
  
  let data = null;
  for (const lg of leaguesToTry) {
    try {
      const res = await fetch(`${ESPN_LEAGUE}/${lg}/summary?event=${matchId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) continue;
      const d = await res.json();
      if (d.header?.competitions?.[0]?.competitors?.length) { data = d; break; }
    } catch (_) { continue; }
  }
  
  if (!data) {
    return new Response(JSON.stringify({ error: 'لم يتم العثور على المباراة' }), { status: 404, headers: CORS });
  }
  
  try {
    const hdr  = data.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const st   = comp.status?.type || {};
    
    // ─── التشكيلات ─────────────────────────────────────────────────────────────
    const homeRoster = data.rosters?.find(r => r.homeAway === 'home');
    const awayRoster = data.rosters?.find(r => r.homeAway === 'away');
    const mapLineup = (rosterObj) =>
      (rosterObj?.roster || []).map(p => ({
        name:      p.athlete?.displayName || '',
        shortName: p.athlete?.shortName   || '',
        jersey:    p.jersey || '',
        position:  p.position?.abbreviation || '',
        starter:   p.starter    ?? false,
        subbedIn:  p.subbedIn   ?? false,
        subbedOut: p.subbedOut  ?? false,
      }));
      
    // ─── الأهداف والبطاقات من details ─────────────────────────────────────────
    const details = data.header?.competitions?.[0]?.details || [];
    const goals = details
      .filter(d => d.type?.text?.toLowerCase().includes('goal'))
      .map(g => ({
        minute: g.clock?.displayValue || '',
        player: g.athletesInvolved?.[0]?.displayName || '',
        team:   g.team?.displayName || '',
      }));
      
    const cards = details
      .filter(d => {
        const t = (d.type?.text || '').toLowerCase();
        return t.includes('yellow') || t.includes('red card');
      })
      .map(c => ({
        minute: c.clock?.displayValue || '',
        player: c.athletesInvolved?.[0]?.displayName || '',
        team:   c.team?.displayName || '',
        type:   c.type?.text || '',
      }));
      
    // ─── الإحصائيات ───────────────────────────────────────────────────────────
    const homeStats = data.boxscore?.teams?.[0]?.statistics || [];
    const awayStats = data.boxscore?.teams?.[1]?.statistics || [];
    
    return new Response(JSON.stringify({
      success:        true,
      id:             matchId,
      league,
      leagueName:     hdr.league?.name || '',
      homeFormation:  homeRoster?.formation || '',
      awayFormation:  awayRoster?.formation || '',
      date:           comp.date,
      homeTeam:       home.team?.displayName || '',
      homeLogo:       home.team?.logos?.[0]?.href || '',
      homeScore:      home.score || '0',
      awayTeam:       away.team?.displayName || '',
      awayLogo:       away.team?.logos?.[0]?.href || '',
      awayScore:      away.score || '0',
      status:         st.state || 'post',
      statusText:     st.shortDetail || '',
      minute:         comp.status?.displayClock || '',
      venue:          comp.venue?.fullName || '',
      goals,
      cards,
      homeLineup:     mapLineup(homeRoster),
      awayLineup:     mapLineup(awayRoster),
      homeStats:      homeStats.map(s => ({ name: s.label, value: s.displayValue })),
      awayStats:      awayStats.map(s => ({ name: s.label, value: s.displayValue })),
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
    
    if (path === '/ping')         return new Response('pong', { headers: CORS });
    if (path === '/api/matches')  return await handleMatches(url);
    if (path === '/api/summary')  return await handleSummary(url);
    
    return new Response('Not Found', { status: 404 });
  }
};
