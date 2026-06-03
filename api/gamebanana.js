const API_BASE = 'https://api.gamebanana.com';
const CS_GAME_ID = 4660;
const FIELDS = 'name,text,creator,Preview().sStructuredDataFullsizeUrl(),Url().sProfileUrl(),Url().sDownloadUrl(),date,views,likes,Files().aFiles(),Game().name,Category().name,RootCategory().name';

function parseMod(id, data) {
  const files = data['Files().aFiles()'] || {};
  return {
    id,
    name: data.name || '',
    description: (data.text || '').replace(/<[^>]*>/g, ''),
    author: data.creator || '',
    image: data['Preview().sStructuredDataFullsizeUrl()'] || '',
    downloadUrl: data['Url().sDownloadUrl()'] || `https://gamebanana.com/mods/download/${id}`,
    profileUrl: data['Url().sProfileUrl()'] || `https://gamebanana.com/mods/${id}`,
    dateAdded: data.date || 0,
    views: data.views || 0,
    likes: data.likes || 0,
    game: data['Game().name'] || '',
    category: data['Category().name'] || '',
    rootCategory: data['RootCategory().name'] || '',
    files: Object.values(files).map((file) => ({
      name: file._sFile,
      size: file._nFilesize,
      url: file._sDownloadUrl
    }))
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CSGO-Mod-Manager/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`GameBanana returned ${response.status}`);
  }

  return response.json();
}

async function fetchModData(ids) {
  const mods = await Promise.all(ids.map(async (id) => {
    try {
      const url = `${API_BASE}/Core/Item/Data?itemtype=Mod&itemid=${id}&fields=${encodeURIComponent(FIELDS)}&return_object=1`;
      const data = await fetchJson(url);
      return data && data.name ? parseMod(id, data) : null;
    } catch {
      return null;
    }
  }));

  return mods.filter(Boolean);
}

module.exports = async function handler(req, res) {
  const type = req.query.type === 'skins' ? 'skins' : 'maps';
  const query = String(req.query.query || '').toLowerCase().slice(0, 100);
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);

  try {
    const listUrl = `${API_BASE}/Core/List/New?itemtype=Mod&gameid=${CS_GAME_ID}&page=${page}`;
    const list = await fetchJson(listUrl);
    const ids = (Array.isArray(list) ? list : [])
      .filter((item) => item[0] === 'Mod')
      .map((item) => item[1])
      .slice(0, 15);

    const allMods = await fetchModData(ids);
    const filtered = allMods
      .filter((mod) => {
        if (type === 'skins') {
          return ['Skins', 'Weps'].includes(mod.rootCategory) || ['Skins', 'Weps'].includes(mod.category);
        }

        return mod.rootCategory === 'Maps' || mod.category === 'Maps';
      })
      .filter((mod) => {
        if (!query) return true;
        return mod.name.toLowerCase().includes(query) || mod.description.toLowerCase().includes(query);
      });

    res.status(200).json({
      [type]: filtered,
      total: filtered.length,
      page
    });
  } catch (error) {
    res.status(502).json({
      [type]: [],
      total: 0,
      page,
      error: error.message
    });
  }
};
