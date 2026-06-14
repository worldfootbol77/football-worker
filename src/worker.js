// ═══════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers
// الاكتشاف الديناميكي لأسماء البطولات عبر all/summary + KV Cache
// ═══════════════════════════════════════════════════════════════════════════

const ESPN_ALL     = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── القاموس الثابت (للدوريات المعروفة — يتجنب API calls إضافية) ──────────
const STATIC_LEAGUE_MAP = {
  '606':   { name: 'كأس العالم FIFA',                    flag: '🌍', slug: 'fifa.world'              },
  '786':   { name: 'تصفيات كأس العالم (أوروبا)',          flag: '🌍', slug: 'fifa.worldq.uefa'        },
  '787':   { name: 'تصفيات كأس العالم (أمريكا الجنوبية)', flag: '🌍', slug: 'fifa.worldq.conmebol'   },
  '788':   { name: 'تصفيات كأس العالم (كونكاكاف)',        flag: '🌍', slug: 'fifa.worldq.concacaf'   },
  '789':   { name: 'تصفيات كأس العالم (آسيا)',            flag: '🌍', slug: 'fifa.worldq.afc'         },
  '790':   { name: 'تصفيات كأس العالم (أفريقيا)',         flag: '🌍', slug: 'fifa.worldq.caf'         },
  '781':   { name: 'بطولة أمم أوروبا',                   flag: '🇪🇺', slug: 'uefa.euro'               },
  '3908':  { name: 'كأس أمم أفريقيا',                   flag: '🌍', slug: 'caf.nations'             },
  '4004':  { name: 'كأس الكونكاكاف الذهبية',             flag: '🌎', slug: 'concacaf.gold'           },
  '11088': { name: 'دوري الأمم الأوروبية',               flag: '🇪🇺', slug: 'uefa.nations'            },
  '775':   { name: 'دوري أبطال أوروبا',                 flag: '⭐', slug: 'uefa.champions'          },
  '776':   { name: 'الدوري الأوروبي',                   flag: '🟠', slug: 'uefa.europa'             },
  '783':   { name: 'كوبا ليبرتادوريس',                  flag: '🌎', slug: 'conmebol.libertadores'   },
  '5454':  { name: 'كوبا سوداميريكانا',                 flag: '🌎', slug: 'conmebol.sudamericana'   },
  '3902':  { name: 'دوري أبطال آسيا',                   flag: '🌏', slug: 'afc.champions'            },
  '5661':  { name: 'دوري أبطال آسيا 2',                 flag: '🌏', slug: 'afc.cup'                 },
  '2391':  { name: 'دوري أبطال أفريقيا',                flag: '🌍', slug: 'caf.champions'           },
  '700':   { name: 'الدوري الإنجليزي الممتاز',           flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', slug: 'eng.1'                  },
  '740':   { name: 'الدوري الإسباني',                   flag: '🇪🇸', slug: 'esp.1'                  },
  '720':   { name: 'الدوري الألماني',                   flag: '🇩🇪', slug: 'ger.1'                  },
  '730':   { name: 'الدوري الإيطالي',                   flag: '🇮🇹', slug: 'ita.1'                  },
  '710':   { name: 'الدوري الفرنسي',                    flag: '🇫🇷', slug: 'fra.1'                  },
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
  '630':   { name: 'الدوري البرازيلي',                  flag: '🇧🇷', slug: 'bra.1'                  },
  '745':   { name: 'الدوري الأرجنتيني',                 flag: '🇦🇷', slug: 'arg.1'                  },
  '760':   { name: 'الدوري المكسيكي',                   flag: '🇲🇽', slug: 'mex.1'                  },
  '770':   { name: 'MLS',                              flag: '🇺🇸', slug: 'usa.1'                  },
  '650':   { name: 'الدوري الكولومبي',                  flag: '🇨🇴', slug: 'col.1'                  },
  '640':   { name: 'الدوري التشيلي',                    flag: '🇨🇱', slug: 'chi.1'                  },
  '660':   { name: 'الدوري الإكوادوري',                 flag: '🇪🇨', slug: 'ecu.1'                  },
  '670':   { name: 'الدوري البيروفي',                   flag: '🇵🇪', slug: 'per.1'                  },
  '620':   { name: 'الدوري البوليفي',                   flag: '🇧🇴', slug: 'bol.1'                  },
  '21231': { name: 'دوري روشن السعودي',                 flag: '🇸🇦', slug: 'ksa.1'                  },
  '750':   { name: 'الدوري الياباني J1',                flag: '🇯🇵', slug: 'jpn.1'                  },
  '8376':  { name: 'الدوري الصيني',                     flag: '🇨🇳', slug: 'chn.1'                  },
  '3906':  { name: 'الدوري الأسترالي',                  flag: '🇦🇺', slug: 'aus.1'                  },
  '8316':  { name: 'الدوري الهندي',                     flag: '🇮🇳', slug: 'ind.1'                  },
};

// ─── ترجمة المراحل ────────────────────────────────────────────────────────
const STAGE_NAMES = {
  'group-stage':    'دور المجموعات',
  'regular-season': 'الدوري',
  'knockout-round': 'دور خروج المغلوب',
  'quarterfinals':  'ربع النهائي',
  'semifinals':     'نصف النهائي',
  'final':          'النهائي',
  'finals':         'النهائي',
  'round-of-16':    'دور الـ16',
  'round-of-32':    'دور الـ32',
  'play-in':        'الملحق',
  'playoffs':       'الإقصائيات',
  '3rd-place-match':'مباراة المركز الثالث',
  'first-stage':    'الدور الأول',
  'second-stage':   'الدور الثاني',
  'semifinal':      'نصف النهائي',
  'quarter-final':  'ربع النهائي',
};

// ─── أعلام الدول تلقائياً من اسم الدوري الإنجليزي ──────────────────────────
const NAME_TO_FLAG = {
  'Premier League': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'LaLiga': '🇪🇸', 'La Liga': '🇪🇸',
  'Bundesliga': '🇩🇪', 'Serie A': '🇮🇹', 'Ligue 1': '🇫🇷',
  'Primeira Liga': '🇵🇹', 'Eredivisie': '🇳🇱', 'Super Lig': '🇹🇷',
  'Scottish Premiership': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Pro League': '🇧🇪',
  'Super League': '🇬🇷', 'Premier League Russia': '🇷🇺',
  'J.League': '🇯🇵', 'Chinese Super League': '🇨🇳',
  'A-League': '🇦🇺', 'Indian Super League': '🇮🇳',
  'Saudi Pro League': '🇸🇦', 'MLS': '🇺🇸',
  'Liga MX': '🇲🇽', 'Serie A Brasil': '🇧🇷', 'Brasileirao': '🇧🇷',
  'Liga Profesional': '🇦🇷', 'Primera A': '🇨🇴',
  'LigaPro': '🇪🇨', 'Liga 1': '🇵🇪', 'Liga Boliviana': '🇧🇴',
  'Primera Division': '🇨🇱', 'Allsvenskan': '🇸🇪',
  'Eliteserien': '🇳🇴', 'Superliga': '🇩🇰',
  'Champions League': '⭐', 'Europa League': '🟠',
  'World Cup': '🌍', 'Copa': '🌎', 'Nations': '🇪🇺',
  'AFCON': '🌍', 'Africa Cup': '🌍', 'Gold Cup': '🌎',
  'AFC Champions': '🌏', 'CAF Champions': '🌍',
};

function guessFlag(leagueName) {
  if (!leagueName) return '⚽';
  for (const [keyword, flag] of Object.entries(NAME_TO_FLAG)) {
    if (leagueName.includes(keyword)) return flag;
  }
  return '⚽';
}

// ─── KV Helpers ──────────────────────────────────────────────────────────
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

// ─── الخطوة 1: استخراج leagueId من uid ──────────────────────────────────
function getLeagueId(event) {
  return event.uid?.match(/l:(\d+)/)?.[1] || '';
}

// ─── الخطوة 2: اكتشاف اسم الدوري ───────────────────────────────────────
// الترتيب: القاموس الثابت → KV Cache → all/summary API → fallback
async function resolveLeagueInfo(leagueId, sampleMatchId, env) {
  // أ) القاموس الثابت (أسرع، بدون API)
  if (STATIC_LEAGUE_MAP[leagueId]) {
    return STATIC_LEAGUE_MAP[leagueId];
  }

  // ب) KV Cache (دوريات اكتُشفت سابقاً)
  const kvKey = `league:${leagueId}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return cached;

  // ج) all/summary — الاكتشاف الديناميكي
  // يعمل بدون slug! يعطينا الاسم والـ slug مباشرة
  if (sampleMatchId) {
    try {
      const res = await fetch(`${ESPN_SUMMARY}?event=${sampleMatchId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (res.ok) {
        const data = await res.json();
        const league = data.header?.league || data.header?.competitions?.[0]?.league || {};
        const name   = league.name || league.displayName || '';
        const slug   = league.slug || '';
        if (name) {
          const info = {
            name: name,
            slug: slug,
            flag: guessFlag(name),
          };
          // تخزين دائم في KV (لا ينتهي) — هذا الدوري لن يتغير اسمه أبداً
          await kvPut(env, kvKey, info, 60 * 60 * 24 * 365);
          return info;
        }
      }
    } catch {}
  }

  // د) fallback — لم نجد أي شيء
  return { name: `بطولة`, slug: '', flag: '⚽' };
}

