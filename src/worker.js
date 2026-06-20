// ─── /api/standings ───────────────────────────────────────────────────────────
async function handleStandings(url) {
  const league = url.searchParams.get('league') || 'eng.1';
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const data = await res.json();

    // ESPN standings: children[] → each child has standings.entries[]
    const children = data.children || [];
    const groups = [];

    for (const child of children) {
      const groupName = children.length > 1 ? (child.name || child.abbreviation || '') : '';
      const entries   = child.standings?.entries || [];
      const teams = entries.map(e => {
        const team  = e.team || {};
        const stats = {};
        for (const s of (e.stats || [])) stats[s.name] = s.displayValue ?? s.value ?? 0;
        return {
          rank:   parseInt(stats.rank || stats.gamesPlayed && '0') || (entries.indexOf(e) + 1),
          name:   team.displayName || team.name || '',
          logo:   team.logos?.[0]?.href || team.logo || '',
          played: stats.gamesPlayed ?? stats.played ?? '',
          wins:   stats.wins   ?? '',
          draws:  stats.ties   ?? stats.draws ?? '',
          losses: stats.losses ?? '',
          gf:     stats.pointsFor    ?? stats.goalsFor    ?? '',
          ga:     stats.pointsAgainst ?? stats.goalsAgainst ?? '',
          gd:     stats.pointDifferential ?? '',
          points: stats.points ?? '',
        };
      });
      // sort by rank
      teams.sort((a, b) => (parseInt(a.rank)||99) - (parseInt(b.rank)||99));
      groups.push({ name: groupName, teams });
    }

    return new Response(
      JSON.stringify({ success: true, league, groups }),
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
async function handleScorers(url) {
  const league = url.searchParams.get('league') || 'eng.1';
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/leaders`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const data = await res.json();

    // ESPN leaders: categories[] → find goals category
    const categories = data.categories || [];
    const goalsCat   = categories.find(c =>
      (c.name || '').toLowerCase().includes('goal') ||
      (c.displayName || '').toLowerCase().includes('goal')
    ) || categories[0];

    const leaders = goalsCat?.leaders || [];
    const scorers = leaders.map((l, i) => ({
      rank:     i + 1,
      name:     l.athlete?.displayName || l.displayName || '',
      photo:    l.athlete?.headshot?.href || '',
      team:     l.team?.displayName || l.team?.name || '',
      teamLogo: l.team?.logos?.[0]?.href || l.team?.logo || '',
      goals:    parseInt(l.value) || 0,
    }));

    return new Response(
      JSON.stringify({ success: true, league, scorers }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch(e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
}
