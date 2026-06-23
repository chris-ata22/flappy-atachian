(function () {
  'use strict';

  const CONFIG = window.SCOREBUG_CONFIG || {};
  const REFRESH_MS = CONFIG.refreshIntervalMs || 30 * 60 * 1000;
  const WC_GAMES_URL = 'https://worldcup26.ir/get/games';

  const scorebug = document.getElementById('scorebug');
  const scorebugBody = document.getElementById('scorebug-body');
  const scorebugUpdated = document.getElementById('scorebug-updated');
  const canvas = document.getElementById('game-canvas');
  const container = document.getElementById('game-container');

  let matches = [];
  let fetchTimer = null;

  function positionScorebug() {
    if (!canvas || !container || !scorebug) return;
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    scorebug.style.top = `${canvasRect.top - containerRect.top + 8}px`;
    scorebug.style.left = `${canvasRect.right - containerRect.left - scorebug.offsetWidth - 8}px`;
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function abbreviate(name) {
    if (!name) return '—';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return name.slice(0, 3).toUpperCase();
    return parts.map((p) => p[0]).join('').slice(0, 3).toUpperCase();
  }

  function displayScore(value) {
    if (value === null || value === undefined || value === 'null' || value === '') return '–';
    return String(value);
  }

  function normalizeWorldCupGames(games) {
    return games
      .filter((g) => String(g.time_elapsed).toLowerCase() === 'live')
      .map((g) => ({
        home: g.home_team_name_en,
        away: g.away_team_name_en,
        homeScore: displayScore(g.home_score),
        awayScore: displayScore(g.away_score),
        status: g.time_elapsed === 'live' ? 'LIVE' : String(g.time_elapsed).toUpperCase(),
        group: g.group ? `Grp ${g.group}` : '',
      }));
  }

  async function fetchFromWorldCupApi() {
    const res = await fetch(WC_GAMES_URL);
    if (!res.ok) throw new Error(`World Cup API ${res.status}`);
    const data = await res.json();
    return normalizeWorldCupGames(data.games || []);
  }

  async function fetchFromRapidApi() {
    const key = CONFIG.rapidApiKey;
    const host = CONFIG.rapidApiHost;
    if (!key || !host || key === 'YOUR_RAPIDAPI_KEY') return null;

    const url = `https://${host}/v3/fixtures?live=all&league=1&season=2026`;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': host,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const fixtures = data.response || [];
    if (!fixtures.length) return [];

    return fixtures.map((f) => ({
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeScore: f.goals.home ?? '–',
      awayScore: f.goals.away ?? '–',
      status: f.fixture.status.elapsed ? `${f.fixture.status.elapsed}'` : f.fixture.status.short,
      group: f.league?.round || '',
    }));
  }

  async function fetchLiveMatches() {
    let live = await fetchFromRapidApi();
    if (live === null) live = await fetchFromWorldCupApi();
    return live;
  }

  function render() {
    if (!scorebugBody) return;

    if (!matches.length) {
      scorebugBody.innerHTML = '<p class="scorebug-empty">No live World Cup matches</p>';
      return;
    }

    scorebugBody.innerHTML = matches
      .map(
        (m) => `
        <div class="scorebug-match">
          <div class="scorebug-teams">
            <span class="scorebug-team" title="${m.home}">${abbreviate(m.home)}</span>
            <span class="scorebug-score">${m.homeScore} – ${m.awayScore}</span>
            <span class="scorebug-team" title="${m.away}">${abbreviate(m.away)}</span>
          </div>
          <div class="scorebug-meta">
            <span class="scorebug-live-dot"></span>
            <span>${m.status}</span>
            ${m.group ? `<span class="scorebug-group">${m.group}</span>` : ''}
          </div>
        </div>`
      )
      .join('');
  }

  async function refresh() {
    try {
      scorebug?.classList.remove('scorebug-error');
      matches = await fetchLiveMatches();
      if (scorebugUpdated) scorebugUpdated.textContent = `Updated ${formatTime(new Date())}`;
      render();
    } catch {
      if (scorebugBody) {
        scorebugBody.innerHTML = '<p class="scorebug-empty">Scores unavailable</p>';
      }
      scorebug?.classList.add('scorebug-error');
    } finally {
      positionScorebug();
    }
  }

  function start() {
    refresh();
    if (fetchTimer) clearInterval(fetchTimer);
    fetchTimer = setInterval(refresh, REFRESH_MS);
    window.addEventListener('resize', positionScorebug);
    if (canvas) {
      new ResizeObserver(positionScorebug).observe(canvas);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
