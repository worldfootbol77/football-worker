// ═══════════════════════════════════════════════════════════════════════════════
// src/worker.js — النسخة النهائية المتكاملة (دعم شامل لجميع الدوريات والتأهل)
// ═══════════════════════════════════════════════════════════════════════════════

const ESPN_ALL    = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const ESPN_LEAGUE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// TTL بالثواني للكاش
const TTL_LIVE      = 60;    // مباراة مباشرة (دقيقة)
const TTL_MATCHES   = 300;   // مباريات اليوم (5 دقائق)
const TTL_SUMMARY   = 90;    // تفاصيل مباراة (90 ثانية)
const TTL_FINISHED  = 3600;  // مباريات منتهية (ساعة)
const TTL_STANDINGS = 21600; // الترتيب (6 ساعات)
const TTL_SCORERS   = 21600; // الهدافين (6 ساعات)

// ─── قاموس شامل لتحويل معرفات ESPN إلى أكواد الدوريات ──────────────────────
const ID_TO_CODE = {
  // إنجلترا
  "23": "eng.1", "24": "eng.2", "25": "eng.3", "26": "eng.4", "27": "eng.5",
  "28": "eng.league_cup", "29": "eng.fa", "30": "eng.community_shield",
  // إسبانيا
  "15": "esp.1", "16": "esp.2", "17": "esp.copa_del_rey",
  // إيطاليا
  "13": "ita.1", "14": "ita.2", "18": "ita.coppa",
  // ألمانيا
  "10": "ger.1", "11": "ger.2", "12": "ger.dfb_pokal",
  // فرنسا
  "9": "fra.1", "165": "fra.2", "167": "fra.coupe_de_france",
  // دوريات أوروبية أخرى
  "7": "ned.1", "19": "por.1", "5": "bel.1", "1": "sco.1", "4": "tur.1", "6": "gre.1",
  // البطولات القارية للأندية
  "2": "uefa.champions", "3": "uefa.europa", "2310": "uefa.europa.conf", "2311": "uefa.super_cup",
  "40": "conmebol.libertadores", "18318": "afc.champions", "19159": "caf.champions",
  // البطولات الدولية والقارية للمنتخبات
  "2010": "fifa.world", "2006": "uefa.euro", "2003": "conmebol.america", "2018": "caf.nations", "1997": "afc.asian_cup", "2007": "fifa.confed",
  // دوريات عربية وعالمية أخرى
  "93": "ksa.1", "1227": "uae.1", "1123": "egy.1", "1121": "mar.1", "1133": "tun.1", "1118": "alg.1", "1125": "qat.1",
  "341": "irn.1", "343": "irq.1", "19234": "rsf.1", "333": "jor.1", "334": "kuw.1", "332": "bhr.1", "335": "oma.1",
  "338": "syr.1", "337": "ple.1", "336": "leb.1", "1127": "sud.1", "1124": "lby.1", "1122": "mrt.1", "1134": "ye.1",
  "98": "usa.mls", "22": "arg.1", "21": "bra.1", "174": "mex.1"
};

// ─── قواعد الألوان للتأهل والهبوط ──────────────────────────────────────────────
const CONTINENTAL_RULES = {
  "eng.1": {
    1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    4: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    5: {color: "#89CFF0", desc: "الدوري الأوروبي"}
  },
  "esp.1": {
    1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    4: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    5: {color: "#89CFF0", desc: "الدوري الأوروبي"}
  },
  "ita.1": {
    1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    4: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    5: {color: "#89CFF0", desc: "الدوري الأوروبي"}
  },
  "ger.1": {
    1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    4: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    5: {color: "#89CFF0", desc: "الدوري الأوروبي"}
  },
  "fra.1": {
    1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
    4: {color: "#B2BFD0", desc: "تصفيات دوري أبطال أوروبا"},
    5: {color: "#89CFF0", desc: "الدوري الأوروبي"}
  },
  "uefa.euro": {
    1: {color: "#81D6AC", desc: "تأهل لدور الـ 16"},
    2: {color: "#81D6AC", desc: "تأهل لدور الـ 16"},
    3: {color: "#B2BFD0", desc: "أفضل ثوالث (تأهل محتمل)"}
  },
  "fifa.world": {
    1: {color: "#81D6AC", desc: "تأهل لدور الـ 16"},
    2: {color: "#81D6AC", desc: "تأهل لدور الـ 16"}
  }
};

// قواعد الهبوط العامة لآخر 3 فرق في الدوريات المحلية
const DEFAULT_RELEGATION = { color: "#F77B7B", desc: "هبوط" };

// دالة جلب كود الدوري بناءً على المعرف
function getLeagueCode(league) {
  if (!league) return 'all';
  return ID_TO_CODE[league] || league;
}

// دالة تحديد لون وقواعد الترتيب لقارة/هبوط
function getContinentalRule(leagueCode, position, totalTeams) {
  const rules = CONTINENTAL_RULES[leagueCode];
  if (rules && rules[position]) {
    return rules[position];
  }
  // التحقق من الهبوط (آخر 3 فرق في الدوريات المحلية الرئيسية)
  if (leagueCode.endsWith(".1") && position > totalTeams - 3) {
    return DEFAULT_RELEGATION;
  }
  return { color: "", desc: "" };
}

