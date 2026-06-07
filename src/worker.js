// ═══════════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers
// Architecture: ESPN all/scoreboard + Smart Cron + KV Cache
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL        = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE     = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_STANDINGS  = 'https://site.api.espn.com/apis/v2/sports/soccer';
const ESPN_STATISTICS = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer';

// ─── GitHub Upload (للأرشيف التاريخي — بديل KV للبيانات الثابتة) ──────────────

async function uploadToGitHub(path, data, env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return false;
  const branch  = env.GITHUB_BRANCH || 'main';
  const apiUrl  = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  const headers = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Content-Type':  'application/json',
    'User-Agent':    'football-worker/1.0',
    'Accept':        'application/vnd.github+json',
  };

  let sha;
  try {
    const chk = await fetch(`${apiUrl}?ref=${branch}`, { headers });
    if (chk.ok) sha = (await chk.json()).sha;
  } catch {}

  try {
    const res = await fetch(apiUrl, {
      method:  'PUT',
      headers,
      body:    JSON.stringify({
        message: `data: ${path}`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    return res.status === 200 || res.status === 201;
  } catch { return false; }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function formatDate(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}`;
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function generateWeekRanges(startDateStr, endDateStr) {
  const weeks = [];
  const start = new Date(`${startDateStr.slice(0,4)}-${startDateStr.slice(4,6)}-${startDateStr.slice(6,8)}`);
  const end   = new Date(`${endDateStr.slice(0,4)}-${endDateStr.slice(4,6)}-${endDateStr.slice(6,8)}`);
  let current = new Date(start);
  while (current < end) {
    const weekStart = formatDate(current);
    current.setDate(current.getDate() + 6);
    const weekEnd = formatDate(current < end ? current : end);
    weeks.push(`${weekStart}-${weekEnd}`);
    current.setDate(current.getDate() + 1);
  }
  return weeks;
}

// ─── KV Helpers ──────────────────────────────────────────────────────────────

async function kvGet(env, key) {
  if (!env.FOOTBALL_KV) return null;
  try { return await env.FOOTBALL_KV.get(key, { type: 'json' }); }
  catch { return null; }
}

async function kvGetStr(env, key) {
  if (!env.FOOTBALL_KV) return null;
  try { return await env.FOOTBALL_KV.get(key); }
  catch { return null; }
}

async function kvPut(env, key, value, ttl = 86400) {
  if (!env.FOOTBALL_KV) return;
  try { await env.FOOTBALL_KV.put(key, JSON.stringify(value), { expirationTtl: ttl }); }
  catch {}
}

async function kvPutStr(env, key, value, ttl = 86400) {
  if (!env.FOOTBALL_KV) return;
  try { await env.FOOTBALL_KV.put(key, value, { expirationTtl: ttl }); }
  catch {}
}

// ─── ESPN Fetch ───────────────────────────────────────────────────────────────

async function espnFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FootballBot/1.0)' },
  });
  if (!res.ok) throw new Error(`ESPN ${res.status}: ${url}`);
  return res.json();
}

// ─── Map season slug → ESPN league code (needed for standings/scorers URLs) ────

function slugToLeagueCode(slug) {
  if (!slug) return null;
  const s = slug.toLowerCase();

  // Europe — Top 5 + others
  if (s.includes('english-premier-league'))                               return 'eng.1';
  if (s.includes('championship') && s.includes('english'))               return 'eng.2';
  if (s.includes('laliga') || s.includes('la-liga'))                     return 'esp.1';
  if (s.includes('german-bundesliga') && !s.includes('2-bundesliga') && !s.includes('promotionrelegation')) return 'ger.1';
  if (s.includes('2-bundesliga'))                                         return 'ger.2';
  if (s.includes('italian-serie-a') && !s.includes('serie-b'))           return 'ita.1';
  if (s.includes('italian-serie-b'))                                      return 'ita.2';
  if ((s.includes('ligue-1') || s.includes('ligue1')) && !s.includes('ligue-2')) return 'fra.1';
  if (s.includes('ligue-2'))                                              return 'fra.2';
  if (s.includes('portuguesa-primeira') || s.includes('primeira-liga'))  return 'por.1';
  if (s.includes('eredivisie') && !s.includes('tweede') && !s.includes('keuken')) return 'ned.1';
  if (s.includes('scottish-premiership'))                                 return 'sco.1';
  if (s.includes('saudi-pro-league') || s.includes('saudi-professional-league')) return 'ksa.1';
  if (s.includes('belgian-first-division-a') || (s.includes('pro-league') && s.includes('belgian'))) return 'bel.1';
  if (s.includes('turkish-super-lig') || s.includes('süper-lig'))        return 'tur.1';
  if (s.includes('russian-premier-league'))                               return 'rus.1';
  if (s.includes('greek-super-league') || s.includes('super-league-1'))  return 'gre.1';

  // UEFA Club Competitions
  if (s.includes('champions-league') && !s.includes('qualifier') && !s.includes('women') && !s.includes('youth')) return 'uefa.champions';
  if (s.includes('europa-league') && !s.includes('conference'))          return 'uefa.europa';
  if (s.includes('conference-league'))                                    return 'uefa.europa.conference';

  // South America
  if (s.includes('brasileiro-serie-a'))                                   return 'bra.1';
  if (s.includes('brasileiro-serie-b'))                                   return 'bra.2';
  if (s.includes('argentine-liga') || s.includes('liga-profesional-argentina')) return 'arg.1';
  if (s.includes('colombian') || s.includes('liga-betplay') || s.includes('torneo-betplay')) return 'col.1';
  if (s.includes('primera-division-de-chile') || s.includes('campeonato-chileno')) return 'chi.1';
  if (s.includes('libertadores'))                                         return 'conmebol.libertadores';
  if (s.includes('sudamericana'))                                         return 'conmebol.sudamericana';

  // Middle East
  if (s.includes('arabian-gulf') || s.includes('uae-pro-league'))        return 'uae.pro';
  if (s.includes('qatar-stars') || s.includes('qatari-stars'))           return 'qat.1';

  // Africa / Asia
  if (s.includes('egyptian-premier') || s.includes('egyptian-league'))   return 'egy.1';
  if (s.includes('moroccan-botola') || s.includes('botola'))             return 'mar.1';
  if (s.includes('japanese-j1') || s.includes('j.league-division-1'))   return 'jpn.1';
  if (s.includes('korean-k-league-1') || s.includes('k-league-1'))      return 'kor.1';

  // Scandinavia
  if (s.includes('allsvenskan'))                                          return 'swe.1';
  if (s.includes('eliteserien'))                                          return 'nor.1';
  if (s.includes('superliga') && s.includes('danish'))                   return 'den.1';

  // North America
  if (s.includes('major-league-soccer') || s.includes('-mls'))           return 'usa.1';
  if (s.includes('liga-mx') || s.includes('liga-bbva'))                  return 'mex.1';

  // World Cup / Qualifiers
  if (s.includes('world-cup') && !s.includes('qualifier'))               return 'fifa.world';
  if (s.includes('world-cup-qualifying') && s.includes('concacaf'))      return 'concacaf.world';
  if (s.includes('world-cup-qualifying') && s.includes('conmebol'))      return 'conmebol.world';
  if (s.includes('world-cup-qualifying') && s.includes('afc'))           return 'afc.world';
  if (s.includes('world-cup-qualifying') && s.includes('caf'))           return 'caf.world';
  if (s.includes('world-cup-qualifying') && s.includes('uefa'))          return 'uefa.world';

  return null;
}

// ─── Parse ESPN Event ─────────────────────────────────────────────────────────

function parseEvent(ev) {
  const comp   = ev.competitions?.[0] || {};
  const home   = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away   = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};
  const seasonSlug = ev.season?.slug || ev.league?.slug || '';
  const leagueCode = slugToLeagueCode(seasonSlug) || seasonSlug;
  const league = leagueCode;
  const note   = comp.notes?.[0]?.headline || '';

  return {
    id:         ev.id,
    league:     league,
    leagueName: ev.season?.displayName || ev.league?.displayName || ev.name?.split(':')[0]?.trim() || '',
    region:     ev.season?.type?.displayName || '',
    date:       ev.date,
    homeTeam:   home.team?.displayName || '',
    homeLogo:   home.team?.logos?.[0]?.href || home.team?.logo || '',
    homeScore:  home.score ?? '',
    awayTeam:   away.team?.displayName || '',
    awayLogo:   away.team?.logos?.[0]?.href || away.team?.logo || '',
    awayScore:  away.score ?? '',
    status:     status.state || 'pre',
    statusText: status.shortDetail || status.description || '',
    minute:     ev.status?.displayClock || '',
    venue:      comp.venue?.fullName || '',
    round:      note,
    season:     ev.season?.year || '',
  };
}

// ─── Fetch Scoreboard (All Leagues — Single Request) ─────────────────────────

async function fetchScoreboard(dateOrRange, env, forceRefresh = false) {
  const kvKey = `scoreboard:${dateOrRange}`;

  if (!forceRefresh) {
    const cached = await kvGet(env, kvKey);
    if (cached) return cached;
  }

  try {
    let allMatches = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = `${ESPN_ALL}?dates=${dateOrRange}&limit=500${page > 1 ? `&page=${page}` : ''}`;
      const data = await espnFetch(url);
      const events = data.events || [];
      allMatches.push(...events.map(parseEvent));
      totalPages = data.pageCount || 1;
      page++;
    } while (page <= totalPages && page <= 3);

    allMatches.sort((a, b) => new Date(a.date) - new Date(b.date));

    const today   = todayStr();
    const isToday = dateOrRange === today || dateOrRange.startsWith(today);
    const hasLive = allMatches.some(m => m.status === 'in');
    const ttl     = hasLive ? 60 : isToday ? 300 : 2592000;

    await kvPut(env, kvKey, allMatches, ttl);
    return allMatches;
  } catch (e) {
    const cached = await kvGet(env, kvKey);
    return cached || [];
  }
}

// ─── Fetch Match Summary ──────────────────────────────────────────────────────

async function fetchAndStoreSummary(matchId, league, env) {
  if (!league || !matchId) return null;
  try {
    const raw  = await espnFetch(`${ESPN_LEAGUE}/${league}/summary?event=${matchId}`);
    const hdr  = raw.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const bx   = raw.boxscore || {};
    const st   = comp.status?.type || {};

    const goals = [];
    const cards = [];
    const subs  = [];

    (raw.plays || []).forEach(p => {
      const type = p.type?.text || '';
      if (type === 'Goal' || type === 'Own Goal') {
        goals.push({
          minute: p.clock?.displayValue,
          team:   p.team?.displayName,
          player: p.participants?.[0]?.athlete?.displayName,
          type:   type === 'Own Goal' ? 'OG' : 'G',
        });
      }
      if (type.includes('Card')) {
        cards.push({
          minute: p.clock?.displayValue,
          team:   p.team?.displayName,
          player: p.participants?.[0]?.athlete?.displayName,
          type:   type,
        });
      }
      if (type === 'Substitution') {
        subs.push({
          minute: p.clock?.displayValue,
          team:   p.team?.displayName,
          playerIn:  p.participants?.[0]?.athlete?.displayName,
          playerOut: p.participants?.[1]?.athlete?.displayName,
        });
      }
    });

    const statsRaw  = bx.teams || [];
    const homeStats = statsRaw.find(t => t.homeAway === 'home')?.statistics || [];
    const awayStats = statsRaw.find(t => t.homeAway === 'away')?.statistics || [];

    const rosters    = raw.rosters || [];
    const homeRoster = rosters.find(r => r.homeAway === 'home')?.entries || [];
    const awayRoster = rosters.find(r => r.homeAway === 'away')?.entries || [];

    const note = comp.notes?.[0]?.headline || '';
    let advancement = '';
    (raw.header?.competitions?.[0]?.situation?.team || []).forEach(t => {
      if (t.isWinner) advancement = t.displayName;
    });
    const penaltyWinner = raw.header?.competitions?.[0]?.situation?.lastPlay?.team?.displayName || '';

    const summary = {
      id:           matchId,
      league:       league,
      leagueName:   raw.header?.league?.name || hdr.league?.name || '',
      date:         comp.date,
      homeTeam:     home.team?.displayName || '',
      homeLogo:     home.team?.logos?.[0]?.href || home.team?.logo || '',
      homeScore:    home.score || '0',
      awayTeam:     away.team?.displayName || '',
      awayLogo:     away.team?.logos?.[0]?.href || away.team?.logo || '',
      awayScore:    away.score || '0',
      status:       st.state || 'post',
      statusText:   st.shortDetail || '',
      minute:       hdr.competitions?.[0]?.status?.displayClock || '',
      venue:        comp.venue?.fullName || '',
      round:        note,
      season:       raw.header?.season?.year || '',
      goals,
      cards,
      subs,
      homeStats:    homeStats.map(s => ({ name: s.name, value: s.displayValue })),
      awayStats:    awayStats.map(s => ({ name: s.name, value: s.displayValue })),
      homeLineup:   homeRoster.map(e => ({ name: e.athlete?.displayName, position: e.position?.abbreviation, starter: e.starter })),
      awayLineup:   awayRoster.map(e => ({ name: e.athlete?.displayName, position: e.position?.abbreviation, starter: e.starter })),
      advancement,
      penaltyWinner,
      lineupFetched: homeRoster.length > 0,
    };

    const isLive = st.state === 'in';
    await kvPut(env, `summary:${matchId}`, summary, isLive ? 30 : 2592000);
    return summary;
  } catch {
    return null;
  }
}

// ─── Group matches by exact start time ───────────────────────────────────────

function groupByStartTime(matches) {
  const groups = {};
  for (const m of matches) {
    const t = new Date(m.date).getTime();
    if (isNaN(t)) continue;
    if (!groups[t]) groups[t] = { anchorTime: t, matches: [] };
    groups[t].matches.push(m);
  }
  return Object.values(groups).sort((a, b) => a.anchorTime - b.anchorTime);
}

// ─── Smart Scoreboard Refresh (called by cron every minute) ──────────────────

async function smartRefresh(env) {
  const today = todayStr();
  const now   = Date.now();

  let state = await kvGet(env, `state:${today}`) || {
    date:                today,
    lastScoreboardFetch: 0,
    processedGroupTimes: [],
    matchWindows:        [],
    activeMatchIds:      [],
    lastSummaryFetch:    {},
    lineupAttempts:      {},
  };

  const interval = (2 + Math.random() * 1.5) * 60 * 1000;

  const inWindow = state.matchWindows.length === 0 ||
    state.matchWindows.some(w => now >= w.start - 5 * 60 * 1000 && now <= w.end + 30 * 60 * 1000);

  if (!inWindow) return;
  if (now - state.lastScoreboardFetch < interval) return;

  const matches = await fetchScoreboard(today, env, true);
  state.lastScoreboardFetch = now;

  if (matches.length > 0) {
    const times  = matches.map(m => new Date(m.date).getTime()).filter(t => !isNaN(t));
    const groups = [];
    let   grpStart = null, grpEnd = null;
    times.sort((a, b) => a - b).forEach(t => {
      if (!grpStart) { grpStart = t; grpEnd = t; }
      else if (t - grpEnd > 2 * 60 * 60 * 1000) {
        groups.push({ start: grpStart, end: grpEnd });
        grpStart = t; grpEnd = t;
      } else {
        grpEnd = t + 2 * 60 * 60 * 1000;
      }
    });
    if (grpStart) groups.push({ start: grpStart, end: grpEnd });
    state.matchWindows = groups;
  }

  const liveMatches = matches.filter(m => m.status === 'in');
  state.activeMatchIds = liveMatches.map(m => m.id);

  const summaryFetches = [];
  if (!state.lineupAttempts) state.lineupAttempts = {};

  for (const m of liveMatches) {
    const score          = `${m.homeScore}-${m.awayScore}`;
    const prevKey        = `prev:${m.id}`;
    const prevScore      = await kvGetStr(env, prevKey);
    const existing       = await kvGet(env, `summary:${m.id}`);
    const lineupDone     = existing?.lineupFetched === true;
    const lineupAttempts = state.lineupAttempts[m.id] || 0;

    let willFetch = false;

    if (prevScore !== score) {
      summaryFetches.push(fetchAndStoreSummary(m.id, m.league, env));
      await kvPutStr(env, prevKey, score, 86400);
      willFetch = true;
    } else {
      const lastFetch      = state.lastSummaryFetch[m.id] || 0;
      const summaryInterval = (15 + Math.random() * 5) * 60 * 1000;
      if (now - lastFetch > summaryInterval) {
        summaryFetches.push(fetchAndStoreSummary(m.id, m.league, env));
        state.lastSummaryFetch[m.id] = now;
        willFetch = true;
      }
    }

    if (!lineupDone && lineupAttempts < 2 && !willFetch) {
      summaryFetches.push(fetchAndStoreSummary(m.id, m.league, env));
      state.lineupAttempts[m.id] = lineupAttempts + 1;
    }
  }

  await Promise.allSettled(summaryFetches);

  const processedTimes   = new Set(state.processedGroupTimes || []);
  const timeGroups       = groupByStartTime(matches);
  const standingsFetches = [];

  for (const group of timeGroups) {
    if (processedTimes.has(group.anchorTime)) continue;

    const allFinished = group.matches.every(m => m.status === 'post');
    if (!allFinished) continue;

    const leagueSeasonMap = {};
    for (const m of group.matches) {
      if (m.league) leagueSeasonMap[m.league] = m.season || '';
    }

    for (const [league, season] of Object.entries(leagueSeasonMap)) {
      standingsFetches.push(
        refreshStandingsForLeague(league, season, env),
        refreshScorersForLeague(league, season, env)
      );
    }

    processedTimes.add(group.anchorTime);
  }

  state.processedGroupTimes = [...processedTimes];

  await Promise.allSettled(standingsFetches);
  await kvPut(env, `state:${today}`, state, 86400);
}

// ─── Known Leagues (قائمة ثابتة شاملة 110+ دوري) ─────────────────────────────

const KNOWN_LEAGUES = [
  'eng.1','eng.2','eng.3',
  'esp.1','esp.2',
  'ger.1','ger.2',
  'ita.1','ita.2',
  'fra.1','fra.2',
  'por.1','por.2',
  'ned.1','ned.2',
  'sco.1','sco.2',
  'bel.1',
  'gre.1',
  'rus.1',
  'ukr.1',
  'dnk.1',
  'nor.1',
  'swe.1',
  'sui.1',
  'aut.1',
  'pol.1',
  'srb.1',
  'cro.1',
  'rou.1',
  'hun.1',
  'svk.1',
  'bih.1',
  'slv.1',
  'fin.1',
  'isr.1',
  'cyp.1',
  'kaz.1',
  'bul.1',
  'eng.fa','eng.league_cup',
  'esp.copa_del_rey','esp.super_cup',
  'ger.dfb_pokal','ger.super_cup',
  'ita.coppa_italia','ita.super_cup',
  'fra.coupe_de_france','fra.super_cup',
  'por.taca.portugal',
  'ned.knvb_cup',
  'sco.fa_cup','sco.league_cup',
  'uefa.champions','uefa.europa','uefa.europa.conf',
  'uefa.euro','uefa.nations',
  'uefa.super_cup',
  'uefa.world','uefa.euro.qual',
  'ksa.1','ksa.2',
  'qat.1',
  'uae.pro','uae.league2',
  'kwt.1',
  'bhr.1',
  'omn.1',
  'jor.1',
  'irq.1',
  'lbn.1',
  'syr.1',
  'egy.1','egy.2',
  'mar.1','mar.2',
  'tun.1',
  'alg.1',
  'lby.1',
  'sud.1',
  'afc.champions','afc.champions2',
  'afc.asian_cup',
  'jpn.1','jpn.2',
  'kor.1','kor.2',
  'chn.1','chn.2',
  'ind.1',
  'aus.1',
  'irn.1',
  'tha.1',
  'vnm.1',
  'mys.1',
  'sgp.1',
  'idn.1',
  'uzb.1',
  'caf.champions','caf.confederations',
  'caf.nations','caf.nations.qual',
  'zaf.1','zaf.2',
  'nga.1',
  'gha.1',
  'sen.1',
  'tnz.1',
  'ken.1',
  'conmebol.libertadores','conmebol.sudamericana',
  'conmebol.america','conmebol.world',
  'bra.1','bra.2','bra.3',
  'arg.1','arg.2',
  'mex.1','mex.2',
  'col.1','col.2',
  'chl.1',
  'per.1',
  'ecu.1',
  'bol.1',
  'par.1',
  'uru.1',
  'ven.1',
  'concacaf.nations.league','concacaf.gold','concacaf.champions',
  'usa.1','usa.2','usa.open',
  'can.1',
  'fifa.world','fifa.cwc','fifa.world.qual',
  'friendly.national','friendly.club',
];

const NO_STANDINGS = new Set([
  'eng.fa','eng.league_cup','esp.copa_del_rey','esp.super_cup',
  'ger.dfb_pokal','ger.super_cup','ita.coppa_italia','ita.super_cup',
  'fra.coupe_de_france','fra.super_cup','por.taca.portugal',
  'ned.knvb_cup','sco.fa_cup','sco.league_cup',
  'uefa.super_cup','fifa.cwc','friendly.national','friendly.club',
  'usa.open','concacaf.gold','caf.nations','caf.nations.qual',
  'afc.asian_cup','conmebol.america','fifa.world','fifa.world.qual',
  'uefa.euro','uefa.nations','concacaf.nations.league',
  'concacaf.champions','uefa.euro.qual','conmebol.world',
]);

// ─── Standings & Scorers Refresh ──────────────────────────────────────────────

const QUAL = {
  UCL:        { color: '#81D6AC', label: 'دوري أبطال أوروبا' },
  UCL_Q:      { color: '#6CABDD', label: 'تصفيات أبطال أوروبا' },
  UEL:        { color: '#6CABDD', label: 'الدوري الأوروبي' },
  UECL:       { color: '#F7B56B', label: 'دوري المؤتمر الأوروبي' },
  AFC_UCL:    { color: '#81D6AC', label: 'دوري أبطال آسيا' },
  CAF_UCL:    { color: '#81D6AC', label: 'دوري أبطال أفريقيا' },
  LIBERTAD:   { color: '#81D6AC', label: 'كوبا ليبرتادوريس' },
  SUDAMERI:   { color: '#6CABDD', label: 'كوبا سوداميريكانا' },
  WC:         { color: '#81D6AC', label: 'كأس العالم' },
  WC_Q:       { color: '#B2BFD0', label: 'ملحق كأس العالم' },
  PLAYOFF:    { color: '#B2BFD0', label: 'ملحق البقاء' },
  NEXT_ROUND: { color: '#81D6AC', label: 'الدور التالي' },
  RELEGATED:  { color: '#FF7F84', label: 'هبوط' },
};

function mapEspnNote(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('champions league') && (t.includes('qualifier') || t.includes('qualifying'))) return 'UCL_Q';
  if (t.includes('champions league'))    return 'UCL';
  if (t.includes('conference league'))   return 'UECL';
  if (t.includes('europa league'))       return 'UEL';
  if (t.includes('afc champions'))       return 'AFC_UCL';
  if (t.includes('caf champions'))       return 'CAF_UCL';
  if (t.includes('libertadores'))        return 'LIBERTAD';
  if (t.includes('sudamericana'))        return 'SUDAMERI';
  if (t.includes('world cup') && (t.includes('playoff') || t.includes('intercontinental'))) return 'WC_Q';
  if (t.includes('world cup'))           return 'WC';
  if (t.includes('relegate') || t.includes('relegation')) return 'RELEGATED';
  if (t.includes('play-off') || t.includes('playoff'))    return 'PLAYOFF';
  if (t.includes('next round') || t.includes('knockout') || t.includes('advance')) return 'NEXT_ROUND';
  return null;
}

const LEAGUE_RULES = {
  'eng.1':  [[1,2,3,4],'UCL'],[5,'UEL'],[6,'UECL'],[18,19,20,'RELEGATED'],
  'esp.1':  [[1,2,3,4],'UCL'],[5,6,'UEL'],[7,'UECL'],[18,19,20,'RELEGATED'],
  'ger.1':  [[1,2,3,4],'UCL'],[5,6,'UEL'],[7,'UECL'],[16,'PLAYOFF'],[17,18,'RELEGATED'],
  'ita.1':  [[1,2,3,4],'UCL'],[5,6,'UEL'],[7,'UECL'],[18,19,20,'RELEGATED'],
  'fra.1':  [[1,2,3],'UCL'],[4,'UCL_Q'],[5,6,'UEL'],[7,'UECL'],[16,'PLAYOFF'],[17,18,'RELEGATED'],
  'por.1':  [[1,2,3,4],'UCL'],[5,6,'UEL'],[7,'UECL'],[16,'PLAYOFF'],[17,18,'RELEGATED'],
  'ned.1':  [[1],'UCL'],[2,3,'UCL_Q'],[4,5,'UEL'],[6,7,'UECL'],[16,'PLAYOFF'],[17,18,'RELEGATED'],
  'sco.1':  [[1,2],'UCL'],[3,4,'UEL'],[5,'UECL'],[11,12,'RELEGATED'],
  'bel.1':  [[1,2],'UCL'],[3,4,'UEL'],[5,6,'UECL'],[16,'RELEGATED'],
  'tur.1':  [[1,2],'UCL'],[3,'UCL_Q'],[4,'UEL'],[5,6,'UECL'],[17,18,19,'RELEGATED'],
  'gre.1':  [[1,2],'UCL'],[3,'UEL'],[4,5,'UECL'],[15,16,'RELEGATED'],
  'rus.1':  [[1,2],'UCL'],[3,4,'UEL'],[15,16,'RELEGATED'],
  'ksa.1':  [[1,2,3],'AFC_UCL'],[16,'PLAYOFF'],[17,18,'RELEGATED'],
  'qat.1':  [[1,2],'AFC_UCL'],[9,10,'RELEGATED'],
  'uae.pro':[[1,2],'AFC_UCL'],[13,14,'RELEGATED'],
  'egy.1':  [[1,2],'CAF_UCL'],[14,15,16,'RELEGATED'],
  'mar.1':  [[1,2],'CAF_UCL'],[14,15,16,'RELEGATED'],
  'bra.1':  [[1,2,3,4,5,6],'LIBERTAD'],[7,8,'SUDAMERI'],[17,18,19,20,'RELEGATED'],
  'arg.1':  [[1,2,3,4,5,6],'LIBERTAD'],[7,8,9,10,'SUDAMERI'],[26,27,28,'RELEGATED'],
  'col.1':  [[1,2,3,4,5,6,7,8],'NEXT_ROUND'],[1,'LIBERTAD'],[2,3,'SUDAMERI']],
  'mex.1':  [[1,2,3,4,5,6,7,8],'NEXT_ROUND'],[17,18,'RELEGATED']],
  'usa.1':  [[1,2,3,4,5,6,7],'NEXT_ROUND']],
  'conmebol.world': [[1,2,3,4,5,6],'WC'],[7,'WC_Q']],
  'concacaf.world': [[1,2,3],'WC'],[4,'WC_Q']],
  'afc.world': [[1,2,3,4,5,6,7,8],'WC'],[9,10,'WC_Q']],
  'caf.world': [[1],'WC']],
  'uefa.nations_a': [[1],'NEXT_ROUND'],[4,'RELEGATED']],
  'uefa.nations_b': [[1],'NEXT_ROUND'],[4,'RELEGATED']],
};

const LANGS = ['ar','en','fr','es','pt','de','it','tr','ru','id'];

const TR = {
  ar: {
    dir:'rtl', vs:'ضد', goals:'⚽ الأهداف', cards:'🟨 البطاقات', subs:'🔄 التبديلات',
    standingsTitle:'ترتيب', scorersTitle:'هدافو', season:'الموسم',
    rank:'#', team:'الفريق', player:'اللاعب', goalsCol:'الأهداف',
    mp:'لع', w:'ف', d:'ت', l:'خ', gd:'فا', pts:'نق',
    back:'← العودة للموقع', advanced:'تأهل', pens:'ركلات ترجيح',
    noData:'لا توجد بيانات',
    titleMatch: (h,a,sc,lg,rd) => `${h} ضد ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `نتيجة مباراة ${h} ضد ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. ملخص كامل مع أهداف وإحصائيات وتشكيلات.`,
    titleStand: (lg,sn) => `ترتيب ${lg} ${sn}`,
    descStand:  (lg,sn) => `جدول ترتيب ${lg} موسم ${sn} - نقاط، فوز، تعادل، خسارة، فارق الأهداف لجميع الفرق.`,
    titleScore: (lg,sn) => `هدافو ${lg} ${sn}`,
    descScore:  (lg,sn) => `قائمة أفضل الهدافين في ${lg} موسم ${sn} - عدد الأهداف والفريق لكل لاعب.`,
  },
  en: {
    dir:'ltr', vs:'vs', goals:'⚽ Goals', cards:'🟨 Cards', subs:'🔄 Substitutions',
    standingsTitle:'Standings', scorersTitle:'Top Scorers', season:'Season',
    rank:'#', team:'Team', player:'Player', goalsCol:'Goals',
    mp:'MP', w:'W', d:'D', l:'L', gd:'GD', pts:'Pts',
    back:'← Back to site', advanced:'Advanced', pens:'Penalty Shootout',
    noData:'No data available',
    titleMatch: (h,a,sc,lg,rd) => `${h} vs ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `${h} vs ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. Full match summary with goals, stats and lineups.`,
    titleStand: (lg,sn) => `${lg} Standings ${sn}`,
    descStand:  (lg,sn) => `${lg} ${sn} league table - points, wins, draws, losses, goal difference for all teams.`,
    titleScore: (lg,sn) => `${lg} Top Scorers ${sn}`,
    descScore:  (lg,sn) => `${lg} ${sn} top goal scorers list - goals and teams for all leading players.`,
  },
  fr: {
    dir:'ltr', vs:'contre', goals:'⚽ Buts', cards:'🟨 Cartons', subs:'🔄 Remplacements',
    standingsTitle:'Classement', scorersTitle:'Meilleurs Buteurs', season:'Saison',
    rank:'#', team:'Équipe', player:'Joueur', goalsCol:'Buts',
    mp:'MJ', w:'V', d:'N', l:'D', gd:'DB', pts:'Pts',
    back:'← Retour au site', advanced:'Qualifié', pens:'Tirs au but',
    noData:'Aucune donnée disponible',
    titleMatch: (h,a,sc,lg,rd) => `${h} contre ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `${h} contre ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. Résumé complet avec buts, stats et compositions.`,
    titleStand: (lg,sn) => `Classement ${lg} ${sn}`,
    descStand:  (lg,sn) => `Tableau du classement ${lg} saison ${sn} - points, victoires, nuls, défaites, différence de buts.`,
    titleScore: (lg,sn) => `Meilleurs Buteurs ${lg} ${sn}`,
    descScore:  (lg,sn) => `Liste des meilleurs buteurs ${lg} ${sn} - buts marqués et équipes.`,
  },
  es: {
    dir:'ltr', vs:'vs', goals:'⚽ Goles', cards:'🟨 Tarjetas', subs:'🔄 Sustituciones',
    standingsTitle:'Clasificación', scorersTitle:'Goleadores', season:'Temporada',
    rank:'#', team:'Equipo', player:'Jugador', goalsCol:'Goles',
    mp:'PJ', w:'G', d:'E', l:'P', gd:'DG', pts:'Pts',
    back:'← Volver al sitio', advanced:'Clasificado', pens:'Penaltis',
    noData:'No hay datos disponibles',
    titleMatch: (h,a,sc,lg,rd) => `${h} vs ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `${h} vs ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. Resumen completo con goles, estadísticas y alineaciones.`,
    titleStand: (lg,sn) => `Clasificación ${lg} ${sn}`,
    descStand:  (lg,sn) => `Tabla de clasificación ${lg} temporada ${sn} - puntos, victorias, empates, derrotas, diferencia de goles.`,
    titleScore: (lg,sn) => `Goleadores ${lg} ${sn}`,
    descScore:  (lg,sn) => `Lista de máximos goleadores ${lg} ${sn} - goles marcados y equipos.`,
  },
  pt: {
    dir:'ltr', vs:'vs', goals:'⚽ Golos', cards:'🟨 Cartões', subs:'🔄 Substituições',
    standingsTitle:'Classificação', scorersTitle:'Artilheiros', season:'Temporada',
    rank:'#', team:'Equipa', player:'Jogador', goalsCol:'Golos',
    mp:'JG', w:'V', d:'E', l:'D', gd:'DG', pts:'Pts',
    back:'← Voltar ao site', advanced:'Classificado', pens:'Grandes penalidades',
    noData:'Nenhum dado disponível',
    titleMatch: (h,a,sc,lg,rd) => `${h} vs ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `${h} vs ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. Resumo completo com golos, estatísticas e escalações.`,
    titleStand: (lg,sn) => `Classificação ${lg} ${sn}`,
    descStand:  (lg,sn) => `Tabela de classificação ${lg} temporada ${sn} - pontos, vitórias, empates, derrotas, diferença de golos.`,
    titleScore: (lg,sn) => `Artilheiros ${lg} ${sn}`,
    descScore:  (lg,sn) => `Lista dos maiores artilheiros ${lg} ${sn} - golos marcados e equipas.`,
  },
  de: {
    dir:'ltr', vs:'gegen', goals:'⚽ Tore', cards:'🟨 Karten', subs:'🔄 Wechsel',
    standingsTitle:'Tabelle', scorersTitle:'Torschützen', season:'Saison',
    rank:'#', team:'Verein', player:'Spieler', goalsCol:'Tore',
    mp:'Sp', w:'S', d:'U', l:'N', gd:'TD', pts:'Pkt',
    back:'← Zurück zur Website', advanced:'Qualifiziert', pens:'Elfmeterschießen',
    noData:'Keine Daten verfügbar',
    titleMatch: (h,a,sc,lg,rd) => `${h} gegen ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `${h} gegen ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. Vollständige Zusammenfassung mit Toren, Statistiken und Aufstellungen.`,
    titleStand: (lg,sn) => `${lg} Tabelle ${sn}`,
    descStand:  (lg,sn) => `${lg} Tabelle Saison ${sn} - Punkte, Siege, Unentschieden, Niederlagen, Tordifferenz aller Vereine.`,
    titleScore: (lg,sn) => `${lg} Torschützen ${sn}`,
    descScore:  (lg,sn) => `Liste der besten Torschützen ${lg} ${sn} - Tore und Vereine.`,
  },
  it: {
    dir:'ltr', vs:'contro', goals:'⚽ Gol', cards:'🟨 Cartellini', subs:'🔄 Sostituzioni',
    standingsTitle:'Classifica', scorersTitle:'Capocannonieri', season:'Stagione',
    rank:'#', team:'Squadra', player:'Giocatore', goalsCol:'Gol',
    mp:'PG', w:'V', d:'P', l:'S', gd:'DR', pts:'Pts',
    back:'← Torna al sito', advanced:'Qualificato', pens:'Rigori',
    noData:'Nessun dato disponibile',
    titleMatch: (h,a,sc,lg,rd) => `${h} contro ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `${h} contro ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. Riepilogo completo con gol, statistiche e formazioni.`,
    titleStand: (lg,sn) => `Classifica ${lg} ${sn}`,
    descStand:  (lg,sn) => `Classifica ${lg} stagione ${sn} - punti, vittorie, pareggi, sconfitte, differenza reti di tutte le squadre.`,
    titleScore: (lg,sn) => `Capocannonieri ${lg} ${sn}`,
    descScore:  (lg,sn) => `Lista dei migliori marcatori ${lg} ${sn} - gol segnati e squadre.`,
  },
  tr: {
    dir:'ltr', vs:'-', goals:'⚽ Goller', cards:'🟨 Kartlar', subs:'🔄 Değişiklikler',
    standingsTitle:'Puan Durumu', scorersTitle:'Gol Krallığı', season:'Sezon',
    rank:'#', team:'Takım', player:'Oyuncu', goalsCol:'Gol',
    mp:'OM', w:'G', d:'B', l:'M', gd:'AG', pts:'Puan',
    back:'← Siteye dön', advanced:'Turladı', pens:'Penaltılar',
    noData:'Veri bulunamadı',
    titleMatch: (h,a,sc,lg,rd) => `${h} - ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `${h} - ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. Goller, istatistikler ve kadrolarla tam maç özeti.`,
    titleStand: (lg,sn) => `${lg} Puan Durumu ${sn}`,
    descStand:  (lg,sn) => `${lg} ${sn} sezonu puan durumu - tüm takımların puan, galibiyet, beraberlik, mağlubiyet ve averajları.`,
    titleScore: (lg,sn) => `${lg} Gol Krallığı ${sn}`,
    descScore:  (lg,sn) => `${lg} ${sn} sezonu en çok gol atan oyuncular listesi.`,
  },
  ru: {
    dir:'ltr', vs:'против', goals:'⚽ Голы', cards:'🟨 Карточки', subs:'🔄 Замены',
    standingsTitle:'Таблица', scorersTitle:'Бомбардиры', season:'Сезон',
    rank:'#', team:'Клуб', player:'Игрок', goalsCol:'Голы',
    mp:'И', w:'В', d:'Н', l:'П', gd:'РМ', pts:'Очки',
    back:'← Вернуться на сайт', advanced:'Прошёл', pens:'Серия пенальти',
    noData:'Данные недоступны',
    titleMatch: (h,a,sc,lg,rd) => `${h} против ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `${h} против ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. Полный обзор с голами, статистикой и составами.`,
    titleStand: (lg,sn) => `Таблица ${lg} ${sn}`,
    descStand:  (lg,sn) => `Турнирная таблица ${lg} сезон ${sn} - очки, победы, ничьи, поражения, разница мячей всех команд.`,
    titleScore: (lg,sn) => `Бомбардиры ${lg} ${sn}`,
    descScore:  (lg,sn) => `Список лучших бомбардиров ${lg} ${sn} - голы и клубы.`,
  },
  id: {
    dir:'ltr', vs:'vs', goals:'⚽ Gol', cards:'🟨 Kartu', subs:'🔄 Pergantian',
    standingsTitle:'Klasemen', scorersTitle:'Top Skor', season:'Musim',
    rank:'#', team:'Klub', player:'Pemain', goalsCol:'Gol',
    mp:'Main', w:'M', d:'S', l:'K', gd:'SG', pts:'Poin',
    back:'← Kembali ke situs', advanced:'Lolos', pens:'Adu Penalti',
    noData:'Data tidak tersedia',
    titleMatch: (h,a,sc,lg,rd) => `${h} vs ${a} ${sc} | ${lg}${rd?' · '+rd:''}`,
    descMatch:  (h,a,sc,lg,rd,sn) => `${h} vs ${a} ${sc}. ${lg} ${rd||''} ${sn||''}. Rangkuman lengkap dengan gol, statistik dan susunan pemain.`,
    titleStand: (lg,sn) => `Klasemen ${lg} ${sn}`,
    descStand:  (lg,sn) => `Tabel klasemen ${lg} musim ${sn} - poin, menang, seri, kalah, selisih gol semua klub.`,
    titleScore: (lg,sn) => `Top Skor ${lg} ${sn}`,
    descScore:  (lg,sn) => `Daftar top skor ${lg} ${sn} - jumlah gol dan klub masing-masing pemain.`,
  },
};

const TR_QUAL = {
  UCL:       { ar:'دوري أبطال أوروبا', en:'Champions League', fr:'Ligue des Champions', es:'Liga de Campeones', pt:'Liga dos Campeões', de:'Champions League', it:'Champions League', tr:'Şampiyonlar Ligi', ru:'Лига чемпионов', id:'Liga Champions' },
  UCL_Q:     { ar:'تصفيات أبطال أوروبا', en:'UCL Qualifying', fr:'Qual. Champions', es:'Clasificación UCL', pt:'Qual. Champions', de:'CL-Qualifikation', it:'Qualif. Champions', tr:'ŞL Eleme', ru:'Квалификация ЛЧ', id:'Kualifikasi Liga Champions' },
  UEL:       { ar:'الدوري الأوروبي', en:'Europa League', fr:'Ligue Europa', es:'Liga Europa', pt:'Liga Europa', de:'Europa League', it:'Europa League', tr:'Avrupa Ligi', ru:'Лига Европы', id:'Liga Europa' },
  UECL:      { ar:'دوري المؤتمر', en:'Conference League', fr:'Ligue Conférence', es:'Conference League', pt:'Conference League', de:'Conference League', it:'Conference League', tr:'Konferans Ligi', ru:'Лига конференций', id:'Conference League' },
  RELEGATED: { ar:'هبوط', en:'Relegated', fr:'Relégué', es:'Descendido', pt:'Rebaixado', de:'Abgestiegen', it:'Retrocesso', tr:'Küme Düştü', ru:'Вылет', id:'Degradasi' },
  PLAYOFF:   { ar:'ملحق البقاء', en:'Relegation Playoff', fr:'Barrage', es:'Playoff', pt:'Playoff', de:'Relegation', it:'Playoff', tr:'Play-off', ru:'Плей-офф', id:'Playoff' },
  NEXT_ROUND:{ ar:'المرحلة التالية', en:'Next Round', fr:'Phase suivante', es:'Siguiente ronda', pt:'Próxima fase', de:'Nächste Runde', it:'Fase successiva', tr:'Sonraki tur', ru:'Следующий раунд', id:'Babak berikutnya' },
  WC:        { ar:'تأهل كأس العالم', en:'World Cup', fr:'Coupe du Monde', es:'Copa del Mundo', pt:'Copa do Mundo', de:'Weltmeisterschaft', it:'Coppa del Mondo', tr:'Dünya Kupası', ru:'Чемпионат мира', id:'Piala Dunia' },
  WC_Q:      { ar:'ملحق كأس العالم', en:'WC Playoff', fr:'Barrage Coupe du Monde', es:'Repesca Mundial', pt:'Playoff Copa', de:'WM-Playoff', it:'Playoff Mondiali', tr:'Dünya Kupası Play-off', ru:'Плей-офф ЧМ', id:'Playoff Piala Dunia' },
  LIBERTAD:  { ar:'كوبا ليبرتادوريس', en:'Copa Libertadores', fr:'Copa Libertadores', es:'Copa Libertadores', pt:'Copa Libertadores', de:'Copa Libertadores', it:'Copa Libertadores', tr:'Copa Libertadores', ru:'Копа Либертадорес', id:'Copa Libertadores' },
  SUDAMERI:  { ar:'كوبا سودامريكانا', en:'Copa Sudamericana', fr:'Copa Sudamericana', es:'Copa Sudamericana', pt:'Copa Sulamericana', de:'Copa Sudamericana', it:'Copa Sudamericana', tr:'Copa Sudamericana', ru:'Копа Судамерикана', id:'Copa Sudamericana' },
};

const LOCALE_MAP = { ar:'ar-EG', en:'en-US', fr:'fr-FR', es:'es-ES', pt:'pt-PT', de:'de-DE', it:'it-IT', tr:'tr-TR', ru:'ru-RU', id:'id-ID' };

function getLang(url) {
  const l = (url.searchParams.get('lang') || 'ar').toLowerCase();
  return LANGS.includes(l) ? l : 'ar';
}

function qualLabel(entry, lang) {
  if (entry.qualKey && TR_QUAL[entry.qualKey]) return TR_QUAL[entry.qualKey][lang] || entry.qualLabel || '';
  return entry.qualLabel || '';
}

function getQualInfo(league, rank, noteText, espnColor) {
  if (noteText) {
    const key = mapEspnNote(noteText);
    if (key && QUAL[key]) return { color: QUAL[key].color, label: QUAL[key].label, key };
    if (espnColor) return { color: `#${espnColor.replace('#','')}`, label: noteText, key: null };
  }
  const rules = LEAGUE_RULES[league] || [];
  for (const rule of rules) {
    if (rule.ranks?.includes(rank) && QUAL[rule.type]) {
      return { color: QUAL[rule.type].color, label: QUAL[rule.type].label, key: rule.type };
    }
  }
  return null;
}

function parseEntries(src, league) {
  return (src || []).map((entry, i) => {
    const stats = {};
    (entry.stats || []).forEach(s => { stats[s.name] = s.value; });
    const rank       = i + 1;
    const noteText   = entry.note?.description || '';
    const espnColor  = entry.note?.color || '';
    const qual       = getQualInfo(league, rank, noteText, espnColor);
    return {
      rank,
      team:      entry.team?.displayName || '',
      logo:      entry.team?.logos?.[0]?.href || '',
      gp:        stats.gamesPlayed        || 0,
      w:         stats.wins               || 0,
      d:         stats.ties               || 0,
      l:         stats.losses             || 0,
      gf:        stats.pointsFor          || 0,
      ga:        stats.pointsAgainst      || 0,
      gd:        stats.pointDifferential  || 0,
      pts:       stats.points             || 0,
      note:      noteText,
      qualColor: qual?.color || null,
      qualLabel: qual?.label || null,
      qualKey:   qual?.key   || null,
    };
  });
}

function parseStandingEntries(raw, league) {
  const children = raw.children || [];
  if (!children.length) return { groups: null, entries: [] };

  if (children.length > 1) {
    const allGroups = children.map(g => ({
      name:    g.name || g.abbreviation || '',
      entries: parseEntries(g.standings?.entries, league),
    }));
    return { groups: allGroups, entries: null };
  }

  const child = children[0];

  if (child.children?.length > 0) {
    const allGroups = child.children.map(g => ({
      name:    g.name || g.abbreviation || '',
      entries: parseEntries(g.standings?.entries, league),
    }));
    return { groups: allGroups, entries: null };
  }

  return { groups: null, entries: parseEntries(child.standings?.entries, league) };
}

async function refreshStandingsForLeague(league, season, env) {
  try {
    const seasonParam = season ? `?season=${season}` : '';
    const raw = await espnFetch(`${ESPN_STANDINGS}/${league}/standings${seasonParam}`);
    const parsed = parseStandingEntries(raw, league);

    const payload = {
      success:    true,
      league,
      leagueName: raw.name || raw.standings?.name || league,
      season:     season || raw.season?.year || '',
      isGrouped:  !!parsed.groups,
      groups:     parsed.groups,
      entries:    parsed.entries,
    };
    await kvPut(env, `standings:${league}:${season || ''}`, payload, 3600);
    return payload;
  } catch { return null; }
}

async function refreshScorersForLeague(league, season, env) {
  try {
    const sep = season ? `?season=${season}&` : '?';
    const raw = await espnFetch(`${ESPN_STATISTICS}/${league}/statistics${sep}limit=30`);

    const goalsCat = (raw.stats || []).find(s =>
      s.name === 'goalsLeaders' ||
      s.abbreviation?.toLowerCase() === 'g' ||
      s.displayName?.toLowerCase().includes('goal')
    ) || raw.stats?.[0];

    const scorers = (goalsCat?.leaders || []).map((ld, i) => {
      const at = ld.athlete || {};
      return {
        rank:     i + 1,
        name:     at.displayName || '',
        photo:    at.team?.logos?.[1]?.href || at.team?.logos?.[0]?.href || '',
        team:     at.team?.displayName || '',
        teamLogo: at.team?.logos?.[0]?.href || '',
        goals:    ld.value || 0,
      };
    });

    const payload = {
      success: true, league,
      leagueName: raw.league?.name || raw.name || league,
      season:     season || raw.season?.year || '',
      scorers,
    };
    await kvPut(env, `scorers:${league}:${season || ''}`, payload, 21600);
    return payload;
  } catch { return null; }
}

async function refreshFixtures(env) {
  const today = todayStr();
  let   days  = 7;
  let   allMatches = [];

  while (days <= 60 && allMatches.length === 0) {
    const end = addDays(today, days);
    try {
      const data = await espnFetch(`${ESPN_ALL}?dates=${today}-${end}&limit=500`);
      const events = (data.events || []).map(parseEvent).filter(m => m.status === 'pre');
      allMatches.push(...events);
      if (events.length === 0) days = days < 30 ? 30 : 60;
      else break;
    } catch { break; }
  }

  allMatches.sort((a, b) => new Date(a.date) - new Date(b.date));
  const payload = {
    success: true,
    fetchedDays: days,
    count: allMatches.length,
    matches: allMatches,
    updatedAt: new Date().toISOString(),
  };
  await kvPut(env, 'fixtures:cache', payload, 6 * 3600);
  return payload;
}

async function archiveStep(env) {
  let archiveState = await kvGet(env, 'archive:state');

  if (!archiveState) {
    const weeks = generateWeekRanges('20200101', todayStr());
    archiveState = { weeks, currentIndex: 0, completed: false };
    await kvPut(env, 'archive:state', archiveState, 90 * 86400);
  }

  if (archiveState.completed) return;

  const { weeks, currentIndex } = archiveState;
  if (currentIndex >= weeks.length) {
    archiveState.completed = true;
    await kvPut(env, 'archive:state', archiveState, 90 * 86400);
    return;
  }

  const week      = weeks[currentIndex];
  const ghPath    = `data/archive/${week}.json`;
  const useGitHub = !!(env.GITHUB_TOKEN && env.GITHUB_REPO);

  let alreadyUploaded = false;
  if (useGitHub) {
    try {
      const chk = await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${ghPath}?ref=${env.GITHUB_BRANCH || 'main'}`,
        { headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'football-worker/1.0' } }
      );
      alreadyUploaded = chk.ok;
    } catch {}
  } else {
    alreadyUploaded = !!(await kvGet(env, `scoreboard:${week}`));
  }

  if (!alreadyUploaded) {
    try {
      let allMatches = [];
      let page = 1;
      let totalPages = 1;
      do {
        const url = `${ESPN_ALL}?dates=${week}&limit=500${page > 1 ? `&page=${page}` : ''}`;
        const data = await espnFetch(url);
        allMatches.push(...(data.events || []).map(parseEvent));
        totalPages = data.pageCount || 1;
        page++;
      } while (page <= totalPages && page <= 3);

      const byDate = {};
      allMatches.forEach(m => {
        const d = formatDate(m.date);
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(m);
      });

      if (useGitHub) {
        await uploadToGitHub(ghPath, allMatches, env);
        await Promise.allSettled(
          Object.entries(byDate).map(([d, matches]) =>
            uploadToGitHub(`data/scoreboard/${d}.json`, matches, env)
          )
        );
      } else {
        await kvPut(env, `scoreboard:${week}`, allMatches, 90 * 86400);
        for (const [d, matches] of Object.entries(byDate)) {
          await kvPut(env, `scoreboard:${d}`, matches, 90 * 86400);
        }
      }
    } catch {}
  }

  archiveState.currentIndex = currentIndex + 1;
  await kvPut(env, 'archive:state', archiveState, 90 * 86400);
}

async function deepFutureScan(env) {
  const lastRun = await kvGet(env, 'deep:lastRun');
  if (lastRun && Date.now() - lastRun < 23 * 60 * 60 * 1000) return;

  const today = todayStr();

  let allMatches = [];
  try {
    let page = 1;
    let totalPages = 1;
    const range = `${today}-${addDays(today, 365)}`;
    do {
      const url  = `${ESPN_ALL}?dates=${range}&limit=500${page > 1 ? `&page=${page}` : ''}`;
      const data = await espnFetch(url);
      allMatches.push(...(data.events || []).map(parseEvent));
      totalPages = data.pageCount || 1;
      page++;
    } while (page <= totalPages && page <= 3);
  } catch {}

  const upcoming = allMatches
    .filter(m => m.status === 'pre' && new Date(m.date) > new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  await kvPut(env, 'fixtures:future', upcoming, 30 * 86400);

  const discoveredLeagues = new Set();
  try {
    const recentScoreboard = await kvGet(env, `scoreboard:${today}`);
    if (Array.isArray(recentScoreboard)) {
      recentScoreboard.forEach(m => { if (m.league) discoveredLeagues.add(m.league); });
    }
    upcoming.forEach(m => { if (m.league) discoveredLeagues.add(m.league); });
  } catch {}

  const allLeagues = [...new Set([...KNOWN_LEAGUES, ...discoveredLeagues])];

  let fetched = 0;
  for (const league of allLeagues) {
    const tasks = [];
    if (!NO_STANDINGS.has(league)) tasks.push(refreshStandingsForLeague(league, '', env));
    tasks.push(refreshScorersForLeague(league, '', env));
    try { await Promise.allSettled(tasks); } catch {}
    fetched++;
    await new Promise(r => setTimeout(r, fetched % 20 === 0 ? 2000 : 400));
  }

  await kvPut(env, 'deep:lastRun', Date.now(), 86400);
  await kvPut(env, 'deep:leagueCount', allLeagues.length, 86400);
}

function generateKeywords(match) {
  const h = match.homeTeam || '';
  const a = match.awayTeam || '';
  const l = match.leagueName || '';
  const s = match.season || '';
  const r = match.round || '';
  const score = `${match.homeScore}-${match.awayScore}`;

  return [
    `${h} vs ${a}`, `${h} versus ${a}`, `${h} goals`, `${a} goals`,
    `${l} ${r} ${s}`, `${l} results ${s}`, `match summary ${s}`,
    `${h} ${a} highlights`, `${h} ${a} lineups`, `${h} ${a} score`,
    `${h} ضد ${a}`, `أهداف ${h}`, `أهداف ${a}`,
    `نتيجة ${l} ${s}`, `ملخص مباراة ${h} و${a}`,
    `مباراة ${h} و${a}`, `نتيجة مباراة اليوم`,
    `${h} contre ${a}`, `buts ${h}`, `buts ${a}`,
    `résultat ${l} ${s}`, `résumé ${h} ${a}`, `finale ${l} ${s}`,
    `${h} vs ${a} resultado`, `goles ${h}`, `goles ${a}`,
    `resultado ${l} ${s}`, `resumen ${h} ${a}`, `final ${l} ${s}`,
    `${h} contra ${a}`, `gols ${h}`, `gols ${a}`,
    `resultado ${l} ${s}`, `resumo ${h} ${a}`, `placar ${h} ${a}`,
    `${h} gegen ${a}`, `${h} Tore`, `${a} Tore`,
    `${l} Ergebnis ${s}`, `${h} ${a} Zusammenfassung`,
    `${h} contro ${a}`, `gol ${h}`, `gol ${a}`,
    `risultato ${l} ${s}`, `formazioni ${h} ${a}`, `finale ${l} ${s}`,
    `${h} ${a} maç özeti`, `${h} golleri`, `${a} golleri`,
    `${l} ${s} sonucu`, `${h} ${a} maç sonucu`,
    `${h} против ${a}`, `голы ${h}`, `голы ${a}`,
    `результат ${l} ${s}`, `обзор ${h} ${a}`,
    `${h} vs ${a} skor`, `gol ${h}`, `gol ${a}`,
    `hasil ${l} ${s}`, `rangkuman ${h} ${a}`,
    score, l, r, s, match.venue || '',
  ].filter(Boolean).join(', ');
}

function generateStandingsKeywords(leagueName, seasonLabel) {
  const l = leagueName || '';
  const s = seasonLabel || '';
  return [
    `${l} standings ${s}`, `${l} table ${s}`, `${l} points table`,
    `${l} league table`, `${l} ranking ${s}`, `${l} results ${s}`,
    `ترتيب ${l} ${s}`, `جدول ${l}`, `ترتيب الدوري ${s}`,
    `نقاط ${l}`, `فرق ${l}`,
    `classement ${l} ${s}`, `tableau ${l}`, `classement championnat`,
    `tabla ${l} ${s}`, `clasificación ${l}`, `posiciones ${l} ${s}`,
    `tabela ${l} ${s}`, `classificação ${l}`, `pontos ${l}`,
    `${l} Tabelle ${s}`, `${l} Standings`, `Tabellenstand ${l}`,
    `classifica ${l} ${s}`, `tabella ${l}`, `punti ${l}`,
    `${l} puan durumu ${s}`, `${l} sıralama`, `${l} tablosu`,
    `таблица ${l} ${s}`, `турнирная таблица ${l}`, `очки ${l}`,
    `klasemen ${l} ${s}`, `tabel ${l}`, `peringkat ${l}`,
    l, s,
  ].filter(Boolean).join(', ');
}

function generateScorersKeywords(leagueName, seasonLabel) {
  const l = leagueName || '';
  const s = seasonLabel || '';
  return [
    `${l} top scorers ${s}`, `${l} goal scorers`, `${l} golden boot ${s}`,
    `${l} leading scorers`, `best scorers ${l} ${s}`,
    `هدافو ${l} ${s}`, `أفضل هداف ${l}`, `الهدافون ${l}`,
    `قائمة الهدافين ${l}`, `أكثر لاعب تسجيلاً ${l}`,
    `meilleurs buteurs ${l} ${s}`, `classement buteurs ${l}`,
    `soulier d'or ${l}`, `buteurs ${l}`,
    `goleadores ${l} ${s}`, `máximo goleador ${l}`,
    `bota de oro ${l}`, `tabla goleadores ${l}`,
    `artilheiros ${l} ${s}`, `goleadores ${l}`,
    `chuteira de ouro ${l}`, `top marcadores ${l}`,
    `${l} Torschützen ${s}`, `${l} Torjäger`, `${l} Torschützenkönig`,
    `capocannonieri ${l} ${s}`, `marcatori ${l}`, `scarpa d'oro ${l}`,
    `${l} gol krallığı ${s}`, `${l} en çok gol atan`,
    `${l} golcüler`, `${l} gol listesi`,
    `лучшие бомбардиры ${l} ${s}`, `топ бомбардиры ${l}`,
    `голы ${l}`, `бомбардиры сезона`,
    `top skor ${l} ${s}`, `pencetak gol terbanyak ${l}`,
    `daftar top scorer ${l}`,
    l, s,
  ].filter(Boolean).join(', ');
}

async function handleMatchPage(matchId, league, env, lang) {
  const t = TR[lang] || TR.ar;

  let data = await kvGet(env, `summary:${matchId}`);
  if (!data && league) {
    data = await fetchAndStoreSummary(matchId, league, env);
  }
  if (!data) data = { homeTeam:'Home', awayTeam:'Away', homeScore:'?', awayScore:'?', leagueName:'', date:'', venue:'', round:'', season:'' };

  const score   = `${data.homeScore} - ${data.awayScore}`;
  const title   = t.titleMatch(data.homeTeam, data.awayTeam, score, data.leagueName, data.round);
  const desc    = t.descMatch(data.homeTeam, data.awayTeam, score, data.leagueName, data.round, data.season);
  const kw      = generateKeywords(data);
  const locale  = LOCALE_MAP[lang] || 'ar-EG';
  const dateStr = data.date ? new Date(data.date).toLocaleDateString(locale, { year:'numeric', month:'long', day:'numeric' }) : '';

  const goalsHtml = (data.goals || []).map(g => `<li>${g.minute || ''} ${g.type==='OG'?'🔵':'⚽'} ${g.player || ''} (${g.team || ''})</li>`).join('') || '<li>-</li>';
  const cardsHtml = (data.cards || []).map(c => `<li>${c.minute || ''} ${c.type?.includes('Red')?'🟥':'🟨'} ${c.player || ''} (${c.team || ''})</li>`).join('') || '<li>-</li>';
  const subsHtml  = (data.subs || []).map(s => `<li>${s.minute || ''} 🔄 ${s.playerIn || ''} ← ${s.playerOut || ''} (${s.team || ''})</li>`).join('') || '<li>-</li>';

  const BASE = env.WORKER_BASE_URL || '';
  const pageBase = `${BASE}/page/match/${matchId}/${league}`;
  const hreflangs = LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${pageBase}?lang=${l}">`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="keywords" content="${kw}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
${hreflangs}
<link rel="alternate" hreflang="x-default" href="${pageBase}?lang=ar">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"SportsEvent",
"name":"${data.homeTeam} vs ${data.awayTeam}",
"startDate":"${data.date || ''}",
"location":{"@type":"Place","name":"${data.venue || ''}"},
"homeTeam":{"@type":"SportsTeam","name":"${data.homeTeam}"},
"awayTeam":{"@type":"SportsTeam","name":"${data.awayTeam}"},
"description":"${desc}"}
</script>
<style>
body{font-family:Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:1.5rem;direction:${t.dir};max-width:800px;margin:0 auto}
h1{color:#58a6ff;font-size:1.4rem;margin-bottom:.5rem}
.score{font-size:3.5rem;font-weight:900;text-align:center;margin:1rem 0}
.teams{font-size:1.2rem;text-align:center;color:#8b949e;margin-bottom:.5rem}
.meta{color:#8b949e;font-size:.9rem;margin:.3rem 0;text-align:center}
.league{color:#58a6ff;text-align:center;font-size:1rem;margin-bottom:.3rem}
.section{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:1rem;margin-top:1rem}
.section h3{color:#8b949e;font-size:.85rem;text-transform:uppercase;margin-bottom:.5rem}
ul{list-style:none;padding:0;margin:0}
ul li{padding:.4rem 0;border-bottom:1px solid #21262d;font-size:.9rem}
ul li:last-child{border-bottom:none}
a{color:#58a6ff}
</style>
</head>
<body>
<div class="league">${data.leagueName} ${data.round ? '· ' + data.round : ''}</div>
<div class="teams">${data.homeTeam} — ${data.awayTeam}</div>
<div class="score">${score}</div>
${data.venue      ? `<div class="meta">🏟️ ${data.venue}</div>` : ''}
${dateStr         ? `<div class="meta">📅 ${dateStr}</div>` : ''}
${data.statusText ? `<div class="meta">⏱️ ${data.statusText}</div>` : ''}
${data.advancement   ? `<div class="meta" style="color:#3fb950;font-weight:700">🏆 ${t.advanced}: ${data.advancement}</div>` : ''}
${data.penaltyWinner ? `<div class="meta" style="color:#f0883e;font-weight:700">⚽ ${t.pens}: ${data.penaltyWinner}</div>` : ''}

<div class="section"><h3>${t.goals}</h3><ul>${goalsHtml}</ul></div>
<div class="section"><h3>${t.cards}</h3><ul>${cardsHtml}</ul></div>
<div class="section"><h3>${t.subs}</h3><ul>${subsHtml}</ul></div>

<p style="margin-top:1.5rem;text-align:center"><a href="/">${t.back}</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: { ...CORS, 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public,max-age=3600' }
  });
}

async function handleStandingsPage(league, season, env, lang) {
  const t = TR[lang] || TR.ar;

  let payload = await kvGet(env, `standings:${league}:${season || ''}`);
  if (!payload) payload = await refreshStandingsForLeague(league, season, env);
  if (!payload || (!payload.entries?.length && !payload.groups?.length)) {
    return new Response(`<h1>${t.noData}</h1>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }

  const seasonLabel = season ? `${season}-${+season+1}` : (t.season === 'الموسم' ? 'الحالي' : 'Current');
  const title = t.titleStand(payload.leagueName, seasonLabel);
  const desc  = t.descStand(payload.leagueName, seasonLabel);
  const kw    = generateStandingsKeywords(payload.leagueName, seasonLabel);
  const BASE  = env.WORKER_BASE_URL || '';
  const pageBase = `${BASE}/page/standings/${league}${season?'/'+season:''}`;
  const hreflangs = LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${pageBase}?lang=${l}">`).join('\n');

  const teamAlign = lang === 'ar' ? 'text-align:right' : 'text-align:left';

  function seoTableRows(entries) {
    return entries.map(e => {
      const bar  = e.qualColor ? `border-${lang==='ar'?'right':'left'}:3px solid ${e.qualColor}` : `border-${lang==='ar'?'right':'left'}:3px solid transparent`;
      const lbl  = qualLabel(e, lang);
      const tip  = lbl ? ` title="${lbl}"` : '';
      return `<tr style="${bar}"${tip}>
        <td>${e.rank}</td>
        <td style="${teamAlign}">${e.team}</td>
        <td>${e.gp}</td><td>${e.w}</td><td>${e.d}</td><td>${e.l}</td>
        <td>${e.gd > 0 ? '+' : ''}${e.gd}</td>
        <td><strong>${e.pts}</strong></td>
      </tr>`;
    }).join('');
  }

  function seoTable(entries) {
    return `<table>
      <thead><tr>
        <th>${t.rank}</th><th>${t.team}</th>
        <th>${t.mp}</th><th>${t.w}</th><th>${t.d}</th><th>${t.l}</th>
        <th>${t.gd}</th><th>${t.pts}</th>
      </tr></thead>
      <tbody>${seoTableRows(entries)}</tbody>
    </table>`;
  }

  function seoLegend(entries) {
    const seen = new Map();
    entries.forEach(e => {
      const lbl = qualLabel(e, lang);
      if (e.qualColor && lbl && !seen.has(e.qualColor)) seen.set(e.qualColor, lbl);
    });
    if (!seen.size) return '';
    return `<div style="display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0;font-size:.78rem;color:#8b949e">
      ${[...seen.entries()].map(([c,l]) => `<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};margin-${lang==='ar'?'left':'right'}:4px;vertical-align:middle"></span>${l}</span>`).join('')}
    </div>`;
  }

  let tablesHtml = '';
  if (payload.isGrouped && payload.groups?.length) {
    payload.groups.forEach(g => {
      const entries = g.entries || [];
      tablesHtml += `<h2 style="color:#8b949e;font-size:1rem;margin:1.5rem 0 .5rem">${g.name}</h2>
        ${seoTable(entries)}${seoLegend(entries)}`;
    });
  } else {
    const entries = payload.entries || [];
    tablesHtml = seoTable(entries) + seoLegend(entries);
  }

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="keywords" content="${kw}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
${hreflangs}
<link rel="alternate" hreflang="x-default" href="${pageBase}?lang=ar">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"SportsOrganization","name":"${payload.leagueName}","description":"${desc}"}
</script>
<style>
body{font-family:Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:1rem;direction:${t.dir};max-width:850px;margin:0 auto}
h1{color:#58a6ff;text-align:center;margin-bottom:1rem;font-size:1.3rem}
h2{color:#8b949e;font-size:1rem;margin:1.5rem 0 .4rem}
table{width:100%;border-collapse:collapse;margin-bottom:.5rem}
th,td{padding:.5rem .65rem;border-bottom:1px solid #30363d;text-align:center;font-size:.83rem}
th{background:#161b22;color:#8b949e;font-size:.72rem}
td:nth-child(2){${teamAlign}}
tr:hover td{background:#161b22}
strong{color:#58a6ff}
a{color:#58a6ff}
</style>
</head>
<body>
<h1>${title}</h1>
${tablesHtml}
<p style="text-align:center;margin-top:1.5rem"><a href="/">${t.back}</a></p>
</body></html>`;

  return new Response(html, { headers: { ...CORS, 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public,max-age=3600' } });
}

async function handleScorersPage(league, season, env, lang) {
  const t = TR[lang] || TR.ar;

  let payload = await kvGet(env, `scorers:${league}:${season || ''}`);
  if (!payload) payload = await refreshScorersForLeague(league, season, env);
  if (!payload || !payload.scorers?.length) {
    return new Response(`<h1>${t.noData}</h1>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }

  const seasonLabel = season ? `${season}-${+season+1}` : (t.season === 'الموسم' ? 'الحالي' : 'Current');
  const title = t.titleScore(payload.leagueName, seasonLabel);
  const desc  = t.descScore(payload.leagueName, seasonLabel);
  const kw    = generateScorersKeywords(payload.leagueName, seasonLabel);
  const BASE  = env.WORKER_BASE_URL || '';
  const pageBase = `${BASE}/page/scorers/${league}${season?'/'+season:''}`;
  const hreflangs = LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${pageBase}?lang=${l}">`).join('\n');

  const nameAlign = lang === 'ar' ? 'text-align:right' : 'text-align:left';

  const rows = payload.scorers.map(s => `
    <tr>
      <td>${s.rank}</td>
      <td style="${nameAlign}">${s.name}</td>
      <td>${s.team}</td>
      <td><strong>${s.goals}</strong></td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="keywords" content="${kw}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
${hreflangs}
<link rel="alternate" hreflang="x-default" href="${pageBase}?lang=ar">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"SportsOrganization","name":"${payload.leagueName}","description":"${desc}"}
</script>
<style>
body{font-family:Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:1rem;direction:${t.dir}}
h1{color:#58a6ff;text-align:center;margin-bottom:1rem;font-size:1.3rem}
table{width:100%;border-collapse:collapse;max-width:700px;margin:0 auto}
th,td{padding:.55rem .7rem;border-bottom:1px solid #30363d;text-align:center;font-size:.85rem}
th{background:#161b22;color:#8b949e;font-size:.75rem}
td:nth-child(2),th:nth-child(2){${nameAlign}}
tr:hover td{background:#161b22}
strong{color:#3fb950;font-size:1.1rem}
a{color:#58a6ff}
</style>
</head>
<body>
<h1>${title}</h1>
<table>
<thead><tr>
  <th>${t.rank}</th><th>${t.player}</th><th>${t.team}</th><th>${t.goalsCol}</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="text-align:center;margin-top:1.5rem"><a href="/">${t.back}</a></p>
</body></html>`;

  return new Response(html, { headers: { ...CORS, 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public,max-age=3600' } });
}

function handleRobotsTxt(env) {
  const BASE = env.WORKER_BASE_URL || '';
  const txt = `User-agent: *\nAllow: /page/\nDisallow: /api/\nDisallow: /api/archive\n\nSitemap: ${BASE}/sitemap.xml\n`;
  return new Response(txt, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public,max-age=86400' }
  });
}

async function handleSitemap(env) {
  const BASE    = env.WORKER_BASE_URL || 'https://football-worker.YOUR_NAME.workers.dev';
  const curYear = new Date().getFullYear();
  const SEASONS = [String(curYear-4), String(curYear-3), String(curYear-2), String(curYear-1), String(curYear)];

  const urls = [];
  KNOWN_LEAGUES.forEach(id => {
    const hasStandings = !NO_STANDINGS.has(id);
    urls.push(`<url><loc>${BASE}/page/scorers/${id}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`);
    SEASONS.forEach(s => {
      urls.push(`<url><loc>${BASE}/page/scorers/${id}/${s}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
    });
    if (hasStandings) {
      urls.push(`<url><loc>${BASE}/page/standings/${id}</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`);
      SEASONS.forEach(s => {
        urls.push(`<url><loc>${BASE}/page/standings/${id}/${s}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
      });
    }
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public,max-age=86400' } });
}

async function handleMatches(url, env) {
  const date   = url.searchParams.get('date') || todayStr();
  const league = url.searchParams.get('league') || 'all';

  let matches = await fetchScoreboard(date, env);

  if (league !== 'all') {
    matches = matches.filter(m =>
      m.league === league ||
      m.leagueName?.toLowerCase().includes(league.toLowerCase())
    );
  }

  return jsonResp({ success: true, date, league, count: matches.length, matches });
}

async function handleSummaryAPI(url, env) {
  const matchId = url.searchParams.get('matchId');
  const league  = url.searchParams.get('league');
  if (!matchId) return errResp('matchId required', 400);

  let data = await kvGet(env, `summary:${matchId}`);
  if (!data && league) data = await fetchAndStoreSummary(matchId, league, env);
  if (!data) return errResp('Match not found', 404);

  return jsonResp({ success: true, ...data });
}

async function handleStandingsAPI(url, env) {
  const league = url.searchParams.get('league') || 'eng.1';
  const season = url.searchParams.get('season') || '';

  let payload = await kvGet(env, `standings:${league}:${season}`);
  if (!payload) payload = await refreshStandingsForLeague(league, season, env);
  if (!payload) return errResp('No standings data', 404);

  return jsonResp(payload);
}

async function handleScorersAPI(url, env) {
  const league = url.searchParams.get('league') || 'eng.1';
  const season = url.searchParams.get('season') || '';

  let payload = await kvGet(env, `scorers:${league}:${season}`);
  if (!payload) payload = await refreshScorersForLeague(league, season, env);
  if (!payload) return errResp('No scorers data', 404);

  return jsonResp(payload);
}

async function handleFixturesAPI(url, env) {
  let payload = await kvGet(env, 'fixtures:cache');
  if (!payload) payload = await refreshFixtures(env);
  if (!payload) return errResp('No fixtures data', 404);

  const future = await kvGet(env, 'fixtures:future');
  if (Array.isArray(future) && future.length) {
    const ids   = new Set(payload.matches.map(m => m.id));
    const extra = future.filter(m => !ids.has(m.id));
    if (extra.length) {
      const merged = [...payload.matches, ...extra].sort((a, b) => new Date(a.date) - new Date(b.date));
      payload = { ...payload, matches: merged, count: merged.length };
    }
  }

  const league = url.searchParams.get('league');
  if (league && league !== 'all') {
    payload = { ...payload, matches: payload.matches.filter(m => m.league === league || m.leagueName?.toLowerCase().includes(league.toLowerCase())) };
  }

  return jsonResp(payload);
}

async function handleArchiveStatus(url, env) {
  const secret = url.searchParams.get('secret');
  if (!env.ARCHIVE_SECRET || secret !== env.ARCHIVE_SECRET) return errResp('Unauthorized', 401);

  const state = await kvGet(env, 'archive:state');
  if (!state) return jsonResp({ status: 'not_started' });

  const progress = state.completed
    ? 100
    : Math.round((state.currentIndex / state.weeks.length) * 100);

  return jsonResp({
    status:      state.completed ? 'completed' : 'in_progress',
    progress:    `${progress}%`,
    processed:   state.currentIndex,
    total:       state.weeks.length,
    currentWeek: state.weeks[state.currentIndex] || 'done',
  });
}

async function handlePage(path, url, env) {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'page') return errResp('Not Found', 404);

  const lang = getLang(url);
  const type = parts[1];

  if (type === 'match') {
    const matchId = parts[2];
    const league  = parts[3] || url.searchParams.get('league') || '';
    if (!matchId) return errResp('Invalid URL', 400);
    return handleMatchPage(matchId, league, env, lang);
  }
  if (type === 'standings') {
    const league = parts[2];
    const season = parts[3] || '';
    if (!league) return errResp('Invalid URL', 400);
    return handleStandingsPage(league, season, env, lang);
  }
  if (type === 'scorers') {
    const league = parts[2];
    const season = parts[3] || '';
    if (!league) return errResp('Invalid URL', 400);
    return handleScorersPage(league, season, env, lang);
  }
  return errResp('Not Found', 404);
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    },
  });
}

function errResp(msg, status = 500) {
  return jsonResp({ success: false, error: msg }, status);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    let response;

    try {
      if (path === '/ping') {
        response = new Response('pong', { headers: CORS });
      } else if (path === '/robots.txt') {
        response = handleRobotsTxt(env);
      } else if (path === '/api/matches') {
        response = await handleMatches(url, env);
      } else if (path === '/api/summary') {
        response = await handleSummaryAPI(url, env);
      } else if (path === '/api/standings') {
        response = await handleStandingsAPI(url, env);
      } else if (path === '/api/scorers') {
        response = await handleScorersAPI(url, env);
      } else if (path === '/api/fixtures') {
        response = await handleFixturesAPI(url, env);
      } else if (path === '/api/archive') {
        response = await handleArchiveStatus(url, env);
      } else if (path === '/sitemap.xml') {
        response = await handleSitemap(env);
      } else if (path.startsWith('/page/')) {
        response = await handlePage(path, url, env);
      } else {
        return errResp('Not Found', 404);
      }

      // إضافة CORS headers لجميع الردود
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      
      return response;

    } catch (e) {
      return errResp(e.message);
    }
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron;

    if (cron === '* * * * *') {
      ctx.waitUntil(smartRefresh(env));
    }

    if (cron === '0 */6 * * *') {
      ctx.waitUntil(refreshFixtures(env));
    }

    if (cron === '*/20 * * * *') {
      const archiveState = await kvGet(env, 'archive:state');
      if (!archiveState?.completed) {
        ctx.waitUntil(archiveStep(env));
      } else {
        ctx.waitUntil(deepFutureScan(env));
      }
    }
  },
};