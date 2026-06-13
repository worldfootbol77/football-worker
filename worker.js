// ═══════════════════════════════════════════════════════════════════════════════
// Football Worker — Cloudflare Workers (النسخة النهائية التي تعمل)
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── قاموس الـ league_id (مصغر ولكن كافٍ للاختبار) ────────────────────────────
const LEAGUE_ID_MAP = {
  '606': '🌍 كأس العالم 2026',
  '775': '🏆 دوري أبطال أوروبا',
  '700': '🏴󠁧󠁢󠁥󠁮󠁧󠁿 الدوري الإنجليزي',
};

// ─── دالة تحسين اسم الدوري ────────────────────────────────────────────────────
function getBetterLeagueName(event) {
  // استخراج league_id من uid
  const uid = event.uid || '';
  const leagueId = uid.match(/l:(\d+)/)?.[1];
  
  // إذا وجدنا league_id في القاموس
  if (leagueId && LEAGUE_ID_MAP[leagueId]) {
    let name = LEAGUE_ID_MAP[leagueId];
    // أضف المرحلة إذا كانت group-stage
    if (event.season?.slug === 'group-stage') {
      name = name + ' - دور المجموعات';
    }
    return name;
  }
  
  // إذا لم نجد، استخدم الاسم الأصلي
  let name = event.league?.displayName || event.season?.displayName || '';
  if (name && !name.includes(' at ')) {
    return name;
  }
  
  // تنظيف الاسم من "at"
  if (name.includes(' at ')) {
    const parts = name.split(' at ');
    return parts[0] || name;
  }
  
  return '⚽ مباراة';
}

function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
  const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
  const status = ev.status?.type || {};

  return {
    id: ev.id,
    league: ev.season?.slug || ev.league?.slug || '',
    leagueName: getBetterLeagueName(ev),
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
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

async function handleMatches(url) {
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
      return await handleMatches(url);
    }
    
    return new Response('Not Found', { status: 404, headers: CORS });
  }
};