// ─── تحويل event → match object (المرحلة الأولى — بدون اسم الدوري) ──────
function parseEventBasic(ev) {
  const comp   = ev.competitions?.[0] || {};
  const home   = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away   = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};
  return {
    id:         ev.id,
    _leagueId:  getLeagueId(ev),           // مؤقت للمعالجة
    _stageSlug: ev.season?.slug || '',     // مؤقت للمعالجة
    _year:      ev.season?.year || '',     // مؤقت للمعالجة
    date:       ev.date,
    homeTeam:   home.team?.displayName || '',
    homeLogo:   home.team?.logos?.[0]?.href || '',
    homeScore:  home.score ?? '',
    awayTeam:   away.team?.displayName || '',
    awayLogo:   away.team?.logos?.[0]?.href || '',
    awayScore:  away.score ?? '',
    status:     status.state || 'pre',
    statusText: status.shortDetail || status.description || '',
    minute:     ev.status?.displayClock || '',
    venue:      comp.venue?.fullName || '',
    season:     ev.season?.year || '',
  };
}

// ─── جلب المباريات مع أسماء الدوريات ─────────────────────────────────────
async function fetchMatches(date, env, forceRefresh = false) {
  const kvKey = `matches:${date}`;
  if (!forceRefresh) {
    const cached = await kvGet(env, kvKey);
    if (cached) return cached;
  }

  // 1) جلب المباريات من all/scoreboard
  let rawMatches = [];
  try {
    let page = 1, totalPages = 1;
    do {
      const url  = `${ESPN_ALL}?dates=${date}&limit=500${page > 1 ? `&page=${page}` : ''}`;
      const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) break;
      const data = await res.json();
      rawMatches.push(...(data.events || []).map(parseEventBasic));
      totalPages = data.pageCount || 1;
      page++;
    } while (page <= totalPages && page <= 5);
  } catch {}

  if (!rawMatches.length) {
    return (await kvGet(env, kvKey)) || [];
  }

  // 2) تجميع المباريات حسب leagueId + اختيار مباراة نموذجية لكل دوري
  const leagueGroups = {};
  for (const m of rawMatches) {
    const lid = m._leagueId || 'other';
    if (!leagueGroups[lid]) leagueGroups[lid] = [];
    leagueGroups[lid].push(m);
  }

  // 3) اكتشاف أسماء الدوريات بالتوازي
  // الدوريات المعروفة → من القاموس (بدون API)
  // الدوريات المجهولة → all/summary call واحد لكل دوري
  const resolvePromises = Object.entries(leagueGroups).map(([lid, matches]) =>
    resolveLeagueInfo(lid, matches[0].id, env)
      .then(info => ({ lid, info }))
  );
  const resolved = await Promise.all(resolvePromises);

  // 4) بناء Map: leagueId → leagueInfo
  const leagueInfoMap = {};
  for (const { lid, info } of resolved) {
    leagueInfoMap[lid] = info;
  }

  // 5) إضافة معلومات الدوري لكل مباراة
  const allMatches = rawMatches.map(m => {
    const lid      = m._leagueId || 'other';
    const info     = leagueInfoMap[lid] || { name: 'بطولة', slug: '', flag: '⚽' };
    const stage    = STAGE_NAMES[m._stageSlug] || '';
    const year     = m._year || '';

    // بناء الاسم الكامل للعرض
    const leagueName = `${info.name}${year ? ' ' + year : ''}`;

    const { _leagueId, _stageSlug, _year, ...rest } = m;
    return {
      ...rest,
      leagueId:    lid,           // "606" → مفتاح التجميع الفريد
      league:      info.slug,     // "fifa.world" → للـ API
      leagueName,                 // "كأس العالم FIFA 2026"
      leagueFlag:  info.flag,     // "🌍"
      leagueStage: stage,         // "دور المجموعات"
    };
  });

  allMatches.sort((a, b) => new Date(a.date) - new Date(b.date));

  // 6) تخزين في KV
  const isLive = allMatches.some(m => m.status === 'in');
  const today  = todayStr();
  const ttl    = isLive ? 60 : date === today ? 300 : 2592000;
  await kvPut(env, kvKey, allMatches, ttl);

  return allMatches;
}

