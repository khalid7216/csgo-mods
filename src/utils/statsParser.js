const https = require('https');
const fs = require('fs');
const path = require('path');

const STATS_PATH = path.join(__dirname, '../../mods-cache/stats.json');

async function fetchPlayerStats(steamId, apiKey) {
  return new Promise((resolve, reject) => {
    const url = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=730&key=${apiKey}&steamid=${steamId}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.playerstats?.error) {
            resolve({ error: parsed.playerstats.error });
          } else {
            resolve(parsed.playerstats);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function parseStats(rawStats) {
  if (!rawStats || !rawStats.stats) return null;

  const stats = {};
  for (const stat of rawStats.stats) {
    stats[stat.name] = stat.value;
  }

  const kills = stats.total_kills || 0;
  const deaths = stats.total_deaths || 1;
  const headshots = stats.total_kills_headshots || 0;
  const mvps = stats.total_mvps || 0;
  const pistolKills = stats.total_kills_pistol || 0;
  const wins = stats.total_wins || 0;
  const shotsFired = stats.total_shots_fired || 0;
  const shotsHit = stats.total_hits || 0;
  const roundsPlayed = stats.total_rounds_played || 0;
  const matchesPlayed = stats.total_matches_played || 0;
  const damageDone = stats.total_damage_done || 0;
  const moneyEarned = stats.total_money_earned || 0;
  const enemiesFlashed = stats.total_enemies_flashed || 0;
  const knifeKills = stats.total_kills_knife || 0;
  const taserKills = stats.total_kills_taser || 0;

  const kdRatio = kills / deaths;
  const hsPercentage = kills > 0 ? ((headshots / kills) * 100).toFixed(1) : 0;
  const accuracy = shotsFired > 0 ? ((shotsHit / shotsFired) * 100).toFixed(1) : 0;
  const winRate = matchesPlayed > 0 ? ((wins / matchesPlayed) * 100).toFixed(1) : 0;
  const avgDamagePerRound = roundsPlayed > 0 ? (damageDone / roundsPlayed).toFixed(0) : 0;

  return {
    kills,
    deaths,
    kdRatio: kdRatio.toFixed(2),
    headshots,
    hsPercentage,
    mvps,
    pistolKills,
    wins,
    shotsFired,
    shotsHit,
    accuracy,
    roundsPlayed,
    matchesPlayed,
    winRate,
    damageDone,
    avgDamagePerRound,
    moneyEarned,
    enemiesFlashed,
    knifeKills,
    taserKills,
    closeRangeKills: pistolKills + knifeKills + taserKills
  };
}

function getCachedStats() {
  try {
    if (fs.existsSync(STATS_PATH)) {
      return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function saveStats(stats) {
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

module.exports = { fetchPlayerStats, parseStats, getCachedStats, saveStats };
