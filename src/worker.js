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

// ─── قاموس الـ league_id ─────────────────────────────────────────────────────
const LEAGUE_ID_MAP = {
  // كأس العالم
  '606': '🌍 كأس العالم',
  // دوري الأمم الأوروبية
  '668': '🏆 دوري الأمم الأوروبية',
  // دوري أبطال أوروبا
  '775': '🏆 دوري أبطال أوروبا',
  // الدوري الأوروبي
  '776': '🏆 الدوري الأوروبي',
  // كوبا ليبرتادوريس
  '783': '🏆 كوبا ليبرتادوريس',
  // الدوريات الأوروبية الكبرى
  '700': '🏴󠁧󠁢󠁥󠁮󠁧󠁿 الدوري الإنجليزي',
  '740': '🇪🇸 الدوري الإسباني',
  '720': '🇩🇪 الدوري الألماني',
  '730': '🇮🇹 الدوري الإيطالي',
  '710': '🇫🇷 الدوري الفرنسي',
  '725': '🇳🇱 الدوري الهولندي',
  '715': '🇵🇹 الدوري البرتغالي',
  '735': '🏴󠁧󠁢󠁳󠁣󠁴󠁿 الدوري الاسكتلندي',
  // دوريات أمريكا
  '630': '🇧🇷 الدوري البرازيلي',
  '745': '🇦🇷 الدوري الأرجنتيني',
  '760': '🇲🇽 الدوري المكسيكي',
  '770': '🇺🇸 MLS',
  // دوريات آسيا والخليج
  '21231': '🇸🇦 الدوري السعودي',
  '750': '🇯🇵 الدوري الياباني',
};

// ─── قاموس المراحل ───────────────────────────────────────────────────────────
const STAGE_NAMES = {
  'group-stage': 'دور المجموعات',
  'regular-season': 'الدوري',
  'final': 'النهائي',
  'quarter-final': 'ربع النهائي',
  'semi-final': 'نصف النهائي',
  'round-of-16': 'دور الـ 16',
  'round-of-32': 'دور الـ 32',
};

// ─── دالة الحصول على اسم البطولة ─────────────────────────────────────────────
function getLeagueName(event) {
  // استخراج league_id من uid
  const uid = event.uid || '';
  const leagueId = uid.match(/l:(\d+)/)?.[1];
  
  // إذا وجدنا league_id في القاموس
  if (leagueId && LEAGUE_ID_MAP[leagueId]) {
    let name = LEAGUE_ID_MAP[leagueId];
    const year = event.season?.year;
    if (year && !name.includes(year)) {
      name = `${name} ${year}`;
    }
    const stage = STAGE_NAMES[event.season?.slug];
    if (stage) {
      name = `${name} - ${stage}`;
    }
    return name;
  }
  
  // إذا لم نجد، نستخدم الاسم الأصلي
  let name = event.league?.displayName || event.season?.displayName || '';
  if (name && !name.includes(' at ') && !name.includes(' vs ')) {
    return name;
  }
  
  // تنظيف الاسم من "at"
  if (name.includes(' at ')) {
    const parts = name.split(' at ');
    if (parts[0]) return parts[0];
  }
  
  return event.league?.slug || event.season?.slug || '⚽ مباراة';
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

  return {
    id: ev.id,
    league: ev.league?.slug || ev.season?.slug || '',
    leagueName: getLeagueName(ev),
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
    
    // تبسيط البيانات
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
