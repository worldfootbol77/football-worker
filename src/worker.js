// ═══════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers
// الإصلاحات: leagueId من uid كمفتاح تجميع، league كـ slug للـ API
// ═══════════════════════════════════════════════════════════════════════════

const ESPN_ALL    = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── قاموس البطولات (uid → league info) ──────────────────────────────────
// المصدر: event.uid = "s:600~l:606~e:760416"  →  leagueId = "606"
// هذا هو الحل الوحيد: event.league / event.leagues = undefined في all/scoreboard
const LEAGUE_ID_MAP = {
  // ── كأس العالم والبطولات الدولية ──────────────────────────────────────
  '606':   { name: 'كأس العالم FIFA',                 flag: '🌍', slug: 'fifa.world'              },
  '786':   { name: 'تصفيات كأس العالم (أوروبا)',        flag: '🌍', slug: 'fifa.worldq.uefa'        },
  '787':   { name: 'تصفيات كأس العالم (أمريكا الجنوبية)', flag: '🌍', slug: 'fifa.worldq.conmebol'  },
  '788':   { name: 'تصفيات كأس العالم (كونكاكاف)',      flag: '🌍', slug: 'fifa.worldq.concacaf'   },
  '789':   { name: 'تصفيات كأس العالم (آسيا)',          flag: '🌍', slug: 'fifa.worldq.afc'         },
  '790':   { name: 'تصفيات كأس العالم (أفريقيا)',       flag: '🌍', slug: 'fifa.worldq.caf'         },
  '781':   { name: 'بطولة أمم أوروبا',                 flag: '🇪🇺', slug: 'uefa.euro'               },
  '3908':  { name: 'كأس أمم أفريقيا',                 flag: '🌍', slug: 'caf.nations'             },
  '4004':  { name: 'كأس الكونكاكاف الذهبية',           flag: '🌎', slug: 'concacaf.gold'           },
  '11088': { name: 'دوري الأمم الأوروبية',             flag: '🇪🇺', slug: 'uefa.nations'            },
  // ── بطولات قارية للأندية ──────────────────────────────────────────────
  '775':   { name: 'دوري أبطال أوروبا',               flag: '⭐', slug: 'uefa.champions'          },
  '776':   { name: 'الدوري الأوروبي',                 flag: '🟠', slug: 'uefa.europa'             },
  '783':   { name: 'كوبا ليبرتادوريس',                flag: '🌎', slug: 'conmebol.libertadores'   },
  '5454':  { name: 'كوبا سوداميريكانا',               flag: '🌎', slug: 'conmebol.sudamericana'   },
  '3902':  { name: 'دوري أبطال آسيا',                 flag: '🌏', slug: 'afc.champions'            },
  '5661':  { name: 'دوري أبطال آسيا 2',               flag: '🌏', slug: 'afc.cup'                 },
  '2391':  { name: 'دوري أبطال أفريقيا',              flag: '🌍', slug: 'caf.champions'           },
  // ── الدوريات الأوروبية الكبرى ──────────────────────────────────────────
  '700':   { name: 'الدوري الإنجليزي الممتاز',          flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', slug: 'eng.1'                 },
  '740':   { name: 'الدوري الإسباني',                  flag: '🇪🇸', slug: 'esp.1'                 },
  '720':   { name: 'الدوري الألماني',                  flag: '🇩🇪', slug: 'ger.1'                 },
  '730':   { name: 'الدوري الإيطالي',                  flag: '🇮🇹', slug: 'ita.1'                 },
  '710':   { name: 'الدوري الفرنسي',                   flag: '🇫🇷', slug: 'fra.1'                 },
  '715':   { name: 'الدوري البرتغالي',                 flag: '🇵🇹', slug: 'por.1'                 },
  '725':   { name: 'الدوري الهولندي',                  flag: '🇳🇱', slug: 'ned.1'                 },
  '3946':  { name: 'الدوري التركي',                    flag: '🇹🇷', slug: 'tur.1'                 },
  '735':   { name: 'الدوري الاسكتلندي',                flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', slug: 'sco.1'                 },
  '3901':  { name: 'الدوري البلجيكي',                  flag: '🇧🇪', slug: 'bel.1'                 },
  '3955':  { name: 'الدوري اليوناني',                  flag: '🇬🇷', slug: 'gre.1'                 },
  '3939':  { name: 'الدوري الروسي',                    flag: '🇷🇺', slug: 'rus.1'                 },
  '3907':  { name: 'الدوري النمساوي',                  flag: '🇦🇹', slug: 'aut.1'                 },
  '3913':  { name: 'الدوري الدنماركي',                 flag: '🇩🇰', slug: 'den.1'                 },
  '3960':  { name: 'الدوري النرويجي',                  flag: '🇳🇴', slug: 'nor.1'                 },
  '3945':  { name: 'الدوري السويدي',                   flag: '🇸🇪', slug: 'swe.1'                 },
  // ── دوريات الأمريكتين ──────────────────────────────────────────────────
  '630':   { name: 'الدوري البرازيلي',                 flag: '🇧🇷', slug: 'bra.1'                 },
  '745':   { name: 'الدوري الأرجنتيني',                flag: '🇦🇷', slug: 'arg.1'                 },
  '760':   { name: 'الدوري المكسيكي',                  flag: '🇲🇽', slug: 'mex.1'                 },
  '770':   { name: 'MLS',                             flag: '🇺🇸', slug: 'usa.1'                 },
  '650':   { name: 'الدوري الكولومبي',                 flag: '🇨🇴', slug: 'col.1'                 },
  '640':   { name: 'الدوري التشيلي',                   flag: '🇨🇱', slug: 'chi.1'                 },
  '660':   { name: 'الدوري الإكوادوري',                flag: '🇪🇨', slug: 'ecu.1'                 },
  '670':   { name: 'الدوري البيروفي',                  flag: '🇵🇪', slug: 'per.1'                 },
  '620':   { name: 'الدوري البوليفي',                  flag: '🇧🇴', slug: 'bol.1'                 },
  // ── دوريات آسيا والخليج ────────────────────────────────────────────────
  '21231': { name: 'دوري روشن السعودي',                flag: '🇸🇦', slug: 'ksa.1'                 },
  '750':   { name: 'الدوري الياباني J1',               flag: '🇯🇵', slug: 'jpn.1'                 },
  '8376':  { name: 'الدوري الصيني',                    flag: '🇨🇳', slug: 'chn.1'                 },
  '3906':  { name: 'الدوري الأسترالي',                 flag: '🇦🇺', slug: 'aus.1'                 },
  '8316':  { name: 'الدوري الهندي',                    flag: '🇮🇳', slug: 'ind.1'                 },
  // ── دوريات أوروبية إضافية ──────────────────────────────────────────────
  '3930':  { name: 'الدوري الأيرلندي',                 flag: '🇮🇪', slug: 'irl.1'                 },
  '3904':  { name: 'الدوري الأرجنتيني (الدرجة الثانية)', flag: '🇦🇷', slug: 'arg.2'               },
  '4003':  { name: 'الدوري الأرجنتيني الاحترافي',       flag: '🇦🇷', slug: 'arg.plenamente'        },
  '4007':  { name: 'الدوري البرازيلي الدرجة الثانية',   flag: '🇧🇷', slug: 'bra.2'                 },
};

// ─── ترجمة المراحل ───────────────────────────────────────────────────────
const STAGE_NAMES = {
  'group-stage':    'دور المجموعات',
  'regular-season': 'الدوري',
  'knockout-round': 'دور خروج المغلوب',
  'quarterfinals':  'ربع النهائي',
  'semifinals':     'نصف النهائي',
  'final':          'النهائي',
  'round-of-16':    'دور الـ16',
  'round-of-32':    'دور الـ32',
  'play-in':        'الملحق',
  'playoffs':       'الإقصائيات',
};

// ─── KV Helpers ──────────────────────────────────────────────────────────
async function kvGet(env, key) {
  if (!env?.FOOTBALL_KV) return null;
  try { return await env.FOOTBALL_KV.get(key, { type: 'json' }); }
  catch { return null; }
}

async function kvPut(env, key, value, ttl = 86400) {
  if (!env?.FOOTBALL_KV) return;
  try { await env.FOOTBALL_KV.put(key, JSON.stringify(value), { expirationTtl: ttl }); }
  catch {}
}

// ─── Date Helpers ─────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ─── استخراج معلومات البطولة من event.uid ─────────────────────────────────
// ✅ الحل الوحيد الموثوق — event.league / event.leagues = undefined دائماً
// ✅ leagueId = مفتاح فريد لكل بطولة (للتجميع في الفرونت)
// ✅ leagueSlug = slug للـ ESPN API (لجلب تفاصيل المباراة)
function extractLeagueInfo(event) {
  const uid      = event.uid || '';
  const leagueId = uid.match(/l:(\d+)/)?.[1] || '';
  const year     = event.season?.year || '';
  const stageSlug = event.season?.slug || '';
  const stage    = STAGE_NAMES[stageSlug] || '';

  // ── حالة 1: البطولة في قاموسنا ──────────────────────────────────────
  if (leagueId && LEAGUE_ID_MAP[leagueId]) {
    const info = LEAGUE_ID_MAP[leagueId];
    return {
      leagueId,
      leagueSlug:  info.slug,     // "fifa.world" — للـ API
      leagueName:  `${info.name}${year ? ' ' + year : ''}`,
      leagueFlag:  info.flag,
      leagueStage: stage,
    };
  }

  // ── حالة 2: بطولة مجهولة ─────────────────────────────────────────────
  // ⚠️ الخطأ الكلاسيكي: إرجاع 'unknown' ثابت يجمع كل البطولات المجهولة معاً
  // ✅ الإصلاح: نستخدم leagueId الحقيقي كمفتاح حتى لو مجهول
  return {
    leagueId:    leagueId || `other_${stageSlug}_${year}`,
    leagueSlug:  '',             // لا نعرف الـ slug → تفاصيل المباراة قد لا تعمل
    leagueName:  stage ? `بطولة ${year} - ${stage}` : `بطولة ${year || ''}`,
    leagueFlag:  '⚽',
    leagueStage: stage,
  };
}

// ─── تحويل ESPN Event → كائن مباراة ──────────────────────────────────────
function parseEvent(ev) {
  const comp   = ev.competitions?.[0] || {};
  const home   = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away   = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};
  const info   = extractLeagueInfo(ev);

  return {
    id:          ev.id,
    // ── حقلان مختلفان — لا تخلط بينهما ──────────────────────────────
    leagueId:    info.leagueId,    // "606"        → مفتاح التجميع في الفرونت
    league:      info.leagueSlug,  // "fifa.world" → للـ ESPN summary API
    // ── معلومات العرض ─────────────────────────────────────────────────
    leagueName:  info.leagueName,   // "كأس العالم FIFA 2026"
    leagueFlag:  info.leagueFlag,   // "🌍"
    leagueStage: info.leagueStage,  // "دور المجموعات"
    // ── بيانات المباراة ───────────────────────────────────────────────
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
    season:      ev.season?.year || '',
  };
}

// ─── جلب المباريات من ESPN ────────────────────────────────────────────────
async function fetchMatches(date, env, forceRefresh = false) {
  const kvKey = `matches:${date}`;

  if (!forceRefresh) {
    const cached = await kvGet(env, kvKey);
    if (cached) return cached;
  }

  try {
    let allMatches = [];
    let page = 1, totalPages = 1;

    do {
      const url = `${ESPN_ALL}?dates=${date}&limit=500${page > 1 ? `&page=${page}` : ''}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) break;
      const data = await res.json();
      allMatches.push(...(data.events || []).map(parseEvent));
      totalPages = data.pageCount || 1;
      page++;
    } while (page <= totalPages && page <= 5);

    allMatches.sort((a, b) => new Date(a.date) - new Date(b.date));

    const today  = todayStr();
    const isLive = allMatches.some(m => m.status === 'in');
    const ttl    = isLive ? 60 : date === today ? 300 : 2592000;
    await kvPut(env, kvKey, allMatches, ttl);

    return allMatches;
  } catch (e) {
    return (await kvGet(env, kvKey)) || [];
  }
}

// ─── جلب تفاصيل مباراة ────────────────────────────────────────────────────
async function fetchSummary(matchId, leagueSlug, env) {
  if (!matchId || !leagueSlug) return null;
  try {
    const url  = `${ESPN_LEAGUE}/${leagueSlug}/summary?event=${matchId}`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const raw  = await res.json();
    const hdr  = raw.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const st   = comp.status?.type || {};
    return {
      id:          matchId,
      league:      leagueSlug,
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
    };
  } catch { return null; }
}

// ─── Routing ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // GET /ping
    if (path === '/ping') {
      return new Response('pong', { headers: CORS });
    }

    // GET /api/matches?date=YYYYMMDD&force=true
    if (path === '/api/matches') {
      const date         = url.searchParams.get('date') || todayStr();
      const forceRefresh = url.searchParams.get('force') === 'true';
      const matches      = await fetchMatches(date, env, forceRefresh);
      return new Response(
        JSON.stringify({ success: true, date, count: matches.length, matches }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api/summary?matchId=XXX&league=fifa.world
    if (path === '/api/summary') {
      const matchId     = url.searchParams.get('matchId');
      const leagueSlug  = url.searchParams.get('league');
      const summary     = await fetchSummary(matchId, leagueSlug, env);
      if (!summary) {
        return new Response(
          JSON.stringify({ error: 'تعذّر جلب تفاصيل المباراة' }),
          { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, ...summary }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not Found', { status: 404, headers: CORS });
  },
};
