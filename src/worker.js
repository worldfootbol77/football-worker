// ═══════════════════════════════════════════════════════════════════════════════
// worker.js — النسخة النهائية المُصلَحة
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL    = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── جدول تحويل معرفات ESPN إلى أكواد الدوريات ──────────────────────────────
const ID_TO_CODE = {
  // إنجلترا
  "23": "eng.1", "24": "eng.2", "25": "eng.3", "26": "eng.4", "27": "eng.5",
  "28": "eng.league_cup", "29": "eng.fa",
  // إسبانيا
  "15": "esp.1", "16": "esp.2", "17": "esp.copa_del_rey",
  // ألمانيا
  "10": "ger.1", "11": "ger.2", "12": "ger.dfb_pokal",
  // إيطاليا
  "13": "ita.1", "14": "ita.2", "18": "ita.coppa_italia",
  // فرنسا
  "9": "fra.1", "102": "fra.2", "111": "fra.coupe_de_france",
  // البرتغال
  "105": "por.1", "106": "por.2",
  // هولندا
  "19": "ned.1",
  // اسكتلندا
  "44": "sco.1",
  // بلجيكا
  "114": "bel.1",
  // تركيا
  "71": "tur.1",
  // سويسرا
  "122": "sui.1",
  // دوريات عربية
  "181": "sau.1",   // السعودية
  "234": "egy.1",   // مصر
  "231": "mar.1",   // المغرب
  "186": "uae.1",   // الإمارات
  "190": "qat.1",   // قطر
  "210": "irq.1",   // العراق
  "206": "jor.1",   // الأردن
  "233": "alg.1",   // الجزائر
  "232": "tun.1",   // تونس
  // أمريكا اللاتينية
  "135": "bra.1",   // البرازيل
  "80": "arg.1",    // الأرجنتين
  "131": "mex.1",   // المكسيك
  "21": "usa.1",    // الولايات المتحدة
  // آسيا
  "163": "jpn.1",   // اليابان
  "167": "kor.1",   // كوريا
  "171": "chn.1",   // الصين
  // بطولات قارية وعالمية
  "2": "uefa.champions",
  "3": "uefa.europa",
  "2310": "uefa.conference",
  "73": "uefa.euro",
  "606": "fifa.world",
  "85": "fifa.worldq",
  "48": "caf.nations",
  "84": "afc.asian.cup",
  "83": "conmebol.copa",
  "82": "conmebol.libertadores",
  "81": "conmebol.sudamericana",
  "2199": "afc.champions",
  "1975": "caf.champions"
};

// ─── قواعد الألوان للترتيب ──────────────────────────────────────────────────
const CONTINENTAL_RULES = {
  "eng.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    5: { color: "#6CABDD", desc: "الدوري الأوروبي" },
    6: { color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي" },
    "-3": { color: "#FF7F84", desc: "هبوط" },
    "-2": { color: "#FF7F84", desc: "هبوط" },
    "-1": { color: "#FF7F84", desc: "هبوط" }
  },
  "esp.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    5: { color: "#6CABDD", desc: "الدوري الأوروبي" },
    6: { color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي" },
    "-3": { color: "#FF7F84", desc: "هبوط" },
    "-2": { color: "#FF7F84", desc: "هبوط" },
    "-1": { color: "#FF7F84", desc: "هبوط" }
  },
  "ger.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    5: { color: "#6CABDD", desc: "الدوري الأوروبي" },
    6: { color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي" },
    "-3": { color: "#FF7F84", desc: "ملحق الهبوط" },
    "-2": { color: "#FF7F84", desc: "هبوط" },
    "-1": { color: "#FF7F84", desc: "هبوط" }
  },
  "ita.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    5: { color: "#6CABDD", desc: "الدوري الأوروبي" },
    6: { color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي" },
    "-3": { color: "#FF7F84", desc: "هبوط" },
    "-2": { color: "#FF7F84", desc: "هبوط" },
    "-1": { color: "#FF7F84", desc: "هبوط" }
  },
  "fra.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    2: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    3: { color: "#81D6AC", desc: "دوري أبطال أوروبا" },
    4: { color: "#6CABDD", desc: "دوري أبطال أوروبا (تصفيات)" },
    5: { color: "#6CABDD", desc: "الدوري الأوروبي" },
    6: { color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي" },
    "-3": { color: "#FF7F84", desc: "ملحق الهبوط" },
    "-2": { color: "#FF7F84", desc: "هبوط" },
    "-1": { color: "#FF7F84", desc: "هبوط" }
  },
  "sau.1": {
    1: { color: "#81D6AC", desc: "دوري أبطال آسيا للنخبة" },
    2: { color: "#81D6AC", desc: "دوري أبطال آسيا للنخبة" },
    3: { color: "#6CABDD", desc: "دوري أبطال آسيا 2" },
    "-3": { color: "#FF7F84", desc: "هبوط" },
    "-2": { color: "#FF7F84", desc: "هبوط" },
    "-1": { color: "#FF7F84", desc: "هبوط" }
  }
};

