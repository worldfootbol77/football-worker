// ═══════════════════════════════════════════════════════════════════════════════
// src/worker.js — النسخة النهائية المُصلَحة
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
  if (n.includes('premier league')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (n.includes('laliga') || n.includes('la liga')) return '🇪🇸';
  if (n.includes('bundesliga')) return '🇩🇪';
  if (n.includes('serie a')) return '🇮🇹';
  if (n.includes('ligue 1')) return '🇫🇷';
  if (n.includes('saudi')) return '🇸🇦';
  if (n.includes('egyptian')) return '🇪🇬';
  if (n.includes('morocc')) return '🇲🇦';
  if (n.includes('brasileiro')) return '🇧🇷';
  if (n.includes('argentin')) return '🇦🇷';
  if (n.includes('libertadores')) return '🏆';
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

// ─── استخراج الأحداث ──────────────────────────────────────────────────────────
// keyEvents  → أهداف + بطاقات (موثوق)
// plays      → تبديلات مع الوقت الدقيق (المصدر الصحيح للتبديلات)
// details    → أهداف احتياطية
function extractEvents(data, homeTeamName, awayTeamName) {
  const goals = [];
  const cards = [];
  const subs  = [];
  const seen  = new Set();

  // ── 1. keyEvents: أهداف وبطاقات فقط ──────────────────────────────────────
  const keyEvents = data.keyEvents || [];
  for (const ev of keyEvents) {
    const evType = ev.type?.type || ev.type?.text || '';
    const min    = ev.clock?.displayValue || '';
    const addMin = ev.addedClock?.displayValue ? `+${ev.addedClock.displayValue}` : '';
    const fullMin = min ? `${min}${addMin}` : '';
    const team   = ev.team?.displayName || '';
    const participants = ev.participants || [];
    const player1 = participants[0]?.athlete?.displayName || '';

    const key = `${evType}_${fullMin}_${player1}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const t = evType.toLowerCase().replace(/-/g, '');

    if (t === 'goal' || t === 'owngoal') {
      goals.push({
        minute: fullMin,
        player: player1,
        assist: participants[1]?.athlete?.displayName || '',
        team,
        type: t === 'owngoal' ? 'ownGoal' : 'goal',
      });
    }

    if (t === 'yellowcard') {
      cards.push({ minute: fullMin, player: player1, team, type: 'yellowCard' });
    }
    if (t === 'redcard') {
      cards.push({ minute: fullMin, player: player1, team, type: 'redCard' });
    }
    if (t === 'yellowredcard') {
      cards.push({ minute: fullMin, player: player1, team, type: 'yellowRedCard' });
    }
  }

  // ── بناء خريطة اسم اللاعب → رقم القميص من التشكيلة ─────────────────────
  // هذا هو المصدر الأكثر موثوقية لأرقام القمصان
  const jerseyMap = {};
  for (const rosterObj of (data.rosters || [])) {
    for (const p of (rosterObj.roster || [])) {
      const name = p.athlete?.displayName || '';
      const jersey = p.jersey || p.athlete?.jersey || '';
      if (name && jersey) jerseyMap[name] = jersey;
    }
  }

  // دالة مساعدة لجلب رقم القميص
  const getJersey = (name, fallback) =>
    jerseyMap[name] || fallback || '';

  // ── 2. plays: التبديلات مع الوقت الدقيق ──────────────────────────────────
  // هذا هو المصدر الصحيح في ESPN للتبديلات — keyEvents لا يحتوي عليها دائماً
  const plays = data.plays || [];
  for (const play of plays) {
    const typeText = (play.type?.text || play.type?.id || '').toLowerCase();
    if (!typeText.includes('substitut') && typeText !== '78') continue;

    const min    = play.clock?.displayValue || '';
    const addMin = play.addedClock?.displayValue ? `+${play.addedClock.displayValue}` : '';
    const fullMin = min ? `${min}${addMin}` : '';
    const team   = play.team?.displayName || '';
    const participants = play.participants || [];

    // ESPN يضع اللاعب الخارج أولاً ثم الداخل
    const pOut = participants.find(p => p.type === 'playerSubstituted') || participants[0] || {};
    const pIn  = participants.find(p => p.type === 'playerSubstituting') || participants[1] || {};

    const playerOut = pOut.athlete?.displayName || pOut.displayName || '';
    const playerIn  = pIn.athlete?.displayName  || pIn.displayName  || '';

    // أرقام القمصان: نجرب plays أولاً، ثم نرجع للتشكيلة كمصدر احتياطي
    const jerseyOut = getJersey(playerOut, pOut.athlete?.jersey || pOut.jersey || '');
    const jerseyIn  = getJersey(playerIn,  pIn.athlete?.jersey  || pIn.jersey  || '');

    if (!playerOut && !playerIn) continue;

    const key = `sub_${fullMin}_${playerOut}_${playerIn}`;
    if (seen.has(key)) continue;
    seen.add(key);

    subs.push({
      minute: fullMin,
      playerIn:  playerIn  || '—',
      playerOut: playerOut || '—',
      jerseyIn,
      jerseyOut,
      team,
    });
  }

  // ── 3. إذا لم تجد تبديلات في plays، نحاول keyEvents كمصدر ثانوي ──────────
  if (subs.length === 0) {
    for (const ev of keyEvents) {
      const evType = (ev.type?.type || '').toLowerCase().replace(/-/g, '');
      if (!evType.includes('substitut')) continue;

      const min    = ev.clock?.displayValue || '';
      const addMin = ev.addedClock?.displayValue ? `+${ev.addedClock.displayValue}` : '';
      const fullMin = min ? `${min}${addMin}` : '';
      const team   = ev.team?.displayName || '';
      const participants = ev.participants || [];
      const player1 = participants[0]?.athlete?.displayName || '';
      const player2 = participants[1]?.athlete?.displayName || '';

      const key = `sub_${fullMin}_${player1}_${player2}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const isOut = evType === 'substitutionout';
      const pInName  = isOut ? player2 : player1;
      const pOutName = isOut ? player1 : player2;
      subs.push({
        minute:    fullMin,
        playerIn:  pInName  || '—',
        playerOut: pOutName || '—',
        jerseyIn:  getJersey(pInName,  isOut ? (participants[1]?.jersey || '') : (participants[0]?.jersey || '')),
        jerseyOut: getJersey(pOutName, isOut ? (participants[0]?.jersey || '') : (participants[1]?.jersey || '')),
        team,
      });
    }
  }

  // ── 4. details: أهداف احتياطية ────────────────────────────────────────────
  const details = data.header?.competitions?.[0]?.details || [];
  for (const det of details) {
    if (!det.scoringPlay) continue;
    const min    = det.clock?.displayValue || '';
    const addMin = det.addedClock?.displayValue ? `+${det.addedClock.displayValue}` : '';
    const fullMin = min ? `${min}${addMin}` : '';
    const player  = det.participants?.[0]?.athlete?.displayName || '';
    const key     = `goal_${fullMin}_${player}`;
    if (seen.has(key)) continue;
    seen.add(key);
    goals.push({
      minute: fullMin,
      player,
      assist: det.participants?.[1]?.athlete?.displayName || '',
      team:   det.team?.displayName || '',
      type:   det.ownGoal ? 'ownGoal' : det.penaltyKick ? 'penalty' : 'goal',
    });
  }

  // ── ترتيب حسب الدقيقة ─────────────────────────────────────────────────────
  const sortByMinute = arr => arr.sort((a, b) => (parseInt(a.minute) || 0) - (parseInt(b.minute) || 0));
  sortByMinute(goals);
  sortByMinute(cards);
  sortByMinute(subs);

  // ── تقسيم التبديلات حسب الفريق ───────────────────────────────────────────
  const homeSubs = subs.filter(s => s.team === homeTeamName);
  const awaySubs = subs.filter(s => s.team === awayTeamName);

  // إذا لم نعرف الفريق (team فارغ)، نوزّعها بالتساوي حسب الترتيب
  if (homeSubs.length === 0 && awaySubs.length === 0 && subs.length > 0) {
    subs.forEach((s, i) => {
      if (i % 2 === 0) homeSubs.push(s); else awaySubs.push(s);
    });
  }

  return { goals, cards, subs, homeSubs, awaySubs };
}