// ─── KV Cache Helpers ────────────────────────────────────────────────────────
async function kvGet(env, key) {
  try { return await env?.FOOTBALL_KV?.get(key, 'json'); } catch(_) { return null; }
}
async function kvPut(env, key, value, ttl) {
  try { await env?.FOOTBALL_KV?.put(key, JSON.stringify(value), { expirationTtl: ttl }); } catch(_) {}
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() +
         String(d.getMonth() + 1).padStart(2, '0') +
         String(d.getDate()).padStart(2, '0');
}

// ─── 1. معالجة المباريات (المباريات اليومية أو حسب البطولة) ─────────────────────
async function handleMatches(url, env) {
  const date   = url.searchParams.get('date') || todayStr();
  const league = url.searchParams.get('league') || 'all';
  const kvKey  = `matches_${league}_${date}`;

  const cached = await kvGet(env, kvKey);
  if (cached) return new Response(JSON.stringify(cached), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  let fetchUrl = ESPN_ALL + `?dates=${date}`;
  if (league !== 'all') {
    fetchUrl = ESPN_LEAGUE + `/${getLeagueCode(league)}/scoreboard?dates=${date}`;
  }

  try {
    const res  = await fetch(fetchUrl);
    const data = await res.json();

    let matches = [];
    let hasLive = false;
    const isToday = (date === todayStr());

    const events = data.events || [];
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) continue;

      const statusType = ev.status?.type?.name;
      const isLive     = statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME';
      if (isLive) hasLive = true;

      matches.push({
        id: ev.id,
        leagueId: data.leagues?.[0]?.id || league,
        date: ev.date,
        time: ev.status?.type?.detail || '',
        status: statusType,
        homeTeam: home.team?.displayName || '',
        homeLogo: home.team?.logo || '',
        homeScore: home.score || '0',
        awayTeam: away.team?.displayName || '',
        awayLogo: away.team?.logo || '',
        awayScore: away.score || '0'
      });
    }

    const leagueInfo = data.leagues?.[0] || {};
    const result = {
      success: true,
      league,
      date,
      leagueName: leagueInfo.name || (league === 'all' ? 'جميع المباريات' : league),
      leagueLogo: leagueInfo.logos?.[0]?.href || '',
      count: matches.length,
      matches
    };

    const ttl = hasLive ? TTL_LIVE : isToday ? TTL_MATCHES : TTL_FINISHED;
    await kvPut(env, kvKey, result, ttl);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── 2. تفاصيل المباراة الملخصة ──────────────────────────────────────────────
async function handleSummary(url, env) {
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ success: false, error: 'Missing id' }), { status: 400, headers: CORS });

  const kvKey  = `summary_${id}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return new Response(JSON.stringify(cached), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const res  = await fetch(`${ESPN_LEAGUE}/all/summary?event=${id}`);
    const data = await res.json();

    const header = data.header || {};
    const comp   = header.competitions?.[0] || {};
    const home   = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away   = comp.competitors?.find(c => c.homeAway === 'away') || {};

    // تجميع الأحداث (الأهداف والبطاقات)
    const events = [];
    const details = data.details || [];
    for (const det of details) {
      events.push({
        type: det.type?.text || '',
        clock: det.clock?.displayValue || '',
        teamId: det.team?.id || '',
        player: det.athletesInvolved?.[0]?.displayName || det.text || ''
      });
    }

    // إحصائيات المباراة
    const stats = [];
    const boxscore = data.boxscore || {};
    const rawStats = boxscore.statistics || [];
    for (const rs of rawStats) {
      const name = rs.label || '';
      const hVal = rs.homeValue || '0';
      const aVal = rs.awayValue || '0';
      stats.push({ name, home: hVal, away: aVal });
    }

    // التشكيلة الأساسية
    const lineups = { home: [], away: [] };
    const teamsData = boxscore.players || [];
    for (const td of teamsData) {
      const isHome = td.team?.id === home.id;
      const target = isHome ? lineups.home : lineups.away;
      const roster = td.statistics?.[0]?.athletes || [];
      for (const item of roster) {
        target.push({
          name: item.athlete?.displayName || '',
          jersey: item.jersey || '',
          position: item.athlete?.position?.abbreviation || '',
          starter: item.starter || false
        });
      }
    }

    const statusType = header.status?.type?.name || '';
    const result = {
      success: true,
      id,
      status: statusType,
      time: header.status?.type?.detail || '',
      homeTeam: home.team?.displayName || '',
      homeLogo: home.team?.logo || '',
      homeScore: home.score || '0',
      awayTeam: away.team?.displayName || '',
      awayLogo: away.team?.logo || '',
      awayScore: away.score || '0',
      events,
      stats,
      lineups
    };

    const isLive = statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME';
    const ttl = isLive ? TTL_SUMMARY : TTL_FINISHED;
    await kvPut(env, kvKey, result, ttl);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── 3. جدول الترتيب ──────────────────────────────────────────────────────────
async function handleStandings(url, env) {
  const league = url.searchParams.get('league');
  if (!league) return new Response(JSON.stringify({ success: false, error: 'Missing league' }), { status: 400, headers: CORS });

  const kvKey  = `standings_${league}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return new Response(JSON.stringify(cached), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const res  = await fetch(`${ESPN_LEAGUE}/${getLeagueCode(league)}/standings`);
    const data = await res.json();

    let groups = [];
    const rawChildren = data.children || [];

    if (rawChildren.length > 0) {
      // بطولات المجموعات (مثل دوري أبطال أوروبا أو اليورو)
      for (const child of rawChildren) {
        const groupName = child.name || '';
        const groupStandings = child.standings || {};
        const entries = groupStandings.entries || [];
        const totalTeams = entries.length;

        const table = entries.map(entry => {
          const stats = entry.stats || [];
          return {
            id: entry.team?.id || '',
            name: entry.team?.displayName || '',
            logo: entry.team?.logos?.[0]?.href || '',
            rank: entry.stats?.find(s => s.name === 'rank')?.value || 0,
            p: stats.find(s => s.name === 'gamesPlayed')?.value || 0,
            w: stats.find(s => s.name === 'wins')?.value || 0,
            d: stats.find(s => s.name === 'ties')?.value || 0,
            l: stats.find(s => s.name === 'losses')?.value || 0,
            f: stats.find(s => s.name === 'pointsFor')?.value || 0,
            a: stats.find(s => s.name === 'pointsAgainst')?.value || 0,
            gd: stats.find(s => s.name === 'pointDifferential')?.value || 0,
            pts: stats.find(s => s.name === 'points')?.value || 0,
          };
        });

        // إضافة الألوان والتأهل بناءً على المركز والمجموعة
        table.forEach(t => {
          const rule = getContinentalRule(getLeagueCode(league), t.rank, totalTeams);
          t.color = rule.color;
          t.desc = rule.desc;
        });

        groups.push({ name: groupName, table });
      }
    } else {
      // دوري محلي بنظام جدول واحد بسيط
      const entries = data.standings?.entries || [];
      const totalTeams = entries.length;

      const table = entries.map(entry => {
        const stats = entry.stats || [];
        return {
          id: entry.team?.id || '',
          name: entry.team?.displayName || '',
          logo: entry.team?.logos?.[0]?.href || '',
          rank: entry.stats?.find(s => s.name === 'rank')?.value || 0,
          p: stats.find(s => s.name === 'gamesPlayed')?.value || 0,
          w: stats.find(s => s.name === 'wins')?.value || 0,
          d: stats.find(s => s.name === 'ties')?.value || 0,
          l: stats.find(s => s.name === 'losses')?.value || 0,
          f: stats.find(s => s.name === 'pointsFor')?.value || 0,
          a: stats.find(s => s.name === 'pointsAgainst')?.value || 0,
          gd: stats.find(s => s.name === 'pointDifferential')?.value || 0,
          pts: stats.find(s => s.name === 'points')?.value || 0,
        };
      });

      table.forEach(t => {
        const rule = getContinentalRule(getLeagueCode(league), t.rank, totalTeams);
        t.color = rule.color;
        t.desc = rule.desc;
      });

      groups.push({ name: 'الترتيب العام', table });
    }

    const result = { success: true, league, groups };
    await kvPut(env, kvKey, result, TTL_STANDINGS);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── 4. قائمة الهدافين ────────────────────────────────────────────────────────
async function handleScorers(url, env) {
  const league = url.searchParams.get('league');
  if (!league) return new Response(JSON.stringify({ success: false, error: 'Missing league' }), { status: 400, headers: CORS });

  const kvKey  = `scorers_${league}`;
  const cached = await kvGet(env, kvKey);
  if (cached) return new Response(JSON.stringify(cached), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const res  = await fetch(`${ESPN_LEAGUE}/${getLeagueCode(league)}/leaders`);
    const data = await res.json();

    const categories = data.categories || [];
    const goalsCat = categories.find(c => c.name === 'goals') || {};
    const leaders = goalsCat.leaders || [];

    const scorers = leaders.map((l, i) => ({
      rank: i + 1,
      name: l.athlete?.displayName || l.displayName || '',
      photo: l.athlete?.headshot?.href || '',
      team: l.team?.displayName || l.team?.name || '',
      teamLogo: l.team?.logos?.[0]?.href || l.team?.logo || '',
      goals: parseInt(l.value) || 0,
    }));

    const result = { success: true, league, scorers };
    await kvPut(env, kvKey, result, TTL_SCORERS);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    
    const url  = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/ping')           return new Response('pong', { headers: CORS });
    if (path === '/api/matches')    return await handleMatches(url, env);
    if (path === '/api/summary')    return await handleSummary(url, env);
    if (path === '/api/standings')  return await handleStandings(url, env);
    if (path === '/api/scorers')    return await handleScorers(url, env);

    return new Response(JSON.stringify({ success: false, error: 'Not Found' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
};