function applyFallbackColors(leagueCode, position, totalTeams) {
  const rules = CONTINENTAL_RULES[leagueCode];
  if (rules) {
    if (rules[position]) return rules[position];
    if (position > totalTeams - 4) {
      const offset = position - totalTeams - 1;
      if (rules[offset]) return rules[offset];
    }
  }
  return { color: "", desc: "" };
}

// ─── KV Cache helpers ──────────────────────────────────────────────────────────
async function kvGet(env, key) {
  try { return await env?.FOOTBALL_KV?.get(key, 'json'); } catch(_) { return null; }
}
async function kvPut(env, key, value, ttl) {
  try { await env?.FOOTBALL_KV?.put(key, JSON.stringify(value), { expirationTtl: ttl }); } catch(_) {}
}

// TTL
const TTL_LIVE = 60;
const TTL_MATCHES = 300;
const TTL_SUMMARY = 90;
const TTL_FINISHED = 3600;
const TTL_STANDINGS = 21600;
const TTL_SCORERS = 21600;

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

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
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

  const statusState = status.state || 'pre';
  const statusText = status.shortDetail || '';
  const isHalfTime = statusState === 'in' && (
    statusText.toLowerCase().includes('half') || statusText.toLowerCase().includes('ht')
  );

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
    status: statusState,
    statusText,
    isHalfTime,
    minute: ev.status?.displayClock || '',
    venue: comp.venue?.fullName || '',
  };
}