// ─── تفاصيل مباراة ────────────────────────────────────────────────────────
async function fetchSummary(matchId, leagueSlug) {
  const url = leagueSlug
    ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/summary?event=${matchId}`
    : `${ESPN_SUMMARY}?event=${matchId}`;
  try {
    const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const raw  = await res.json();
    const hdr  = raw.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const st   = comp.status?.type || {};
    return {
      id: matchId, league: leagueSlug,
      leagueName: hdr.league?.name || '',
      date: comp.date,
      homeTeam: home.team?.displayName || '', homeLogo: home.team?.logos?.[0]?.href || '',
      homeScore: home.score || '0',
      awayTeam: away.team?.displayName || '', awayLogo: away.team?.logos?.[0]?.href || '',
      awayScore: away.score || '0',
      status: st.state || 'post', statusText: st.shortDetail || '',
      minute: comp.status?.displayClock || '', venue: comp.venue?.fullName || '',
    };
  } catch { return null; }
}

// ─── Routing ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url  = new URL(request.url);
    const path = url.pathname;

    if (path === '/ping') return new Response('pong', { headers: CORS });

    if (path === '/api/matches') {
      const date    = url.searchParams.get('date') || todayStr();
      const force   = url.searchParams.get('force') === 'true';
      const matches = await fetchMatches(date, env, force);
      return new Response(
        JSON.stringify({ success: true, date, count: matches.length, matches }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    if (path === '/api/summary') {
      const matchId    = url.searchParams.get('matchId');
      const leagueSlug = url.searchParams.get('league') || '';
      const summary    = await fetchSummary(matchId, leagueSlug);
      if (!summary) return new Response(
        JSON.stringify({ error: 'not found' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
      return new Response(
        JSON.stringify({ success: true, ...summary }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not Found', { status: 404, headers: CORS });
  },
};
