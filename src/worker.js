// ═══════════════════════════════════════════════════════════════════════════════
// src/worker.js
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
  if (n.includes('libertadores')) return '🏆';
  if (n.includes('usl') || n.includes('mls')) return '🇺🇸';
  return '⚽';
}

// ─── تحليل مباراة من scoreboard ──────────────────────────────────────────────
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

  // ESPN scoreboard uses team.logo (string), NOT team.logos (array)
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
    homeLogo: home.team?.logo || '',
    homeScore: home.score ?? '',
    awayTeam: away.team?.displayName || '',
    awayLogo: away.team?.logo || '',
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

// ─── /api/matches ─────────────────────────────────────────────────────────────
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

// ─── /api/summary ─────────────────────────────────────────────────────────────
async function handleSummary(url) {
  const matchId = url.searchParams.get('matchId');
  const league  = url.searchParams.get('league');
  if (!matchId) {
    return new Response(JSON.stringify({ error: 'matchId required' }), { status: 400, headers: CORS });
  }

  const leaguesToTry = league
    ? [league, 'fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'bra.1', 'arg.1', 'sau.1', 'egy.1', 'mor.1']
    : ['fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'bra.1', 'arg.1', 'sau.1', 'egy.1', 'mor.1'];

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
    return new Response(
      JSON.stringify({ error: 'لم يتم العثور على المباراة' }),
      { status: 404, headers: CORS }
    );
  }

  try {
    const hdr  = data.header || {};
    const comp = hdr.competitions?.[0] || {};
    const homeComp = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const awayComp = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const st   = comp.status?.type || {};

    // ── الملعب ─────────────────────────────────────────────────────────────────
    const gi    = data.gameInfo?.venue || {};
    const addr  = gi.address || {};
    const venueParts = [gi.fullName, addr.city, addr.country].filter(Boolean);
    const venue = venueParts.join('، ');

    // ── اسم الدوري ─────────────────────────────────────────────────────────────
    const altNote = comp.altGameNote || '';
    const altParts = altNote.split(',').map(s => s.trim());
    const leagueNameOnly = altParts[0] || hdr.league?.name || '';
    const leagueStage = altParts.slice(1).join(', ') || '';
    const leagueFlag = getFlag(leagueNameOnly);
    const leagueName = leagueNameOnly
      ? `${leagueFlag} ${leagueNameOnly}${leagueStage ? ' - ' + leagueStage : ''}`
      : hdr.league?.name || '';

    // ── التقدم/ركلات الترجيح ───────────────────────────────────────────────────
    const advancesNote = (comp.notes || []).find(n => n.text?.includes('advances'))?.text || '';
    const homeShootout = homeComp.shootoutScore ?? null;
    const awayShootout = awayComp.shootoutScore ?? null;

    // ── الأهداف من details ─────────────────────────────────────────────────────
    const details = comp.details || [];
    const goals   = [];

    details.forEach(det => {
      if (!det.scoringPlay) return;
      const min    = det.clock?.displayValue || '';
      const addMin = det.addedClock?.displayValue ? `+${det.addedClock.displayValue}` : '';
      goals.push({
        minute: min ? `${min}${addMin}` : '',
        player: det.participants?.[0]?.athlete?.displayName || '',
        assist: det.participants?.[1]?.athlete?.displayName || '',
        team:   det.team?.displayName || '',
        type:   det.ownGoal ? 'ownGoal' : det.penaltyKick ? 'penalty' : 'goal',
      });
    });

    // ── البطاقات من keyEvents ──────────────────────────────────────────────────
    // keyEvents هو المصدر الصحيح للبطاقات مع الدقيقة
    const cards = [];
    const keyEvents = data.keyEvents || [];

    keyEvents.forEach(ke => {
      const evType = ke.type?.type || '';
      if (evType === 'yellow-card') {
        cards.push({
          minute: ke.clock?.displayValue || '',
          player: ke.participants?.[0]?.athlete?.displayName || '',
          team:   ke.team?.displayName || '',
          type:   'yellowCard',
        });
      } else if (evType === 'red-card') {
        cards.push({
          minute: ke.clock?.displayValue || '',
          player: ke.participants?.[0]?.athlete?.displayName || '',
          team:   ke.team?.displayName || '',
          type:   'redCard',
        });
      } else if (evType === 'yellow-red-card') {
        cards.push({
          minute: ke.clock?.displayValue || '',
          player: ke.participants?.[0]?.athlete?.displayName || '',
          team:   ke.team?.displayName || '',
          type:   'yellowRedCard',
        });
      }
    });

    // ── التشكيلات والتبديلات من roster ────────────────────────────────────────
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

    // بناء التبديلات من roster: اللاعبون الذين خرجوا لديهم subbedOutFor + plays
    const buildSubs = (rosterObj) => {
      const result = [];
      ;(rosterObj?.roster || []).forEach(p => {
        if (!p.subbedOut) return;
        const minute = p.plays?.[0]?.clock?.displayValue || '';
        const playerOut = p.athlete?.displayName || '';
        const playerIn  = p.subbedOutFor?.athlete?.displayName || '';
        const jerseyOut = p.jersey || '';
        const jerseyIn  = p.subbedOutFor?.jersey || '';
        result.push({ minute, playerIn, jerseyIn, playerOut, jerseyOut, team: rosterObj.team?.displayName || '' });
      });
      // ترتيب حسب الدقيقة
      result.sort((a, b) => (parseInt(a.minute) || 0) - (parseInt(b.minute) || 0));
      return result;
    };

    const homeSubs = buildSubs(homeRoster);
    const awaySubs = buildSubs(awayRoster);

    // ── الإحصائيات ─────────────────────────────────────────────────────────────
    const homeStats = data.boxscore?.teams?.[0]?.statistics || [];
    const awayStats = data.boxscore?.teams?.[1]?.statistics || [];

    // ── شعارات الفريق (summary يعيد logos مصفوفة) ─────────────────────────────
    const homeLogo = homeComp.team?.logos?.[0]?.href || homeComp.team?.logo || '';
    const awayLogo = awayComp.team?.logos?.[0]?.href || awayComp.team?.logo || '';

    return new Response(JSON.stringify({
      success:      true,
      id:           matchId,
      league,
      leagueName,
      leagueStage,
      leagueGroup:  comp.groups?.name || '',
      advancesNote,
      venue,
      date:         comp.date,
      homeTeam:     homeComp.team?.displayName || '',
      homeLogo,
      homeScore:    homeComp.score || '0',
      homeShootout,
      awayTeam:     awayComp.team?.displayName || '',
      awayLogo,
      awayScore:    awayComp.score || '0',
      awayShootout,
      homeWinner:   homeComp.winner ?? false,
      awayWinner:   awayComp.winner ?? false,
      status:       st.state || 'post',
      statusText:   st.shortDetail || '',
      minute:       comp.status?.displayClock || '',
      homeFormation: homeRoster?.formation || '',
      awayFormation: awayRoster?.formation || '',
      goals,
      cards,
      homeSubs,
      awaySubs,
      homeLineup:   mapLineup(homeRoster),
      awayLineup:   mapLineup(awayRoster),
      homeStats:    homeStats.map(s => ({ name: s.label, value: s.displayValue })),
      awayStats:    awayStats.map(s => ({ name: s.label, value: s.displayValue })),
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: CORS }
    );
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url  = new URL(request.url);
    const path = url.pathname;
    if (path === '/ping')        return new Response('pong', { headers: CORS });
    if (path === '/api/matches') return await handleMatches(url);
    if (path === '/api/summary') return await handleSummary(url);
    return new Response('Not Found', { status: 404 });
  }
};
