import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  Search,
  Compass,
  Sparkles,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Layers
} from 'lucide-react';
import api from '../lib/api';
import SchemeCard from '../components/SchemeCard';

export default function Bookmarks() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [notice, setNotice] = useState('');

  const loadBookmarks = () => {
    setLoading(true);
    api
      .get('/bookmarks')
      .then(r => {
        // Filter out null or missing schemes
        const valid = (r.data.items || []).filter(item => item && item.scheme);
        setItems(valid);
      })
      .catch(err => {
        console.error('Failed to load bookmarks', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  const handleRemove = async (schemeId, schemeName) => {
    try {
      await api.delete(`/bookmarks/${schemeId}`);
      setItems(prev => prev.filter(x => x.scheme?._id !== schemeId));
      setNotice(`Removed "${schemeName || 'Scheme'}" from your bookmarks.`);
      setTimeout(() => setNotice(''), 3500);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove bookmark.');
    }
  };

  // Derive unique categories from active bookmarks
  const categories = ['All', ...new Set(items.map(x => x.scheme?.category).filter(Boolean))];

  // Filter items
  const filtered = items.filter(x => {
    const s = x.scheme;
    if (!s) return false;
    const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase()) ||
      s.ministry?.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-slate-900">Saved Bookmarks</h1>
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
              {items.length} Saved
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Your shortlisted government schemes. Compare benefits, check document checklists, and apply when ready.
          </p>
        </div>

        <Link
          to="/schemes"
          className="btn-secondary text-xs flex items-center gap-1.5 self-start md:self-auto"
        >
          <Compass size={14} />
          <span>Explore More Schemes</span>
        </Link>
      </div>

      {/* Temporary Notice Banner */}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-700" />
          <span>{notice}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      {items.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                className="input !pl-9 text-xs py-2 w-full"
                placeholder="Search within your saved schemes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`rounded-full px-3 py-1 font-semibold transition shrink-0 ${
                    selectedCategory === c
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="card p-6 h-64 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(x => (
            <div key={x._id} className="relative group">
              <SchemeCard
                scheme={x.scheme}
                initialBookmarked={true}
                onBookmarkRemoved={() => handleRemove(x.scheme._id, x.scheme.name)}
              />
              {/* Quick remove action button on hover */}
              <button
                type="button"
                onClick={() => handleRemove(x.scheme._id, x.scheme.name)}
                className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/90 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 shadow-sm transition opacity-0 group-hover:opacity-100"
                title="Remove from Bookmarks"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="card p-8 text-center text-slate-500 space-y-2">
          <p className="font-semibold text-sm">No schemes match your filter or search criteria.</p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedCategory('All');
            }}
            className="text-xs text-emerald-700 hover:underline font-bold"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* Empty State */
        <div className="card p-12 text-center space-y-4 max-w-lg mx-auto">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Bookmark size={26} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No Bookmarked Schemes Yet</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              When you explore schemes or view personalized recommendations, click the bookmark icon to save them here for quick access.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/schemes" className="btn-primary text-xs !px-4 py-2">
              Explore Schemes
            </Link>
            <Link to="/recommendations" className="btn-secondary text-xs !px-4 py-2">
              Check Recommendations
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
