// ═══════════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── قاموس الـ league_id الكامل ──────────────────────────────────────────────
const LEAGUE_ID_MAP = {
  // كأس العالم والبطولات الدولية
  '606':   { name: 'كأس العالم', flag: '🌍', slug: 'fifa.world' },
  '786':   { name: 'تصفيات كأس العالم - أوروبا', flag: '🌍', slug: 'fifa.worldq.uefa' },
  '787':   { name: 'تصفيات كأس العالم - أمريكا الجنوبية', flag: '🌍', slug: 'fifa.worldq.conmebol' },
  '788':   { name: 'تصفيات كأس العالم - أمريكا الشمالية', flag: '🌍', slug: 'fifa.worldq.concacaf' },
  '789':   { name: 'تصفيات كأس العالم - آسيا', flag: '🌍', slug: 'fifa.worldq.afc' },
  '790':   { name: 'تصفيات كأس العالم - أفريقيا', flag: '🌍', slug: 'fifa.worldq.caf' },
  '781':   { name: 'بطولة أمم أوروبا', flag: '🇪🇺', slug: 'uefa.euro' },
  '3908':  { name: 'كأس أمم أفريقيا', flag: '🌍', slug: 'caf.nations' },
  '4004':  { name: 'كأس الكونكاكاف الذهبية', flag: '🌎', slug: 'concacaf.gold' },
  '11088': { name: 'دوري الأمم الأوروبية', flag: '🇪🇺', slug: 'uefa.nations' },
  
  // بطولات قارية للأندية
  '775':   { name: 'دوري أبطال أوروبا', flag: '🇪🇺', slug: 'uefa.champions' },
  '776':   { name: 'الدوري الأوروبي', flag: '🇪🇺', slug: 'uefa.europa' },
  '783':   { name: 'كوبا ليبرتادوريس', flag: '🌎', slug: 'conmebol.libertadores' },
  '5454':  { name: 'كوبا سوداميريكانا', flag: '🌎', slug: 'conmebol.sudamericana' },
  '3902':  { name: 'دوري أبطال آسيا', flag: '🌏', slug: 'afc.champions' },
  '2391':  { name: 'دوري أبطال أفريقيا', flag: '🌍', slug: 'caf.champions' },
  
  // الدوريات الأوروبية الكبرى
  '700':   { name: 'الدوري الإنجليزي', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', slug: 'eng.1' },
  '740':   { name: 'الدوري الإسباني', flag: '🇪🇸', slug: 'esp.1' },
  '720':   { name: 'الدوري الألماني', flag: '🇩🇪', slug: 'ger.1' },
  '730':   { name: 'الدوري الإيطالي', flag: '🇮🇹', slug: 'ita.1' },
  '710':   { name: 'الدوري الفرنسي', flag: '🇫🇷', slug: 'fra.1' },
  '715':   { name: 'الدوري البرتغالي', flag: '🇵🇹', slug: 'por.1' },
  '725':   { name: 'الدوري الهولندي', flag: '🇳🇱', slug: 'ned.1' },
  '3946':  { name: 'الدوري التركي', flag: '🇹🇷', slug: 'tur.1' },
  '735':   { name: 'الدوري الاسكتلندي', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', slug: 'sco.1' },
  '3901':  { name: 'الدوري البلجيكي', flag: '🇧🇪', slug: 'bel.1' },
  '3955':  { name: 'الدوري اليوناني', flag: '🇬🇷', slug: 'gre.1' },
  '3939':  { name: 'الدوري الروسي', flag: '🇷🇺', slug: 'rus.1' },
  '3907':  { name: 'الدوري النمساوي', flag: '🇦🇹', slug: 'aut.1' },
  '3913':  { name: 'الدوري الدنماركي', flag: '🇩🇰', slug: 'den.1' },
  '3960':  { name: 'الدوري النرويجي', flag: '🇳🇴', slug: 'nor.1' },
  '3945':  { name: 'الدوري السويدي', flag: '🇸🇪', slug: 'swe.1' },
  '3930':  { name: 'الدوري الأيرلندي', flag: '🇮🇪', slug: 'irl.1' },
  
  // دوريات أمريكا الجنوبية
  '630':   { name: 'الدوري البرازيلي', flag: '🇧🇷', slug: 'bra.1' },
  '745':   { name: 'الدوري الأرجنتيني', flag: '🇦🇷', slug: 'arg.1' },
  '760':   { name: 'الدوري المكسيكي', flag: '🇲🇽', slug: 'mex.1' },
  '770':   { name: 'MLS', flag: '🇺🇸', slug: 'usa.1' },
  '650':   { name: 'الدوري الكولومبي', flag: '🇨🇴', slug: 'col.1' },
  '640':   { name: 'الدوري التشيلي', flag: '🇨🇱', slug: 'chi.1' },
  '660':   { name: 'الدوري الإكوادوري', flag: '🇪🇨', slug: 'ecu.1' },
  '670':   { name: 'الدوري البيروفي', flag: '🇵🇪', slug: 'per.1' },
  
  // دوريات آسيا والخليج
  '21231': { name: 'الدوري السعودي', flag: '🇸🇦', slug: 'ksa.1' },
  '750':   { name: 'الدوري الياباني', flag: '🇯🇵', slug: 'jpn.1' },
  '8376':  { name: 'الدوري الصيني', flag: '🇨🇳', slug: 'chn.1' },
  '3906':  { name: 'الدوري الأسترالي', flag: '🇦🇺', slug: 'aus.1' },
  '8316':  { name: 'الدوري الهندي', flag: '🇮🇳', slug: 'ind.1' },
};

// ─── قاموس المراحل ───────────────────────────────────────────────────────────
const STAGE_NAMES = {
  'group-stage':    'دور المجموعات',
  'regular-season': 'الدوري',
  'knockout-round': 'دور خروج المغلوب',
  'quarterfinals':  'ربع النهائي',
  'semifinals':     'نصف النهائي',
  'final':          'النهائي',
  'round-of-16':    'دور الـ 16',
  'round-of-32':    'دور الـ 32',
  'play-in':        'الملحق',
};

// ─── دالة الحصول على معلومات البطولة ─────────────────────────────────────────
function getLeagueInfo(event) {
  const uid = event.uid || '';
  const leagueId = uid.match(/l:(\d+)/)?.[1] || '';
  const stage = STAGE_NAMES[event.season?.slug] || '';
  const year = event.season?.year || '';
  
  if (leagueId && LEAGUE_ID_MAP[leagueId]) {
    const info = LEAGUE_ID_MAP[leagueId];
    return {
      leagueId: leagueId,
      leagueSlug: info.slug,
      leagueName: `${info.flag} ${info.name}${year ? ' ' + year : ''}${stage ? ' - ' + stage : ''}`,
      leagueFlag: info.flag,
      leagueStage: stage,
    };
  }
  
  // ✅ مفتاح فريد لكل دوري غير معروف (لا تجمعها كلها)
  const uniqueId = leagueId || `s_${event.season?.slug}_${year}`;
  return {
    leagueId: uniqueId,
    leagueSlug: '',
    leagueName: stage ? `⚽ بطولة ${year} - ${stage}` : `⚽ بطولة ${year}`,
    leagueFlag: '⚽',
    leagueStage: stage,
  };
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};
  const info = getLeagueInfo(ev);

  return {
    id: ev.id,
    leagueId: info.leagueId,       // "606" ← مفتاح التجميع الفريد
    league: info.leagueSlug,       // "fifa.world" ← للـ summary API
    leagueName: info.leagueName,   // "🌍 كأس العالم 2026 - دور المجموعات"
    leagueFlag: info.leagueFlag,
    leagueStage: info.leagueStage,
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
    season: ev.season?.year || '',
  };
}

async function handleMatches(url, env) {
  const date = url.searchParams.get('date') || todayStr();
  
  try {
    const espnUrl = `${ESPN_ALL}?dates=${date}&limit=500`;
    const res = await fetch(espnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const matches = (data.events || []).map(parseEvent);
    
    return new Response(JSON.stringify({ success: true, date, count: matches.length, matches }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
}

async function handleSummary(url, env) {
  const matchId = url.searchParams.get('matchId');
  const league = url.searchParams.get('league');
  if (!matchId) {
    return new Response(JSON.stringify({ error: 'matchId required' }), { status: 400, headers: CORS });
  }
  
  try {
    const espnUrl = `${ESPN_LEAGUE}/${league}/summary?event=${matchId}`;
    const res = await fetch(espnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    
    const hdr = data.header || {};
    const comp = hdr.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const status = comp.status?.type || {};
    
    const summary = {
      id: matchId,
      league: league,
      leagueName: hdr.league?.name || '',
      date: comp.date,
      homeTeam: home.team?.displayName || '',
      homeLogo: home.team?.logos?.[0]?.href || '',
      homeScore: home.score || '0',
      awayTeam: away.team?.displayName || '',
      awayLogo: away.team?.logos?.[0]?.href || '',
      awayScore: away.score || '0',
      status: status.state || 'post',
      statusText: status.shortDetail || '',
      minute: comp.status?.displayClock || '',
      venue: comp.venue?.fullName || '',
    };
    
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/ping') {
      return new Response('pong', { headers: CORS });
    }
    if (path === '/api/matches') {
      return await handleMatches(url, env);
    }
    if (path === '/api/summary') {
      return await handleSummary(url, env);
    }
    
    return new Response('Not Found', { status: 404, headers: CORS });
  }
};
