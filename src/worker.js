// ═══════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers
// ESPN all/scoreboard + dynamic league discovery via all/summary + KV Cache
// ═══════════════════════════════════════════════════════════════════════════

const ESPN_ALL     = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary';
const ESPN_LEAGUE  = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_STAND   = 'https://site.api.espn.com/apis/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const LEAGUE_MAP = {
  '606':   { name: 'كأس العالم FIFA',                    flag: '🌍', slug: 'fifa.world'              },
  '786':   { name: 'تصفيات كأس العالم (أوروبا)',          flag: '🌍', slug: 'fifa.worldq.uefa'        },
  '787':   { name: 'تصفيات كأس العالم (أمريكا الجنوبية)', flag: '🌍', slug: 'fifa.worldq.conmebol'   },
  '788':   { name: 'تصفيات كأس العالم (كونكاكاف)',        flag: '🌍', slug: 'fifa.worldq.concacaf'   },
  '789':   { name: 'تصفيات كأس العالم (آسيا)',            flag: '🌍', slug: 'fifa.worldq.afc'         },
  '790':   { name: 'تصفيات كأس العالم (أفريقيا)',         flag: '🌍', slug: 'fifa.worldq.caf'         },
  '781':   { name: 'بطولة أمم أوروبا',                   flag: '🇪🇺', slug: 'uefa.euro'               },
  '3908':  { name: 'كأس أمم أفريقيا',                   flag: '🌍', slug: 'caf.nations'             },
  '4004':  { name: 'كأس الكونكاكاف الذهبية',             flag: '🌎', slug: 'concacaf.gold'           },
  '4005':  { name: 'كوبا أمريكا',                        flag: '🌎', slug: 'conmebol.america'        },
  '11088': { name: 'دوري الأمم الأوروبية',               flag: '🇪🇺', slug: 'uefa.nations'            },
  '775':   { name: 'دوري أبطال أوروبا',                 flag: '⭐', slug: 'uefa.champions'          },
  '776':   { name: 'الدوري الأوروبي',                   flag: '🟠', slug: 'uefa.europa'             },
  '18469': { name: 'الدوري الأوروبي للكونفرنس',          flag: '🔵', slug: 'uefa.europa.conf'        },
  '783':   { name: 'كوبا ليبرتادوريس',                  flag: '🌎', slug: 'conmebol.libertadores'   },
  '5454':  { name: 'كوبا سوداميريكانا',                 flag: '🌎', slug: 'conmebol.sudamericana'   },
  '3902':  { name: 'دوري أبطال آسيا (غرب)',              flag: '🌏', slug: 'afc.champions'            },
  '5661':  { name: 'دوري أبطال آسيا (شرق)',              flag: '🌏', slug: 'afc.cup'                 },
  '2391':  { name: 'دوري أبطال أفريقيا',                flag: '🌍', slug: 'caf.champions'           },
  '3910':  { name: 'كأس أمم أفريقيا U23',               flag: '🌍', slug: 'caf.u23'                 },
  '3916':  { name: 'كأس العالم للشباب U20',             flag: '🌍', slug: 'fifa.world.u20'           },
  '700':   { name: 'الدوري الإنجليزي الممتاز',           flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', slug: 'eng.1'                  },
  '701':   { name: 'الدوري الإنجليزي الدرجة 2',         flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', slug: 'eng.2'                  },
  '703':   { name: 'كأس الاتحاد الإنجليزي FA',          flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', slug: 'eng.fa'                 },
  '740':   { name: 'الدوري الإسباني',                   flag: '🇪🇸', slug: 'esp.1'                  },
  '741':   { name: 'الدوري الإسباني الدرجة 2',          flag: '🇪🇸', slug: 'esp.2'                  },
  '720':   { name: 'الدوري الألماني',                   flag: '🇩🇪', slug: 'ger.1'                  },
  '721':   { name: 'الدوري الألماني الدرجة 2',          flag: '🇩🇪', slug: 'ger.2'                  },
  '730':   { name: 'الدوري الإيطالي',                   flag: '🇮🇹', slug: 'ita.1'                  },
  '731':   { name: 'الدوري الإيطالي الدرجة 2',         flag: '🇮🇹', slug: 'ita.2'                  },
  '710':   { name: 'الدوري الفرنسي',                    flag: '🇫🇷', slug: 'fra.1'                  },
  '711':   { name: 'الدوري الفرنسي الدرجة 2',          flag: '🇫🇷', slug: 'fra.2'                  },
  '715':   { name: 'الدوري البرتغالي',                  flag: '🇵🇹', slug: 'por.1'                  },
  '725':   { name: 'الدوري الهولندي',                   flag: '🇳🇱', slug: 'ned.1'                  },
  '3946':  { name: 'الدوري التركي',                     flag: '🇹🇷', slug: 'tur.1'                  },
  '735':   { name: 'الدوري الاسكتلندي',                 flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', slug: 'sco.1'                  },
  '3901':  { name: 'الدوري البلجيكي',                   flag: '🇧🇪', slug: 'bel.1'                  },
  '3955':  { name: 'الدوري اليوناني',                   flag: '🇬🇷', slug: 'gre.1'                  },
  '3939':  { name: 'الدوري الروسي',                     flag: '🇷🇺', slug: 'rus.1'                  },
  '3907':  { name: 'الدوري النمساوي',                   flag: '🇦🇹', slug: 'aut.1'                  },
  '3913':  { name: 'الدوري الدنماركي',                  flag: '🇩🇰', slug: 'den.1'                  },
  '3960':  { name: 'الدوري النرويجي',                   flag: '🇳🇴', slug: 'nor.1'                  },
  '3945':  { name: 'الدوري السويدي',                    flag: '🇸🇪', slug: 'swe.1'                  },
  '3941':  { name: 'الدوري البولندي',                   flag: '🇵🇱', slug: 'pol.1'                  },
  '3953':  { name: 'الدوري السويسري',                   flag: '🇨🇭', slug: 'sui.1'                  },
  '630':   { name: 'الدوري البرازيلي',                  flag: '🇧🇷', slug: 'bra.1'                  },
  '4007':  { name: 'الدوري البرازيلي الدرجة 2',        flag: '🇧🇷', slug: 'bra.2'                  },
  '745':   { name: 'الدوري الأرجنتيني',                 flag: '🇦🇷', slug: 'arg.1'                  },
  '4003':  { name: 'البطولة الأرجنتينية',               flag: '🇦🇷', slug: 'arg.plen'               },
  '3904':  { name: 'الدوري الأرجنتيني الدرجة 2',       flag: '🇦🇷', slug: 'arg.2'                  },
  '760':   { name: 'الدوري المكسيكي',                   flag: '🇲🇽', slug: 'mex.1'                  },
  '770':   { name: 'MLS',                              flag: '🇺🇸', slug: 'usa.1'                  },
  '4009':  { name: 'دوري USLC',                        flag: '🇺🇸', slug: 'usa.usl.l1'             },
  '4037':  { name: 'دوري USL الدرجة الأولى',           flag: '🇺🇸', slug: 'usa.usl.l2'             },
  '650':   { name: 'الدوري الكولومبي',                  flag: '🇨🇴', slug: 'col.1'                  },
  '640':   { name: 'الدوري التشيلي',                    flag: '🇨🇱', slug: 'chi.1'                  },
  '660':   { name: 'الدوري الإكوادوري',                 flag: '🇪🇨', slug: 'ecu.1'                  },
  '670':   { name: 'الدوري البيروفي',                   flag: '🇵🇪', slug: 'per.1'                  },
  '620':   { name: 'الدوري البوليفي',                   flag: '🇧🇴', slug: 'bol.1'                  },
  '680':   { name: 'الدوري الأوروغوياني',               flag: '🇺🇾', slug: 'uru.1'                  },
  '21231': { name: 'دوري روشن السعودي',                 flag: '🇸🇦', slug: 'ksa.1'                  },
  '8049':  { name: 'الدوري القطري',                     flag: '🇶🇦', slug: 'qat.1'                  },
  '8361':  { name: 'دوري الخليج الإماراتي',             flag: '🇦🇪', slug: 'are.1'                  },
  '8662':  { name: 'الدوري الكويتي',                   flag: '🇰🇼', slug: 'kwt.1'                  },
  '8253':  { name: 'الدوري العراقي',                   flag: '🇮🇶', slug: 'irq.1'                  },
  '8355':  { name: 'الدوري المصري',                    flag: '🇪🇬', slug: 'egy.1'                  },
  '8345':  { name: 'الدوري المغربي',                   flag: '🇲🇦', slug: 'mar.1'                  },
  '8356':  { name: 'الرابطة التونسية',                 flag: '🇹🇳', slug: 'tun.1'                  },
  '750':   { name: 'الدوري الياباني J1',               flag: '🇯🇵', slug: 'jpn.1'                  },
  '8376':  { name: 'الدوري الصيني',                    flag: '🇨🇳', slug: 'chn.1'                  },
  '3906':  { name: 'الدوري الأسترالي',                 flag: '🇦🇺', slug: 'aus.1'                  },
  '8316':  { name: 'الدوري الهندي ISL',               flag: '🇮🇳', slug: 'ind.1'                  },
  '3930':  { name: 'الدوري الأيرلندي',                 flag: '🇮🇪', slug: 'irl.1'                  },
};

const STAGE_NAMES = {
  'group-stage':    'دور المجموعات',
  'regular-season': 'الدوري',
  'knockout-round': 'دور خروج المغلوب',
  'quarterfinals':  'ربع النهائي',
  'quarter-final':  'ربع النهائي',
  'semifinals':     'نصف النهائي',
  'semifinal':      'نصف النهائي',
  'final':          'النهائي',
  'finals':         'النهائي',
  'round-of-16':    'دور الـ16',
  'round-of-32':    'دور الـ32',
  'play-in':        'الملحق',
  'playoffs':       'الإقصائيات',
  '3rd-place-match':'مباراة المركز الثالث',
  'first-stage':    'الدور الأول',
  'second-stage':   'الدور الثاني',
};

async function kvGet(env, key) {
  if (!env?.FOOTBALL_KV) return null;
  try { return await env.FOOTBALL_KV.get(key, { type: 'json' }); } catch { return null; }
}

async function kvPut(env, key, value, ttl = 86400) {
  if (!env?.FOOTBALL_KV) return;
  try { await env.FOOTBALL_KV.put(key, JSON.stringify(value), { expirationTtl: ttl }); } catch {}
}

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

async function espnFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

function extractLeagueId(event) {
  return event.uid?.match(/l:(\d+)/)?.[1] || '';
}

function parseEvent(ev) {
  const comp      = ev.competitions?.[0] || {};
  const home      = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away      = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status    = ev.status?.type || {};
  const leagueId  = extractLeagueId(ev);
  const info      = LEAGUE_MAP[leagueId];
  const stageSlug = ev.season?.slug || '';
  const stage     = STAGE_NAMES[stageSlug] || '';
  const year      = ev.season?.year || '';

  return {
    id:          ev.id,
    leagueId,
    league:      info?.slug  || stageSlug || '',
    leagueName:  info?.name  || '',
    leagueFlag:  info?.flag  || '',
    leagueStage: stage,
    leagueYear:  year,
    date:        ev.date,
    homeTeam:    home.team?.displayName || '',
    homeLogo:    home.team?.logos?.[0]?.href || '',
    homeScore:   home.score ?? '',
    awayTeam:    away.team?.displayName || '',
    awayLogo:    away.team?.logos?.[0]?.href || '',
    awayScore:   away.score ?? '',
    status:      status.state || 'pre',
    statusText:  status.shortDetail || status.description || '',
    minute:      ev.status?.displayClock || '',
    venue:       comp.venue?.fullName || '',
    season:      year,
  };
}

async function fetchMatches(date, env, forceRefresh = false) {
  const kvKey = `matches:${date}`;
  if (!forceRefresh) {
    const cached = await kvGet(env, kvKey);
    if (cached) return cached;
  }
  try {
    let all = [], page = 1, totalPages = 1;
    do {
      const url  = `${ESPN_ALL}?dates=${date}&limit=500${page > 1 ? `&page=${page}` : ''}`;
      const data = await espnFetch(url);
      all.push(...(data.events || []).map(parseEvent));
      totalPages = data.pageCount || 1;
      page++;
    } while (page <= totalPages && page <= 5);

    all.sort((a, b) => new Date(a.date) - new Date(b.date));
    const today  = todayStr();
    const isLive = all.some(m => m.status === 'in');
    const ttl    = isLive ? 60 : date === today ? 300 : 2592000;
    await kvPut(env, kvKey, all, ttl);
    return all;
  } catch {
    return (await kvGet(env, kvKey)) || [];
  }
}

async function handleLeagueInfo(url, env) {
  const matchId = url.searchParams.get('matchId');
  if (!matchId) return jsonResp({ error: 'matchId required' }, 400);

  const kvKey  = `league-info:${matchId}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return jsonResp(cached);

  try {
    const data   = await espnFetch(`${ESPN_SUMMARY}?event=${matchId}`);
    const league = data.header?.league || {};
    const result = {
      name:         league.name         || '',
      slug:         league.slug         || '',
      abbreviation: league.abbreviation || '',
    };
    await kvPut(env, kvKey, result, 60 * 60 * 24 * 365);
    return jsonResp(result);
  } catch (e) {
    return jsonResp({ name: '', slug: '', error: e.message }, 200);
  }
}

async function handleMatches(url, env) {
  const date    = url.searchParams.get('date') || todayStr();
  const force   = url.searchParams.get('force') === 'true';
  const matches = await fetchMatches(date, env, force);
  return jsonResp({ success: true, date, count: matches.length, matches });
}

async function handleSummary(url, env) {
  const matchId = url.searchParams.get('matchId');
  const slug    = url.searchParams.get('league') || '';
  if (!matchId) return jsonResp({ error: 'matchId required' }, 400);

  const kvKey  = `summary:${matchId}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return jsonResp({ success: true, ...cached });

  try {
    const apiUrl = slug
      ? `${ESPN_LEAGUE}/${slug}/summary?event=${matchId}`
      : `${ESPN_SUMMARY}?event=${matchId}`;

    const raw  = await espnFetch(apiUrl);
    const hdr  = raw.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const st   = comp.status?.type || {};

    const goals = (raw.scoringPlays || []).map(g => ({
      minute: g.clock?.displayValue || '',
      player: g.athlete?.displayName || '',
      team:   g.team?.displayName || '',
      type:   g.scoringPlay?.type?.text || '',
    }));

    const homeStats = (raw.teamStats?.[0]?.statistics || []).map(s => ({ name: s.label, value: s.displayValue }));
    const awayStats = (raw.teamStats?.[1]?.statistics || []).map(s => ({ name: s.label, value: s.displayValue }));

    const result = {
      id: matchId, league: slug,
      leagueName: hdr.league?.name || '',
      date: comp.date,
      homeTeam:  home.team?.displayName || '', homeLogo: home.team?.logos?.[0]?.href || '',
      homeScore: home.score || '0',
      awayTeam:  away.team?.displayName || '', awayLogo: away.team?.logos?.[0]?.href || '',
      awayScore: away.score || '0',
      status: st.state || 'post', statusText: st.shortDetail || '',
      minute: comp.status?.displayClock || '',
      venue:  comp.venue?.fullName || '',
      goals, homeStats, awayStats,
    };

    await kvPut(env, kvKey, result, st.state === 'in' ? 30 : 3600);
    return jsonResp({ success: true, ...result });
  } catch (e) {
    return jsonResp({ error: e.message }, 404);
  }
}

async function handleStandings(url, env) {
  const league = url.searchParams.get('league');
  const season = url.searchParams.get('season') || '';
  if (!league) return jsonResp({ error: 'league required' }, 400);

  const kvKey  = `standings:${league}:${season}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return jsonResp({ success: true, ...cached });

  try {
    const apiUrl = season
      ? `${ESPN_STAND}/${league}/standings?season=${season}`
      : `${ESPN_STAND}/${league}/standings`;
    const data = await espnFetch(apiUrl);

    const leagueName = data.abbreviation || data.name || league;
    const seasonYear = data.season?.year || season;
    const children   = data.children || [data];
    const isGrouped  = children.length > 1;

    if (isGrouped) {
      const groups = children.map(g => ({
        name:    g.name || g.abbreviation || '',
        entries: (g.standings?.entries || []).map(parseStandingEntry),
      }));
      const result = { leagueName, season: seasonYear, isGrouped: true, groups };
      await kvPut(env, kvKey, result, 3600);
      return jsonResp({ success: true, ...result });
    }

    const entries = (children[0].standings?.entries || []).map(parseStandingEntry);
    const result  = { leagueName, season: seasonYear, isGrouped: false, entries };
    await kvPut(env, kvKey, result, 3600);
    return jsonResp({ success: true, ...result });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

function parseStandingEntry(e) {
  const stats = s => e.stats?.find(x => x.name === s)?.displayValue || '0';
  const raw   = s => Number(e.stats?.find(x => x.name === s)?.value  || 0);
  return {
    rank:      e.stats?.find(x => x.name === 'rank')?.value || 0,
    team:      e.team?.displayName || '',
    logo:      e.team?.logos?.[0]?.href || '',
    gp:        stats('gamesPlayed'),
    w:         stats('wins'),
    d:         stats('ties'),
    l:         stats('losses'),
    gd:        raw('pointDifferential'),
    pts:       stats('points'),
    qualColor: e.stats?.find(x => x.name === 'rank')?.summary || '',
    qualLabel: '',
  };
}

async function handleScorers(url, env) {
  const league = url.searchParams.get('league');
  const season = url.searchParams.get('season') || '';
  if (!league) return jsonResp({ error: 'league required' }, 400);

  const kvKey  = `scorers:${league}:${season}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return jsonResp({ success: true, ...cached });

  try {
    const apiUrl = season
      ? `${ESPN_LEAGUE}/${league}/scorers?season=${season}`
      : `${ESPN_LEAGUE}/${league}/scorers`;
    const data = await espnFetch(apiUrl);

    const scorers = (data.leaders || []).map((p, i) => ({
      rank:     i + 1,
      name:     p.athlete?.displayName || '',
      photo:    p.athlete?.headshot?.href || '',
      team:     p.team?.displayName || '',
      teamLogo: p.team?.logos?.[0]?.href || '',
      goals:    p.value || 0,
    }));

    const result = { leagueName: league, season: data.season?.year || season, scorers };
    await kvPut(env, kvKey, result, 3600);
    return jsonResp({ success: true, ...result });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

async function handleFixtures(env) {
  const kvKey  = `fixtures:${todayStr()}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return jsonResp({ success: true, ...cached });

  const today = new Date();
  let all = [], daysChecked = 0;

  while (all.length < 30 && daysChecked < 14) {
    daysChecked++;
    const d = new Date(today);
    d.setDate(today.getDate() + daysChecked);
    const ds = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    try {
      const matches = await fetchMatches(ds, env);
      all.push(...matches.filter(m => m.status === 'pre'));
    } catch {}
  }

  const result = { matches: all.slice(0, 50), fetchedDays: daysChecked };
  await kvPut(env, kvKey, result, 1800);
  return jsonResp({ success: true, ...result });
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url  = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/ping')            return new Response('pong', { headers: CORS });
      if (path === '/api/matches')     return handleMatches(url, env);
      if (path === '/api/league-info') return handleLeagueInfo(url, env);
      if (path === '/api/summary')     return handleSummary(url, env);
      if (path === '/api/standings')   return handleStandings(url, env);
      if (path === '/api/scorers')     return handleScorers(url, env);
      if (path === '/api/fixtures')    return handleFixtures(env);
      return jsonResp({ error: 'Not Found' }, 404);
    } catch (e) {
      return jsonResp({ error: e.message }, 500);
    }
  },
};
