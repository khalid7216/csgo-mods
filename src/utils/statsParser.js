const https = require('https');
const fs = require('fs');
const { getCachePath } = require('./appPaths');

const CSGO_APP_ID = '4465480';

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Steam API request failed with ${res.statusCode}`));
            return;
          }
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function fetchPlayerStats(steamId, apiKey) {
  const params = new URLSearchParams({
    appid: CSGO_APP_ID,
    key: apiKey,
    steamid: steamId
  });
  const parsed = await requestJson(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?${params.toString()}`);

  if (parsed.playerstats?.error) {
    return { error: parsed.playerstats.error };
  }

  return parsed.playerstats;
}

async function fetchPlayerProfile(steamId, apiKey) {
  const params = new URLSearchParams({
    key: apiKey,
    steamids: steamId
  });
  const parsed = await requestJson(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?${params.toString()}`);
  const player = parsed.response?.players?.[0];

  if (!player) {
    return { error: 'Steam profile not found' };
  }

  return {
    steamId: player.steamid,
    personaName: player.personaname || 'Steam Player',
    avatar: player.avatarfull || player.avatarmedium || player.avatar || '',
    profileUrl: player.profileurl || `https://steamcommunity.com/profiles/${steamId}`,
    countryCode: player.loccountrycode || '',
    lastLogoff: player.lastlogoff || null
  };
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
    const STATS_PATH = getCachePath('stats.json');
    if (fs.existsSync(STATS_PATH)) {
      return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function saveStats(stats) {
  fs.writeFileSync(getCachePath('stats.json'), JSON.stringify(stats, null, 2));
}

module.exports = { fetchPlayerStats, fetchPlayerProfile, parseStats, getCachedStats, saveStats };