// ─── /api/summary ─────────────────────────────────────────────────────────────
async function handleSummary(url) {
  const matchId = url.searchParams.get('matchId');
  const league  = url.searchParams.get('league');
  if (!matchId) {
    return new Response(JSON.stringify({ error: 'matchId required' }), { status: 400, headers: CORS });
  }

  const leaguesToTry = league
    ? [league, 'fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'bra.1', 'arg.1', 'ned.1', 'por.1']
    : ['fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'bra.1', 'arg.1', 'ned.1', 'por.1'];

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
    const hdr      = data.header || {};
    const comp     = hdr.competitions?.[0] || {};
    const homeComp = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const awayComp = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const st       = comp.status?.type || {};

    const homeTeamName = homeComp.team?.displayName || '';
    const awayTeamName = awayComp.team?.displayName || '';

    // ── الحالة: تحقق من الاستراحة ──
    const statusState = st.state || 'post';
    const statusText  = st.shortDetail || '';
    const isHalfTime  = statusState === 'in' &&
      (statusText.toLowerCase().includes('half') || statusText.toLowerCase().includes('ht'));

    // ── الملعب ──
    const gi    = data.gameInfo?.venue || {};
    const addr  = gi.address || {};
    const venueParts = [gi.fullName, addr.city, addr.country].filter(Boolean);
    const venue = venueParts.join('، ');

    // ── اسم الدوري ──
    const altNote = comp.altGameNote || '';
    const altParts = altNote.split(',').map(s => s.trim());
    const leagueNameOnly = altParts[0] || hdr.league?.name || usedLeague || '';
    const leagueStage    = altParts.slice(1).join(', ') || '';
    const leagueFlag     = getFlag(leagueNameOnly);
    const leagueName     = leagueNameOnly
      ? `${leagueFlag} ${leagueNameOnly}${leagueStage ? ' - ' + leagueStage : ''}`
      : hdr.league?.name || usedLeague || '';

    // ── التقدم ──
    const advancesNote = (comp.notes || []).find(n => n.text?.includes('advances'))?.text || '';
    const homeShootout = homeComp.shootoutScore ?? null;
    const awayShootout = awayComp.shootoutScore ?? null;

    // ── استخراج الأحداث ──
    const { goals, cards, subs, homeSubs, awaySubs } = extractEvents(data, homeTeamName, awayTeamName);

    // ── التشكيلات ──
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

    // ── الإحصائيات ──
    const homeStats = data.boxscore?.teams?.[0]?.statistics || [];
    const awayStats = data.boxscore?.teams?.[1]?.statistics || [];

    // ── شعارات ──
    const homeLogo = homeComp.team?.logos?.[0]?.href || homeComp.team?.logo || '';
    const awayLogo = awayComp.team?.logos?.[0]?.href || awayComp.team?.logo || '';

    return new Response(JSON.stringify({
      success:       true,
      id:            matchId,
      league:        usedLeague,
      leagueName,
      leagueStage,
      leagueGroup:   comp.groups?.name || '',
      advancesNote,
      venue,
      date:          comp.date,
      homeTeam:      homeTeamName,
      homeLogo,
      homeScore:     homeComp.score || '0',
      homeShootout,
      awayTeam:      awayTeamName,
      awayLogo,
      awayScore:     awayComp.score || '0',
      awayShootout,
      homeWinner:    homeComp.winner ?? false,
      awayWinner:    awayComp.winner ?? false,
      status:        statusState,
      statusText,
      isHalfTime,
      minute:        comp.status?.displayClock || '',
      homeFormation: homeRoster?.formation || '',
      awayFormation: awayRoster?.formation || '',
      goals,
      cards,
      subs,
      homeSubs,
      awaySubs,
      homeLineup:    mapLineup(homeRoster),
      awayLineup:    mapLineup(awayRoster),
      homeStats:     homeStats.map(s => ({ name: s.label, value: s.displayValue })),
      awayStats:     awayStats.map(s => ({ name: s.label, value: s.displayValue })),
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
