import React, { useState, useEffect } from 'react';

export default function MapsPage({ addToast }) {
  const [maps, setMaps] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchMaps();
  }, [page]);

  const fetchMaps = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.fetchGameBananaMaps(search, page);
      setMaps(result.maps || []);
    } catch (err) {
      addToast('Failed to fetch maps', 'error');
    }
    setLoading(false);
  };

  const handleDownload = async (map) => {
    setDownloading(map.id);
    setProgress(0);
    try {
      const result = await window.electronAPI.downloadMap(map);
      if (result.success) {
        addToast(`Map installed: ${map.name}`, 'success');
      }
    } catch (err) {
      addToast(`Download failed: ${err.message}`, 'error');
    }
    setDownloading(null);
    setProgress(0);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Browse Maps</h2>
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search maps..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchMaps()}
          className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
        />
        <button
          onClick={fetchMaps}
          className="bg-primary-600 hover:bg-primary-700 px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {maps.map((map) => (
            <div key={map.id} className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden hover:border-dark-700 transition-colors">
              {map.image && (
                <img src={map.image} alt={map.name} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <h3 className="font-semibold text-lg truncate">{map.name}</h3>
                <p className="text-dark-500 text-sm mt-1">by {map.author}</p>
                <p className="text-dark-400 text-sm mt-2 line-clamp-2">{map.description}</p>
                <button
                  onClick={() => handleDownload(map)}
                  disabled={downloading === map.id}
                  className={`mt-4 w-full py-2 rounded-lg font-medium transition-colors ${
                    downloading === map.id
                      ? 'bg-dark-700 text-dark-400 cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {downloading === map.id ? `Downloading ${progress}%` : 'Download & Install'}
                </button>
                {downloading === map.id && (
                  <div className="mt-2 h-2 bg-dark-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 transition-all" style={{ width: `${progress}%` }}></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {maps.length === 0 && !loading && (
        <div className="text-center py-12 text-dark-500">
          <p className="text-lg">No maps found</p>
          <p className="text-sm mt-2">Try searching for maps on GameBanana</p>
        </div>
      )}

      <div className="flex justify-center gap-4 mt-6">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-dark-800 rounded-lg disabled:opacity-50 hover:bg-dark-700 transition-colors"
        >
          Previous
        </button>
        <span className="py-2 text-dark-400">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          className="px-4 py-2 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
