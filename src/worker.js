// ═══════════════════════════════════════════════════════════════════════════════
// src/worker.js — النسخة النهائية (تعمل مع plays + keyEvents)
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
  if (n.includes('eredivisie')) return '🇳🇱';
  if (n.includes('portuguese') || n.includes('primeira')) return '🇵🇹';
  if (n.includes('belgian') || n.includes('pro league')) return '🇧🇪';
  if (n.includes('turkish') || n.includes('super lig')) return '🇹🇷';
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

// ─── استخراج الأحداث من plays و keyEvents ──────────────────────────────────────
function extractEvents(data) {
  const goals = [];
  const cards = [];
  const subs = [];
  const seen = new Set(); // لتجنب التكرار
  
  // 1. من plays (المصدر الأكثر تفصيلاً)
  const plays = data.plays || [];
  for (const play of plays) {
    const type = play.type?.text || '';
    const min = play.clock?.displayValue || '';
    const addMin = play.addedClock?.displayValue ? `+${play.addedClock.displayValue}` : '';
    const fullMin = min ? `${min}${addMin}` : '';
    const team = play.team?.displayName || '';
    const player = play.participants?.[0]?.athlete?.displayName || '';
    const player2 = play.participants?.[1]?.athlete?.displayName || '';
    const key = `${type}_${min}_${player}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    if (type === 'Goal' || type === 'Own Goal') {
      goals.push({
        minute: fullMin,
        player: player,
        assist: play.participants?.[1]?.athlete?.displayName || '',
        team: team,
        type: type === 'Own Goal' ? 'ownGoal' : 'goal',
      });
    }
    
    if (type.includes('Yellow Card') || type.includes('YellowCard') || type === 'Yellow') {
      cards.push({
        minute: fullMin,
        player: player,
        team: team,
        type: 'yellowCard',
      });
    }
    
    if (type.includes('Red Card') || type.includes('RedCard') || type === 'Red') {
      cards.push({
        minute: fullMin,
        player: player,
        team: team,
        type: 'redCard',
      });
    }
    
    if (type === 'Substitution' || type.includes('Substitution')) {
      subs.push({
        minute: fullMin,
        playerIn: player,
        playerOut: player2,
        team: team,
      });
    }
  }
  
  // 2. من keyEvents (كمصدر إضافي)
  const keyEvents = data.keyEvents || [];
  for (const ke of keyEvents) {
    const evType = ke.type?.type || '';
    const min = ke.clock?.displayValue || '';
    const addMin = ke.addedClock?.displayValue ? `+${ke.addedClock.displayValue}` : '';
    const fullMin = min ? `${min}${addMin}` : '';
    const team = ke.team?.displayName || '';
    const player = ke.participants?.[0]?.athlete?.displayName || '';
    const player2 = ke.participants?.[1]?.athlete?.displayName || '';
    const key = `${evType}_${min}_${player}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    if (evType === 'goal' || evType === 'own-goal') {
      // تجنب التكرار مع plays
      if (!goals.some(g => g.minute === fullMin && g.player === player)) {
        goals.push({
          minute: fullMin,
          player: player,
          assist: ke.participants?.[1]?.athlete?.displayName || '',
          team: team,
          type: evType === 'own-goal' ? 'ownGoal' : 'goal',
        });
      }
    }
    
    if (evType === 'yellow-card' || evType === 'yellowCard') {
      if (!cards.some(c => c.minute === fullMin && c.player === player)) {
        cards.push({
          minute: fullMin,
          player: player,
          team: team,
          type: 'yellowCard',
        });
      }
    }
    
    if (evType === 'red-card' || evType === 'redCard') {
      if (!cards.some(c => c.minute === fullMin && c.player === player)) {
        cards.push({
          minute: fullMin,
          player: player,
          team: team,
          type: 'redCard',
        });
      }
    }
    
    if (evType === 'substitution' || evType === 'substitution-out' || evType === 'substitution-in') {
      let playerIn = player;
      let playerOut = player2;
      // إذا كان النوع substitution-in، الاعب الأول هو الداخل
      if (evType === 'substitution-in') {
        playerIn = player;
        playerOut = player2;
      } else if (evType === 'substitution-out') {
        playerIn = player2;
        playerOut = player;
      }
      // تجنب التكرار مع plays
      if (!subs.some(s => s.minute === fullMin && s.playerIn === playerIn && s.playerOut === playerOut)) {
        subs.push({
          minute: fullMin,
          playerIn: playerIn,
          playerOut: playerOut,
          team: team,
        });
      }
    }
  }
  
  // ترتيب الأهداف حسب الدقيقة
  goals.sort((a, b) => {
    const aMin = parseInt(a.minute) || 0;
    const bMin = parseInt(b.minute) || 0;
    return aMin - bMin;
  });
  
  cards.sort((a, b) => {
    const aMin = parseInt(a.minute) || 0;
    const bMin = parseInt(b.minute) || 0;
    return aMin - bMin;
  });
  
  subs.sort((a, b) => {
    const aMin = parseInt(a.minute) || 0;
    const bMin = parseInt(b.minute) || 0;
    return aMin - bMin;
  });
  
  return { goals, cards, subs };
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
    ? [league, 'fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'bra.1', 'arg.1', 'ned.1', 'por.1', 'sco.1', 'bel.1', 'tur.1', 'gre.1', 'sau.1', 'egy.1', 'mar.1', 'usa.1', 'mex.1', 'chi.1', 'col.1']
    : ['fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'bra.1', 'arg.1', 'ned.1', 'por.1', 'sco.1', 'bel.1', 'tur.1', 'gre.1', 'sau.1', 'egy.1', 'mar.1', 'usa.1', 'mex.1', 'chi.1', 'col.1'];

  let data = null;
  let usedLeague = '';
  for (const lg of leaguesToTry) {
    try {
      const res = await fetch(`${ESPN_LEAGUE}/${lg}/summary?event=${matchId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) continue;
      const d = await res.json();
      if (d.header?.competitions?.[0]?.competitors?.length) {
        data = d;
        usedLeague = lg;
        break;
      }
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
    const leagueNameOnly = altParts[0] || hdr.league?.name || usedLeague || '';
    const leagueStage = altParts.slice(1).join(', ') || '';
    const leagueFlag = getFlag(leagueNameOnly);
    const leagueName = leagueNameOnly
      ? `${leagueFlag} ${leagueNameOnly}${leagueStage ? ' - ' + leagueStage : ''}`
      : hdr.league?.name || usedLeague || '';

    // ── التقدم/ركلات الترجيح ───────────────────────────────────────────────────
    const advancesNote = (comp.notes || []).find(n => n.text?.includes('advances'))?.text || '';
    const homeShootout = homeComp.shootoutScore ?? null;
    const awayShootout = awayComp.shootoutScore ?? null;

    // ── استخراج الأحداث ────────────────────────────────────────────────────────
    const { goals, cards, subs } = extractEvents(data);

    // ── التشكيلات ──────────────────────────────────────────────────────────────
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

    // ── الإحصائيات ─────────────────────────────────────────────────────────────
    const homeStats = data.boxscore?.teams?.[0]?.statistics || [];
    const awayStats = data.boxscore?.teams?.[1]?.statistics || [];

    // ── شعارات الفريق ─────────────────────────────────────────────────────────
    const homeLogo = homeComp.team?.logos?.[0]?.href || homeComp.team?.logo || '';
    const awayLogo = awayComp.team?.logos?.[0]?.href || awayComp.team?.logo || '';

    return new Response(JSON.stringify({
      success:      true,
      id:           matchId,
      league:       usedLeague,
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
      subs,
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
