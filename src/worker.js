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


// ─── قواعد الألوان للتأهل والهبوط ──────────────────────────────────────────────
const CONTINENTAL_RULES = {
    "uefa.euro": {
        1: {color: "#81D6AC", desc: "تأهل لدور الـ 16"},
        2: {color: "#81D6AC", desc: "تأهل لدور الـ 16"},
        3: {color: "#B2BFD0", desc: "أفضل ثوالث (تأهل لدور الـ 16)"}
    },
    "fifa.world": {
        1: {color: "#81D6AC", desc: "تأهل لدور الـ 16"},
        2: {color: "#81D6AC", desc: "تأهل لدور الـ 16"},
        3: {color: "#B2BFD0", desc: "أفضل ثوالث (تأهل لدور الـ 16)"}
    },
    "caf.nations": {
        1: {color: "#81D6AC", desc: "تأهل لدور الـ 16"},
        2: {color: "#81D6AC", desc: "تأهل لدور الـ 16"},
        3: {color: "#B2BFD0", desc: "أفضل ثوالث (تأهل لدور الـ 16)"}
    },
    "fifa.worldq.uefa": {
        1: {color: "#81D6AC", desc: "تأهل لكأس العالم"},
        2: {color: "#B2BFD0", desc: "تأهل للملحق"}
    },
    "uefa.euroq": {
        1: {color: "#81D6AC", desc: "تأهل لليورو"},
        2: {color: "#81D6AC", desc: "تأهل لليورو"},
        3: {color: "#B2BFD0", desc: "تأهل للملحق"}
    },
    "caf.nations_qual": {
        1: {color: "#81D6AC", desc: "تأهل لأمم أفريقيا"},
        2: {color: "#81D6AC", desc: "تأهل لأمم أفريقيا"}
    },
    "eng.1": {
        1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        4: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        5: {color: "#6CABDD", desc: "الدوري الأوروبي"},
        6: {color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي"},
        "-3": {color: "#FF7F84", desc: "هبوط"},
        "-2": {color: "#FF7F84", desc: "هبوط"},
        "-1": {color: "#FF7F84", desc: "هبوط"}
    },
    "eng.2": {
        1: {color: "#81D6AC", desc: "صعود للدوري الممتاز"},
        2: {color: "#81D6AC", desc: "صعود للدوري الممتاز"},
        3: {color: "#6CABDD", desc: "ملحق الصعود"},
        4: {color: "#6CABDD", desc: "ملحق الصعود"},
        5: {color: "#6CABDD", desc: "ملحق الصعود"},
        6: {color: "#6CABDD", desc: "ملحق الصعود"},
        "-3": {color: "#FF7F84", desc: "هبوط"},
        "-2": {color: "#FF7F84", desc: "هبوط"},
        "-1": {color: "#FF7F84", desc: "هبوط"}
    },
    "eng.3": {
        1: {color: "#81D6AC", desc: "صعود للتشامبيونشيب"},
        2: {color: "#81D6AC", desc: "صعود للتشامبيونشيب"},
        3: {color: "#6CABDD", desc: "ملحق الصعود"},
        4: {color: "#6CABDD", desc: "ملحق الصعود"},
        5: {color: "#6CABDD", desc: "ملحق الصعود"},
        6: {color: "#6CABDD", desc: "ملحق الصعود"},
        "-4": {color: "#FF7F84", desc: "هبوط"},
        "-3": {color: "#FF7F84", desc: "هبوط"},
        "-2": {color: "#FF7F84", desc: "هبوط"},
        "-1": {color: "#FF7F84", desc: "هبوط"}
    },
    "eng.4": {
        1: {color: "#81D6AC", desc: "صعود للدرجة الأولى"},
        2: {color: "#81D6AC", desc: "صعود للدرجة الأولى"},
        3: {color: "#81D6AC", desc: "صعود للدرجة الأولى"},
        4: {color: "#6CABDD", desc: "ملحق الصعود"},
        5: {color: "#6CABDD", desc: "ملحق الصعود"},
        6: {color: "#6CABDD", desc: "ملحق الصعود"},
        7: {color: "#6CABDD", desc: "ملحق الصعود"},
        "-2": {color: "#FF7F84", desc: "هبوط"},
        "-1": {color: "#FF7F84", desc: "هبوط"}
    },
    "esp.1": {
        1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        4: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        5: {color: "#6CABDD", desc: "الدوري الأوروبي"},
        6: {color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي"},
        "-3": {color: "#FF7F84", desc: "هبوط"},
        "-2": {color: "#FF7F84", desc: "هبوط"},
        "-1": {color: "#FF7F84", desc: "هبوط"}
    },
    "fra.1": {
        1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        4: {color: "#6CABDD", desc: "دوري أبطال أوروبا (تصفيات)"},
        5: {color: "#6CABDD", desc: "الدوري الأوروبي"},
        6: {color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي"},
        "-3": {color: "#FF7F84", desc: "ملحق الهبوط"},
        "-2": {color: "#FF7F84", desc: "هبوط"},
        "-1": {color: "#FF7F84", desc: "هبوط"}
    },
    "ger.1": {
        1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        4: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        5: {color: "#6CABDD", desc: "الدوري الأوروبي"},
        6: {color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي"},
        "-3": {color: "#FF7F84", desc: "ملحق الهبوط"},
        "-2": {color: "#FF7F84", desc: "هبوط"},
        "-1": {color: "#FF7F84", desc: "هبوط"}
    },
    "ita.1": {
        1: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        2: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        3: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        4: {color: "#81D6AC", desc: "دوري أبطال أوروبا"},
        5: {color: "#6CABDD", desc: "الدوري الأوروبي"},
        6: {color: "#B2BFD0", desc: "دوري المؤتمر الأوروبي"},
        "-3": {color: "#FF7F84", desc: "هبوط"},
        "-2": {color: "#FF7F84", desc: "هبوط"},
        "-1": {color: "#FF7F84", desc: "هبوط"}
    },
    "sau.1": {
        1: {color: "#81D6AC", desc: "دوري أبطال آسيا للنخبة"},
        2: {color: "#81D6AC", desc: "دوري أبطال آسيا للنخبة"},
        3: {color: "#6CABDD", desc: "دوري أبطال آسيا 2"},
        "-3": {color: "#FF7F84", desc: "هبوط"},
        "-2": {color: "#FF7F84", desc: "هبوط"},
        "-1": {color: "#FF7F84", desc: "هبوط"}
    }
};

const ID_TO_CODE = {
  "1": "sco.1", "2": "uefa.champions", "3": "uefa.europa", "4": "tur.1", "5": "bel.1", "6": "gre.1", "7": "ned.1",
  "9": "fra.1", "10": "ger.1", "11": "ger.2", "12": "ger.dfb_pokal", "13": "ita.1", "14": "ita.2", 
  "15": "esp.1", "16": "esp.2", "17": "esp.copa_del_rey", "18": "ita.coppa_italia", "19": "ned.1", 
  "21": "usa.1", "22": "arg.1", "23": "eng.1", "24": "eng.2", "25": "eng.3", "26": "eng.4", "27": "eng.5", 
  "28": "eng.league_cup", "29": "eng.fa", "30": "eng.community_shield", "33": "aus.1", "34": "aut.1", 
  "40": "conmebol.libertadores", "44": "sco.1", "45": "nir.1", "46": "wal.1", "48": "caf.nations", 
  "49": "caf.nations_qual", "67": "gre.1", "71": "tur.1", "73": "uefa.euro", "74": "uefa.euroq", 
  "80": "arg.1", "81": "conmebol.sudamericana", "82": "conmebol.libertadores", "83": "conmebol.copa", 
  "84": "afc.asian.cup", "85": "fifa.worldq", "86": "concacaf.gold", "93": "ksa.1", "98": "usa.mls", "102": "fra.2", 
  "105": "por.1", "106": "por.2", "107": "lva.1", "108": "rou.1", "109": "ltu.1", "110": "est.1", 
  "111": "fra.coupe_de_france", "112": "rus.1", "113": "irl.1", "114": "bel.1", "115": "isl.1", 
  "116": "swe.1", "117": "nor.1", "118": "fin.1", "119": "den.1", "120": "cze.1", "121": "pol.1", 
  "122": "sui.1", "123": "srb.1", "124": "cro.1", "125": "bul.1", "126": "hun.1", "127": "ukr.1", 
  "128": "svn.1", "129": "svk.1", "131": "mex.1", "135": "bra.1", "137": "chi.1", "141": "col.1", 
  "143": "bol.1", "147": "ecu.1", "150": "par.1", "153": "per.1", "156": "uru.1", "159": "ven.1", 
  "163": "jpn.1", "165": "fra.2", "166": "ind.1", "167": "kor.1", "171": "chn.1", "174": "mex.1", "178": "tha.1", 
  "179": "mas.1", "180": "idn.1", "181": "sau.1", "182": "vie.1", "186": "uae.1", "190": "qat.1", 
  "194": "bhr.1", "198": "omn.1", "202": "syr.1", "206": "jor.1", "210": "irq.1", "214": "lbn.1", 
  "218": "kwt.1", "221": "can.1", "222": "crc.1", "223": "pan.1", "224": "jam.1", "225": "hon.1", 
  "226": "slv.1", "231": "mar.1", "232": "tun.1", "233": "alg.1", "234": "egy.1", "235": "rsa.1", 
  "236": "nga.1", "237": "ken.1", "238": "gha.1", "239": "tza.1", "240": "uga.1", "332": "bhr.1", 
  "333": "jor.1", "334": "kuw.1", "335": "oma.1", "336": "leb.1", "337": "ple.1", "338": "syr.1", 
  "341": "irn.1", "343": "irq.1", "606": "fifa.world", "1118": "alg.1", "1121": "mar.1", "1122": "mrt.1", 
  "1123": "egy.1", "1124": "lby.1", "1125": "qat.1", "1127": "sud.1", "1133": "tun.1", "1134": "ye.1", 
  "1227": "uae.1", "1975": "caf.champions", "1976": "caf.confed", "2003": "conmebol.america", 
  "2006": "uefa.euro", "2007": "fifa.confed", "2010": "fifa.world", "2018": "caf.nations", 
  "2199": "afc.champions", "2200": "afc.cup", "2201": "concacaf.champions", "2202": "concacaf.league", 
  "2305": "uefa.nations", "2310": "uefa.conference", "2311": "uefa.super_cup", "18318": "afc.champions", 
  "19159": "caf.champions", "19234": "rsf.1"
};

function applyFallbackColors(leagueCode, position, totalTeams) {
    const rules = CONTINENTAL_RULES[leagueCode];
    if (rules) {
        if (rules[position]) {
            return rules[position];
        } else if (position > totalTeams - 4) {
            const offset = position - totalTeams - 1;
            if (rules[offset]) {
                return rules[offset];
            }
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

// TTL بالثواني حسب نوع البيانات
const TTL_LIVE      = 60;    // مباريات مباشرة  — دقيقة واحدة
const TTL_MATCHES   = 300;   // مباريات اليوم   — 5 دقائق
const TTL_SUMMARY   = 90;    // تفاصيل مباراة  — 90 ثانية
const TTL_FINISHED  = 3600;  // مباريات منتهية — ساعة واحدة
const TTL_STANDINGS = 21600; // جدول الترتيب   — 6 ساعات
const TTL_SCORERS   = 21600; // الهدافين        — 6 ساعات

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

  const statusState = status.state || 'pre';
  const statusText  = status.shortDetail || '';
  const isHalfTime  = statusState === 'in' && (
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

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ─── /api/matches ─────────────────────────────────────────────────────────────
async function handleMatches(url, env) {
  const date    = url.searchParams.get('date') || todayStr();
  const kvKey   = `matches_${date}`;
  const isToday = date === todayStr();

  const cached = await kvGet(env, kvKey);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, fromCache: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  try {
    const res  = await fetch(`${ESPN_ALL}?dates=${date}&limit=500`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const matches = (data.events || []).map(parseEvent);
    const hasLive = matches.some(m => m.status === 'in');

    const result = { success: true, date, count: matches.length, matches };

    const ttl = hasLive ? TTL_LIVE : isToday ? TTL_MATCHES : TTL_FINISHED;
    await kvPut(env, kvKey, result, ttl);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── استخراج الأحداث الفنية بدقة ──────────────────────────────────────────────
function extractEvents(data, homeTeamName, awayTeamName) {
  const goals = [];
  const cards = [];
  const subs  = [];
  const seen  = new Set();

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
    if (t === 'yellowcard')     cards.push({ minute: fullMin, player: player1, team, type: 'yellowCard' });
    if (t === 'redcard')        cards.push({ minute: fullMin, player: player1, team, type: 'redCard' });
    if (t === 'yellowredcard')  cards.push({ minute: fullMin, player: player1, team, type: 'yellowRedCard' });
  }

  const jerseyMap = {};
  for (const rosterObj of (data.rosters || [])) {
    for (const p of (rosterObj.roster || [])) {
      const name = p.athlete?.displayName || '';
      const jersey = p.jersey || p.athlete?.jersey || '';
      if (name && jersey) jerseyMap[name] = jersey;
    }
  }

  const getJersey = (name, fallback) => jerseyMap[name] || fallback || '';

  const plays = data.plays || [];
  for (const play of plays) {
    const typeText = (play.type?.text || play.type?.id || '').toLowerCase();
    if (!typeText.includes('substitut') && typeText !== '78') continue;

    const min    = play.clock?.displayValue || '';
    const addMin = play.addedClock?.displayValue ? `+${play.addedClock.displayValue}` : '';
    const fullMin = min ? `${min}${addMin}` : '';
    const team   = play.team?.displayName || '';
    const participants = play.participants || [];

    const pOut = participants.find(p => p.type === 'playerSubstituted') || participants[0] || {};
    const pIn  = participants.find(p => p.type === 'playerSubstituting') || participants[1] || {};

    const playerOut = pOut.athlete?.displayName || pOut.displayName || '';
    const playerIn  = pIn.athlete?.displayName  || pIn.displayName  || '';

    const jerseyOut = getJersey(playerOut, pOut.athlete?.jersey || pOut.athlete?.headshot?.href || pOut.jersey || '');
    const jerseyIn  = getJersey(playerIn,  pIn.athlete?.jersey  || pIn.jersey  || '');

    if (!playerOut && !playerIn) continue;

    const key = `sub_${fullMin}_${playerOut}_${playerIn}`;
    if (seen.has(key)) continue;
    seen.add(key);

    subs.push({ minute: fullMin, playerIn: playerIn || '—', playerOut: playerOut || '—', jerseyIn, jerseyOut, team });
  }

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

  if (goals.length === 0) {
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
  }

  const sortByMinute = arr => arr.sort((a, b) => (parseInt(a.minute) || 0) - (parseInt(b.minute) || 0));
  sortByMinute(goals);
  sortByMinute(cards);
  sortByMinute(subs);

  const homeSubs = subs.filter(s => s.team === homeTeamName);
  const awaySubs = subs.filter(s => s.team === awayTeamName);

  if (homeSubs.length === 0 && awaySubs.length === 0 && subs.length > 0) {
    subs.forEach((s, i) => { if (i % 2 === 0) homeSubs.push(s); else awaySubs.push(s); });
  }

  return { goals, cards, subs, homeSubs, awaySubs };
}

// ─── /api/summary ─────────────────────────────────────────────────────────────
async function handleSummary(url, env) {
  const matchId = url.searchParams.get('matchId');
  let league  = url.searchParams.get('league');
  
  if (league && !isNaN(league) && ID_TO_CODE[league]) {
    league = ID_TO_CODE[league];
  }
  
  if (!matchId) return new Response(JSON.stringify({ error: 'matchId required' }), { status: 400, headers: CORS });

  const kvKey  = `summary_${matchId}`;
  const cached = await kvGet(env, kvKey);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, fromCache: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const leaguesToTry = league
    ? [league, 'fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'bra.1', 'arg.1', 'ned.1', 'por.1']
    : ['fifa.world', 'eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'bra.1', 'arg.1', 'ned.1', 'por.1'];

  let data = null;
  let usedLeague = '';
  for (const lg of leaguesToTry) {
    try {
      const res = await fetch(`${ESPN_LEAGUE}/${lg}/summary?event=${matchId}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const d = await res.json();
      if (d.header?.competitions?.[0]?.competitors?.length) {
        data = d;
        usedLeague = league || lg; 
        break;
      }
    } catch (_) { continue; }
  }

  if (!data) return new Response(JSON.stringify({ error: 'لم يتم العثور على المباراة' }), { status: 404, headers: CORS });

  try {
    const hdr      = data.header || {};
    const comp     = hdr.competitions?.[0] || {};
    const homeComp = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const awayComp = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const st       = comp.status?.type || {};

    const homeTeamName = homeComp.team?.displayName || '';
    const awayTeamName = awayComp.team?.displayName || '';

    const statusState = st.state || 'post';
    const statusText  = st.shortDetail || '';
    const isHalfTime  = statusState === 'in' && (statusText.toLowerCase().includes('half') || statusText.toLowerCase().includes('ht'));

    const gi    = data.gameInfo?.venue || {};
    const addr  = gi.address || {};
    const venue = [gi.fullName, addr.city, addr.country].filter(Boolean).join('، ');

    const altNote = comp.altGameNote || '';
    const altParts = altNote.split(',').map(s => s.trim());
    const leagueNameOnly = altParts[0] || hdr.league?.name || usedLeague || '';
    const leagueStage    = altParts.slice(1).join(', ') || '';
    const leagueFlag     = getFlag(leagueNameOnly);
    const leagueName     = leagueNameOnly ? `${leagueFlag} ${leagueNameOnly}${leagueStage ? ' - ' + leagueStage : ''}` : hdr.league?.name || usedLeague || '';

    const advancesNote = (comp.notes || []).find(n => n.text?.includes('advances'))?.text || '';
    const { goals, cards, subs, homeSubs, awaySubs } = extractEvents(data, homeTeamName, awayTeamName);

    const homeRoster = data.rosters?.find(r => r.homeAway === 'home');
    const awayRoster = data.rosters?.find(r => r.homeAway === 'away');

    const mapLineup = (rosterObj) => (rosterObj?.roster || []).map(p => ({
        name:      p.athlete?.displayName || '',
        shortName: p.athlete?.shortName   || '',
        jersey:    p.jersey || '',
        position:  p.position?.abbreviation || '',
        starter:   p.starter    ?? false,
        subbedIn:  p.subbedIn   ?? false,
        subbedOut: p.subbedOut  ?? false,
    }));

    const homeStats = data.boxscore?.teams?.[0]?.statistics || [];
    const awayStats = data.boxscore?.teams?.[1]?.statistics || [];

    const result = {
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
      homeLogo:      homeComp.team?.logos?.[0]?.href || homeComp.team?.logo || '',
      homeScore:     homeComp.score || '0',
      homeShootout:  homeComp.shootoutScore ?? null,
      awayTeam:      awayTeamName,
      awayLogo:      awayComp.team?.logos?.[0]?.href || awayComp.team?.logo || '',
      awayScore:     awayComp.score || '0',
      awayShootout:  awayComp.shootoutScore ?? null,
      homeWinner:    homeComp.winner ?? false,
      awayWinner:    awayComp.winner ?? false,
      status:        statusState,
      statusText,
      isHalfTime,
      minute:        comp.status?.displayClock || '',
      homeFormation: homeRoster?.formation || '',
      awayFormation: awayRoster?.formation || '',
      goals, cards, subs, homeSubs, awaySubs,
      homeLineup:    mapLineup(homeRoster),
      awayLineup:    mapLineup(awayRoster),
      homeStats:     homeStats.map(s => ({ name: s.label, value: s.displayValue })),
      awayStats:     awayStats.map(s => ({ name: s.label, value: s.displayValue })),
    };

    const ttl = statusState === 'in' ? TTL_SUMMARY : TTL_FINISHED;
    await kvPut(env, kvKey, result, ttl);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
}

// ─── /api/standings ───────────────────────────────────────────────────────────
async function handleStandings(url, env) {
  let league = url.searchParams.get('league') || 'eng.1';

  if (!isNaN(league) && ID_TO_CODE[league]) {
    league = ID_TO_CODE[league];
  }

  const kvKey = `standings_v2_${league}`;
  const cached = await kvGet(env, kvKey);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, fromCache: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  let seasonParam = '';
  if (league === 'fifa.world' || league.includes('worldq')) {
    seasonParam = '?season=2026';
  } else if (['uefa.euro','conmebol.copa','uefa.nations'].includes(league)) {
    seasonParam = '?season=2024';
  }

  try {
    const res = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings${seasonParam}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });

    if (!res.ok) {
      return new Response(JSON.stringify({ success: false, noStandings: true, error: `لا يوجد ترتيب متاح لهذه البطولة (${league})` }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const data = await res.json();
    const children = data.children || [];

    if (!children.length) {
      return new Response(JSON.stringify({ success: false, noStandings: true, error: 'لا توجد بيانات ترتيب لهذه البطولة حالياً' }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const groups = [];
    for (const child of children) {
      const groupName = children.length > 1 ? (child.name || child.abbreviation || '') : '';
      const entries   = child.standings?.entries || [];
      const teams = entries.map(e => {
        const team  = e.team || {};
        const stats = {};
        for (const s of (e.stats || [])) stats[s.name] = s.displayValue ?? s.value ?? 0;
        const rank = parseInt(stats.rank) || (entries.indexOf(e) + 1);
        const fallback = applyFallbackColors(league, rank, entries.length);

        let colorClass = '';
        if      (fallback.color === '#81D6AC') colorClass = 'promo';
        else if (fallback.color === '#6CABDD') colorClass = 'ucl';
        else if (fallback.color === '#FF9933' || fallback.color === '#F7B56B') colorClass = 'uel';
        else if (fallback.color === '#B2BFD0') colorClass = 'playoff';
        else if (fallback.color === '#FF7F84') colorClass = 'rel';

        return {
          rank,
          name:   team.displayName || team.name || '',
          logo:   team.logos?.[0]?.href || team.logo || '',
          played: stats.gamesPlayed ?? '',
          wins:   stats.wins   ?? '',
          draws:  stats.ties   ?? stats.draws ?? '',
          losses: stats.losses ?? '',
          gd:     stats.pointDifferential ?? '',
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

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, noStandings: true, error: 'تعذّر تحميل الترتيب، حاول مجدداً' }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── /api/scorers ─────────────────────────────────────────────────────────────
async function handleScorers(url, env) {
  let league = url.searchParams.get('league') || 'eng.1';
  
  if (!isNaN(league) && ID_TO_CODE[league]) {
    league = ID_TO_CODE[league];
  }
  const kvKey  = `scorers_${league}`;

  const cached = await kvGet(env, kvKey);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, fromCache: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  try {
    let seasonParam = '';
    if (league === 'fifa.world' || league.includes('qual') || league.includes('worldq')) {
      seasonParam = '?season=2026';
    } else if (league === 'uefa.euro' || league === 'conmebol.copa' || league === 'uefa.nations') {
      seasonParam = '?season=2024';
    }

    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/leaders${seasonParam}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const data = await res.json();

    const categories = data.categories || [];
    const goalsCat = categories.find(c => (c.name || '').toLowerCase().includes('goal') || (c.displayName || '').toLowerCase().includes('goal')) || categories[0];

    const leaders = goalsCat?.leaders || [];
    const scorers = leaders.map((l, i) => ({
      rank:     i + 1,
      name:     l.athlete?.displayName || l.displayName || '',
      photo:    l.athlete?.headshot?.href || '',
      team:     l.team?.displayName || l.team?.name || '',
      teamLogo: l.team?.logos?.[0]?.href || l.team?.logo || '',
      goals:    parseInt(l.value) || 0,
    }));

    const result = { success: true, league, scorers };
    await kvPut(env, kvKey, result, TTL_SCORERS);

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}

// ─── /api/league-matches ──────────────────────────────────────────────────────
async function handleLeagueMatches(url, env) {
  const league  = url.searchParams.get('league') || 'eng.1';
  const date    = url.searchParams.get('date')   || todayStr();
  const kvKey   = `lgmatches_${league}_${date}`;
  const isToday = date === todayStr();

  const cached = await kvGet(env, kvKey);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, fromCache: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  try {
    const res = await fetch(`${ESPN_LEAGUE}/${league}/scoreboard?dates=${date}&limit=100`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const data    = await res.json();
    const matches = (data.events || []).map(parseEvent);
    const hasLive = matches.some(m => m.status === 'in');

    const leagueInfo = data.leagues?.[0] || {};
    const leagueName = leagueInfo.name || league;
    const leagueLogo = leagueInfo.logos?.[0]?.href || '';

    const result = { success: true, league, date, leagueName, leagueLogo, count: matches.length, matches };
    const ttl    = hasLive ? TTL_LIVE : isToday ? TTL_MATCHES : TTL_FINISHED;
    await kvPut(env, kvKey, result, ttl);

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
    
    if (path === '/ping')                return new Response('pong', { headers: CORS });
    if (path === '/api/matches')         return await handleMatches(url, env);
    if (path === '/api/summary')         return await handleSummary(url, env);
    if (path === '/api/standings')       return await handleStandings(url, env);
    if (path === '/api/scorers')         return await handleScorers(url, env);
    if (path === '/api/league-matches')  return await handleLeagueMatches(url, env);
    
    return new Response('Not Found', { status: 404 });
  }
};