// ─── /api/matches ─────────────────────────────────────────────────────────────
async function handleMatches(url, env) {
  const date = url.searchParams.get('date') || todayStr();
  const kvKey = `matches_${date}`;
  const isToday = date === todayStr();

  const cached = await kvGet(env, kvKey);
  if (cached) {
    return new Response(
      JSON.stringify({ ...cached, fromCache: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const res = await fetch(`${ESPN_ALL}?dates=${date}&limit=500`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const matches = (data.events || []).map(parseEvent);
    const hasLive = matches.some(m => m.status === 'in');

    const result = { success: true, date, count: matches.length, matches };
    const ttl = hasLive ? TTL_LIVE : isToday ? TTL_MATCHES : TTL_FINISHED;
    await kvPut(env, kvKey, result, ttl);

    return new Response(
      JSON.stringify(result),
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
async function handleSummary(url, env) {
  const matchId = url.searchParams.get('matchId');
  let league = url.searchParams.get('league');
  
  if (!matchId) {
    return new Response(JSON.stringify({ error: 'matchId required' }), { status: 400, headers: CORS });
  }

  // تحويل league إذا كان رقماً
  if (league && !isNaN(league) && ID_TO_CODE[league]) {
    league = ID_TO_CODE[league];
  }

  const kvKey = `summary_${matchId}`;
  const cached = await kvGet(env, kvKey);
  if (cached) {
    return new Response(
      JSON.stringify({ ...cached, fromCache: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const leaguesToTry = league
    ? [league, 'fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'sau.1', 'egy.1', 'mar.1', 'bra.1', 'arg.1']
    : ['fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'sau.1', 'egy.1', 'mar.1', 'bra.1', 'arg.1'];

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
    const hdr = data.header || {};
    const comp = hdr.competitions?.[0] || {};
    const homeComp = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const awayComp = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const st = comp.status?.type || {};

    const homeTeamName = homeComp.team?.displayName || '';
    const awayTeamName = awayComp.team?.displayName || '';

    const statusState = st.state || 'post';
    const statusText = st.shortDetail || '';
    const isHalfTime = statusState === 'in' &&
      (statusText.toLowerCase().includes('half') || statusText.toLowerCase().includes('ht'));

    const gi = data.gameInfo?.venue || {};
    const addr = gi.address || {};
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

    // استخراج الأهداف والبطاقات
    const goals = [];
    const cards = [];
    const keyEvents = data.keyEvents || [];
    for (const ev of keyEvents) {
      const evType = ev.type?.type || ev.type?.text || '';
      const min = ev.clock?.displayValue || '';
      const addMin = ev.addedClock?.displayValue ? `+${ev.addedClock.displayValue}` : '';
      const fullMin = min ? `${min}${addMin}` : '';
      const team = ev.team?.displayName || '';
      const participants = ev.participants || [];
      const player1 = participants[0]?.athlete?.displayName || '';

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
    }

    // التشكيلات
    const homeRoster = data.rosters?.find(r => r.homeAway === 'home');
    const awayRoster = data.rosters?.find(r => r.homeAway === 'away');

    const mapLineup = (rosterObj) =>
      (rosterObj?.roster || []).map(p => ({
        name: p.athlete?.displayName || '',
        shortName: p.athlete?.shortName || '',
        jersey: p.jersey || '',
        position: p.position?.abbreviation || '',
        starter: p.starter ?? false,
        subbedIn: p.subbedIn ?? false,
        subbedOut: p.subbedOut ?? false,
      }));

    const homeStats = data.boxscore?.teams?.[0]?.statistics || [];
    const awayStats = data.boxscore?.teams?.[1]?.statistics || [];

    const homeLogo = homeComp.team?.logos?.[0]?.href || homeComp.team?.logo || '';
    const awayLogo = awayComp.team?.logos?.[0]?.href || awayComp.team?.logo || '';

    const result = {
      success: true,
      id: matchId,
      league: usedLeague,
      leagueName,
      leagueStage,
      leagueGroup: comp.groups?.name || '',
      advancesNote: (comp.notes || []).find(n => n.text?.includes('advances'))?.text || '',
      venue,
      date: comp.date,
      homeTeam: homeTeamName,
      homeLogo,
      homeScore: homeComp.score || '0',
      homeShootout: homeComp.shootoutScore ?? null,
      awayTeam: awayTeamName,
      awayLogo,
      awayScore: awayComp.score || '0',
      awayShootout: awayComp.shootoutScore ?? null,
      homeWinner: homeComp.winner ?? false,
      awayWinner: awayComp.winner ?? false,
      status: statusState,
      statusText,
      isHalfTime,
      minute: comp.status?.displayClock || '',
      homeFormation: homeRoster?.formation || '',
      awayFormation: awayRoster?.formation || '',
      goals,
      cards,
      subs: [],
      homeSubs: [],
      awaySubs: [],
      homeLineup: mapLineup(homeRoster),
      awayLineup: mapLineup(awayRoster),
      homeStats: homeStats.map(s => ({ name: s.label, value: s.displayValue })),
      awayStats: awayStats.map(s => ({ name: s.label, value: s.displayValue })),
    };

    const ttl = statusState === 'in' ? TTL_SUMMARY : TTL_FINISHED;
    await kvPut(env, kvKey, result, ttl);

    return new Response(
      JSON.stringify(result),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: CORS }
    );
  }
}

// ─── /api/standings ───────────────────────────────────────────────────────────
async function handleStandings(url, env) {
  let league = url.searchParams.get('league') || 'eng.1';
  
  // تحويل الرقم إلى كود
  if (!isNaN(league) && ID_TO_CODE[league]) {
    league = ID_TO_CODE[league];
  }

  const kvKey = `standings_${league}`;
  const cached = await kvGet(env, kvKey);
  if (cached) {
    return new Response(
      JSON.stringify({ ...cached, fromCache: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const data = await res.json();

    const children = data.children || [];
    const groups = [];

    for (const child of children) {
      const groupName = children.length > 1 ? (child.name || child.abbreviation || '') : '';
      const entries = child.standings?.entries || [];
      const teams = entries.map((e, idx) => {
        const team = e.team || {};
        const stats = {};
        for (const s of (e.stats || [])) stats[s.name] = s.displayValue ?? s.value ?? 0;
        const rank = parseInt(stats.rank) || (idx + 1);
        const fallback = applyFallbackColors(league, rank, entries.length);
        
        let colorClass = "";
        if (fallback.color === "#81D6AC") colorClass = "promo";
        else if (fallback.color === "#6CABDD") colorClass = "ucl";
        else if (fallback.color === "#B2BFD0") colorClass = "playoff";
        else if (fallback.color === "#FF7F84") colorClass = "rel";
        
        return {
          rank: rank,
          name: team.displayName || team.name || '',
          logo: team.logos?.[0]?.href || team.logo || '',
          played: stats.gamesPlayed ?? '',
          wins: stats.wins ?? '',
          draws: stats.ties ?? stats.draws ?? '',
          losses: stats.losses ?? '',
          gd: stats.pointDifferential ?? '',
          points: stats.points ?? '',
          note_color: fallback.color || '',
          note_description: fallback.desc || '',
          color_class: colorClass
        };
      });
      teams.sort((a, b) => (parseInt(a.rank)||99) - (parseInt(b.rank)||99));
      groups.push({ name: groupName, teams });
    }

    const result = { success: true, league, groups };
    await kvPut(env, kvKey, result, TTL_STANDINGS);

    return new Response(
      JSON.stringify(result),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch(e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
}

// ─── /api/scorers ─────────────────────────────────────────────────────────────
async function handleScorers(url, env) {
  let league = url.searchParams.get('league') || 'eng.1';
  
  if (!isNaN(league) && ID_TO_CODE[league]) {
    league = ID_TO_CODE[league];
  }

  const kvKey = `scorers_${league}`;
  const cached = await kvGet(env, kvKey);
  if (cached) {
    return new Response(
      JSON.stringify({ ...cached, fromCache: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/leaders`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const data = await res.json();

    const categories = data.categories || [];
    const goalsCat = categories.find(c =>
      (c.name || '').toLowerCase().includes('goal') ||
      (c.displayName || '').toLowerCase().includes('goal')
    ) || categories[0];

    const leaders = goalsCat?.leaders || [];
    const scorers = leaders.map((l, i) => ({
      rank: i + 1,
      name: l.athlete?.displayName || l.displayName || '',photo: l.athlete?.headshot?.href || '',
      team: l.team?.displayName || l.team?.name || '',
      teamLogo: l.team?.logos?.[0]?.href || l.team?.logo || '',
      goals: parseInt(l.value) || 0,
    }));

    const result = { success: true, league, scorers };
    await kvPut(env, kvKey, result, TTL_SCORERS);

    return new Response(
      JSON.stringify(result),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
    } catch(e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/ping') return new Response('pong', { headers: CORS });
    if (path === '/api/matches') return await handleMatches(url, env);
    if (path === '/api/summary') return await handleSummary(url, env);
    if (path === '/api/standings') return await handleStandings(url, env);
    if (path === '/api/scorers') return await handleScorers(url, env);
    
    return new Response('Not Found', { status: 404 });
  }
};
