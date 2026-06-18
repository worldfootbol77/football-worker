// ═══════════════════════════════════════════════════════════════════════════════
// src/worker.js — النسخة النهائية (keyEvents + plays + details)
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
  if (n.includes('fifa world cup') || n.includes('world cup')) return '🌍';
  if (n.includes('champions league') || n.includes('libertadores')) return '🏆';
  if (n.includes('europa league')) return '🥈';
  if (n.includes('premier league') || n.includes('english')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (n.includes('laliga') || n.includes('la liga') || n.includes('spanish')) return '🇪🇸';
  if (n.includes('bundesliga') || n.includes('german')) return '🇩🇪';
  if (n.includes('serie a') || n.includes('italian')) return '🇮🇹';
  if (n.includes('ligue 1') || n.includes('french')) return '🇫🇷';
  if (n.includes('eredivisie') || n.includes('dutch')) return '🇳🇱';
  if (n.includes('primeira') || n.includes('portuguese')) return '🇵🇹';
  if (n.includes('scottish') || n.includes('scotland')) return '🏴󠁧󠁢󠁳󠁣󠁴󠁿';
  if (n.includes('saudi') || n.includes('roshn') || n.includes('ksa')) return '🇸🇦';
  if (n.includes('qatar')) return '🇶🇦';
  if (n.includes('uae') || n.includes('emirates')) return '🇦🇪';
  if (n.includes('egyptian') || n.includes('egypt')) return '🇪🇬';
  if (n.includes('morocc') || n.includes('botola')) return '🇲🇦';
  if (n.includes('tunisian') || n.includes('tunisia')) return '🇹🇳';
  if (n.includes('brasileiro') || n.includes('brazil')) return '🇧🇷';
  if (n.includes('argentine') || n.includes('argentina')) return '🇦🇷';
  if (n.includes('mls') || n.includes('usa') || n.includes('united states')) return '🇺🇸';
  if (n.includes('mexico') || n.includes('liga mx')) return '🇲🇽';
  if (n.includes('chile') || n.includes('chilean')) return '🇨🇱';
  if (n.includes('colombia') || n.includes('colombian')) return '🇨🇴';
  if (n.includes('peru') || n.includes('peruvian')) return '🇵🇪';
  if (n.includes('ecuador')) return '🇪🇨';
  if (n.includes('uruguay')) return '🇺🇾';
  if (n.includes('venezuela')) return '🇻🇪';
  if (n.includes('bolivia') || n.includes('bolivian')) return '🇧🇴';
  if (n.includes('paraguay')) return '🇵🇾';
  if (n.includes('japan') || n.includes('j.league')) return '🇯🇵';
  if (n.includes('korea') || n.includes('k-league')) return '🇰🇷';
  if (n.includes('china') || n.includes('csl')) return '🇨🇳';
  if (n.includes('australia') || n.includes('a-league')) return '🇦🇺';
  if (n.includes('india') || n.includes('indian')) return '🇮🇳';
  if (n.includes('turkey') || n.includes('super lig')) return '🇹🇷';
  if (n.includes('belgian') || n.includes('pro league')) return '🇧🇪';
  if (n.includes('greek') || n.includes('super league')) return '🇬🇷';
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

// ─── استخراج الأحداث من جميع المصادر ──────────────────────────────────────────
function extractEvents(data) {
  const goals = [];
  const cards = [];
  const subs = [];
  const seen = new Set();

  // 1. من keyEvents
  const events = data.keyEvents || [];
  for (const ev of events) {
    const evType = ev.type?.type || '';
    const min = ev.clock?.displayValue || '';
    const addMin = ev.addedClock?.displayValue ? `+${ev.addedClock.displayValue}` : '';
    const fullMin = min ? `${min}${addMin}` : '';
    const team = ev.team?.displayName || '';
    const participants = ev.participants || [];
    const player1 = participants[0]?.athlete?.displayName || '';
    const player2 = participants[1]?.athlete?.displayName || '';
    const jersey1 = participants[0]?.jersey || '';
    const jersey2 = participants[1]?.jersey || '';
    
    const key = `${evType}_${fullMin}_${player1}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (evType === 'goal' || evType === 'own-goal') {
      goals.push({ minute: fullMin, player: player1, assist: player2 || '', team: team, type: evType === 'own-goal' ? 'ownGoal' : 'goal' });
    }
    if (evType === 'yellow-card' || evType === 'yellowCard') {
      cards.push({ minute: fullMin, player: player1, team: team, type: 'yellowCard' });
    }
    if (evType === 'red-card' || evType === 'redCard') {
      cards.push({ minute: fullMin, player: player1, team: team, type: 'redCard' });
    }
    if (evType === 'yellow-red-card' || evType === 'yellowRedCard') {
      cards.push({ minute: fullMin, player: player1, team: team, type: 'yellowRedCard' });
    }
    if (evType === 'substitution' || evType === 'substitution-out' || evType === 'substitution-in') {
      let playerIn = player1, playerOut = player2, jerseyIn = jersey1, jerseyOut = jersey2;
      if (evType === 'substitution-in') { playerIn = player1; playerOut = player2; jerseyIn = jersey1; jerseyOut = jersey2; }
      else if (evType === 'substitution-out') { playerIn = player2; playerOut = player1; jerseyIn = jersey2; jerseyOut = jersey1; }
      subs.push({ minute: fullMin, playerIn, playerOut, jerseyIn, jerseyOut, team });
    }
  }

  // 2. من details (للأهداف)
  const details = data.header?.competitions?.[0]?.details || [];
  for (const det of details) {
    if (!det.scoringPlay) continue;
    const min = det.clock?.displayValue || '';
    const addMin = det.addedClock?.displayValue ? `+${det.addedClock.displayValue}` : '';
    const fullMin = min ? `${min}${addMin}` : '';
    const player = det.participants?.[0]?.athlete?.displayName || '';
    const key = `goal_${fullMin}_${player}`;
    if (seen.has(key)) continue;
    seen.add(key);
    goals.push({
      minute: fullMin, player: player,
      assist: det.participants?.[1]?.athlete?.displayName || '',
      team: det.team?.displayName || '',
      type: det.ownGoal ? 'ownGoal' : det.penaltyKick ? 'penalty' : 'goal',
    });
  }

  // 3. من plays (مصدر إضافي للدوريات الصغيرة)
  const plays = data.plays || [];
  for (const play of plays) {
    const type = play.type?.text || '';
    const min = play.clock?.displayValue || '';
    const addMin = play.addedClock?.displayValue ? `+${play.addedClock.displayValue}` : '';
    const fullMin = min ? `${min}${addMin}` : '';
    const team = play.team?.displayName || '';
    const player = play.participants?.[0]?.athlete?.displayName || '';
    const player2 = play.participants?.[1]?.athlete?.displayName || '';
    const jersey = play.participants?.[0]?.jersey || '';
    const jersey2 = play.participants?.[1]?.jersey || '';
    
    const key = `${type}_${fullMin}_${player}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (type === 'Goal' || type === 'Own Goal') {
      goals.push({ minute: fullMin, player, assist: player2 || '', team, type: type === 'Own Goal' ? 'ownGoal' : 'goal' });
    }
    if (type.includes('Yellow Card') || type.includes('YellowCard') || type === 'Yellow') {
      cards.push({ minute: fullMin, player, team, type: 'yellowCard' });
    }
    if (type.includes('Red Card') || type.includes('RedCard') || type === 'Red') {
      cards.push({ minute: fullMin, player, team, type: 'redCard' });
    }
    if (type === 'Substitution' || type.includes('Substitution')) {
      subs.push({ minute: fullMin, playerIn: player || '', playerOut: player2 || '', jerseyIn: jersey, jerseyOut: jersey2, team });
    }
  }

  const sortByMinute = (arr) => {
    arr.sort((a, b) => {
      const aMin = parseInt(a.minute) || 0;
      const bMin = parseInt(b.minute) || 0;
      return aMin - bMin;
    });
  };
  
  sortByMinute(goals);
  sortByMinute(cards);
  sortByMinute(subs);
  
  return { goals, cards, subs };
}

// ─── /api/summary ─────────────────────────────────────────────────────────────
async function handleSummary(url) {
  const matchId = url.searchParams.get('matchId');
  const league  = url.searchParams.get('league');
  if (!matchId) {
    return new Response(JSON.stringify({ error: 'matchId required' }), { status: 400, headers: CORS });
  }

  // قائمة واسعة من رموز الدوريات
  const leaguesToTry = league
    ? [
        league,
        'bra.1', 'bra.2', 'bra.3', 'bra.c', 'brasileiro-serie-a', 'brasileiro-serie-b', 'brasileiro-serie-c',
        'arg.1', 'arg.2', 'argentina-primera-division', 'argentina-primera-nacional',
        'eng.1', 'eng.2', 'eng.3', 'eng.4', 'premier-league', 'efl-championship', 'league-one', 'league-two',
        'esp.1', 'esp.2', 'laliga', 'laliga2',
        'ger.1', 'ger.2', 'bundesliga', '2-bundesliga',
        'ita.1', 'ita.2', 'serie-a', 'serie-b',
        'fra.1', 'fra.2', 'ligue-1', 'ligue-2',
        'ned.1', 'eredivisie',
        'por.1', 'primeira-liga',
        'sco.1', 'scottish-premiership',
        'tur.1', 'super-lig',
        'bel.1', 'pro-league',
        'gre.1', 'super-league',
        'rus.1', 'premier-league',
        'sau.1', 'ksa.1', 'saudi-pro-league',
        'qat.1', 'qatar-stars-league',
        'uae.1', 'uae-pro-league',
        'egy.1', 'egyptian-premier-league',
        'mar.1', 'botola',
        'tun.1', 'tunisian-ligue-1',
        'usa.1', 'mls',
        'mex.1', 'liga-mx',
        'chi.1', 'chilean-primera-division',
        'col.1', 'colombian-primera-a',
        'per.1', 'ecu.1', 'uru.1', 'ven.1', 'bol.1', 'par.1',
        'jpn.1', 'j1-league',
        'kor.1', 'k-league-1',
        'chn.1', 'csl',
        'aus.1', 'a-league',
        'ind.1', 'indian-super-league',
        'fifa.world', 'uefa.champions', 'uefa.europa', 'conmebol.libertadores', 'conmebol.sudamericana',
        league.replace(/[^0-9]/g, '')
      ]
    : [
        'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'bra.1', 'arg.1', 'ned.1', 'por.1',
        'sco.1', 'bel.1', 'tur.1', 'gre.1', 'rus.1', 'sau.1', 'qat.1', 'uae.1', 'egy.1',
        'mar.1', 'tun.1', 'usa.1', 'mex.1', 'chi.1', 'col.1', 'per.1', 'ecu.1', 'uru.1',
        'ven.1', 'bol.1', 'par.1', 'jpn.1', 'kor.1', 'chn.1', 'aus.1', 'ind.1',
        'fifa.world', 'uefa.champions', 'uefa.europa', 'conmebol.libertadores', 'conmebol.sudamericana'
      ];

  let data = null;
  let usedLeague = '';
  for (const lg of leaguesToTry) {
    if (!lg || lg.length < 2) continue;
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

    const gi    = data.gameInfo?.venue || {};
    const addr  = gi.address || {};
    const venueParts = [gi.fullName, addr.city, addr.country].filter(Boolean);
    const venue = venueParts.join('، ');

    const altNote = comp.altGameNote || '';
    const altParts = altNote.split(',').map(s => s.trim());
    const leagueNameOnly = altParts[0] || hdr.league?.name || usedLeague || '';
    const leagueStage = altParts.slice(1).join(', ') || '';
    const leagueFlag = getFlag(leagueNameOnly);
    const leagueName = leagueNameOnly
      ? `${leagueFlag} ${leagueNameOnly}${leagueStage ? ' - ' + leagueStage : ''}`
      : hdr.league?.name || usedLeague || '';

    const advancesNote = (comp.notes || []).find(n => n.text?.includes('advances'))?.text || '';
    const homeShootout = homeComp.shootoutScore ?? null;
    const awayShootout = awayComp.shootoutScore ?? null;

    const { goals, cards, subs } = extractEvents(data);

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

    const homeStats = data.boxscore?.teams?.[0]?.statistics || [];
    const awayStats = data.boxscore?.teams?.[1]?.statistics || [];

    const homeLogo = homeComp.team?.logos?.[0]?.href || homeComp.team?.logo || '';
    const awayLogo = awayComp.team?.logos?.[0]?.href || awayComp.team?.logo || '';

    return new Response(JSON.stringify({
      success: true,
      id: matchId,
      league: usedLeague,
      leagueName,
      leagueStage,
      leagueGroup: comp.groups?.name || '',
      advancesNote,
      venue,
      date: comp.date,
      homeTeam: homeComp.team?.displayName || '',
      homeLogo,
      homeScore: homeComp.score || '0',
      homeShootout,
      awayTeam: awayComp.team?.displayName || '',
      awayLogo,
      awayScore: awayComp.score || '0',
      awayShootout,
      homeWinner: homeComp.winner ?? false,
      awayWinner: awayComp.winner ?? false,
      status: st.state || 'post',
      statusText: st.shortDetail || '',
      minute: comp.status?.displayClock || '',
      homeFormation: homeRoster?.formation || '',
      awayFormation: awayRoster?.formation || '',
      goals,
      cards,
      subs,
      homeLineup: mapLineup(homeRoster),
      awayLineup: mapLineup(awayRoster),
      homeStats: homeStats.map(s => ({ name: s.label, value: s.displayValue })),
      awayStats: awayStats.map(s => ({ name: s.label, value: s.displayValue })),
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
