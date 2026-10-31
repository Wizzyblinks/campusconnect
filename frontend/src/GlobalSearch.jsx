import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { apiRequest } from "./services/api.js";

const categories = [
  ["all", "All"],
  ["students", "Students"],
  ["posts", "Posts"],
  ["news", "Campus news"],
  ["groups", "Communities"],
  ["marketplace", "Marketplace"],
];

export default function GlobalSearch({ onSelect, onProfile }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [results, setResults] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  async function runSearch(searchText, targetPage = 1, append = false) {
    if (searchText.trim().length < 2) {
      setResults({});
      setHasMore(false);
      setError("");
      return;
    }
    const request = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(
        `/api/search?q=${encodeURIComponent(searchText.trim())}&page=${targetPage}`,
      );
      if (request !== requestId.current) return;
      const next = data.results || {};
      setResults((current) => append
        ? Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(next)])]
          .map((key) => [key, [...(current[key] || []), ...(next[key] || [])]]))
        : next);
      setPage(targetPage);
      setHasMore(Object.values(next).some((items) => items.length === 10));
    } catch (requestError) {
      if (request === requestId.current) setError(requestError.message || "We couldn't search Campus Connect.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || query.trim().length < 2) return undefined;
    const timer = window.setTimeout(() => runSearch(query, 1, false), 300);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  const entries = [
    ...(results.students || []).map((item) => ["students", item]),
    ...(results.posts || []).map((item) => ["posts", item]),
    ...(results.news || []).map((item) => ["news", item]),
    ...(results.groups || []).map((item) => ["groups", item]),
    ...(results.marketplace || []).map((item) => ["marketplace", item]),
  ].filter(([type]) => category === "all" || category === type);

  const labelFor = (type, item) => {
    if (type === "students") return item.name;
    if (type === "posts") return item.text || "Post with media";
    if (type === "news") return item.title;
    if (type === "groups") return item.name;
    return item.title;
  };
  const sublabelFor = (type, item) => {
    if (type === "students") return `${item.institution} · ${item.campus}`;
    if (type === "posts") return `Post by ${item.author?.name || "Student"}`;
    if (type === "news") return "Campus news";
    if (type === "groups") return `${item.memberCount} members · Community`;
    return `₦${Number(item.price).toLocaleString()} · Marketplace`;
  };

  return (
    <div className="relative w-full">
      <label className="flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-200">
        <Search size={19} className="shrink-0 text-slate-400" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch(query);
              setOpen(true);
            }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search students, posts, campuses..."
          aria-label="Search Campus Connect"
          className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {query && <button type="button" onClick={() => { setQuery(""); setResults({}); setError(""); }} aria-label="Clear search" className="rounded-full p-1 text-slate-500 hover:bg-white"><X size={16} /></button>}
      </label>
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-[75vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex flex-wrap gap-2">
            {categories.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setCategory(id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === id ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>
            ))}
          </div>
          {loading && <p className="py-5 text-center text-sm text-slate-500">Searching Campus Connect...</p>}
          {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}<button type="button" onClick={() => runSearch(query)} className="ml-2 font-bold underline">Try again</button></div>}
          {!loading && !error && entries.length === 0 && <p className="py-7 text-center text-sm text-slate-500">No matching {category === "all" ? "results" : categories.find(([id]) => id === category)?.[1].toLowerCase()} found.</p>}
          <div className="mt-2 space-y-1">
            {entries.map(([type, item]) => (
              <div key={`${type}-${item._id || item.id}`} className="flex items-center gap-2 rounded-xl p-2 hover:bg-slate-50">
                <button
                  type="button"
                  onClick={() => { setOpen(false); onSelect(type, item); }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left"
                >
                  {type === "students" && item.avatar
                    ? <img src={item.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{type === "students" ? item.name?.slice(0, 1) : type === "marketplace" ? "₦" : type === "news" ? "N" : type === "groups" ? "C" : "P"}</span>}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{labelFor(type, item)}</span>
                    <span className="block truncate text-xs text-slate-500">{sublabelFor(type, item)}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-slate-400">{type}</span>
                </button>
                {type === "posts" && (item.author?._id || item.author?.id) && (
                  <button
                    type="button"
                    onClick={() => { setOpen(false); onProfile(item.author); }}
                    className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Author
                  </button>
                )}
              </div>
            ))}
          </div>
          {hasMore && !loading && <button type="button" onClick={() => runSearch(query, page + 1, true)} className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-blue-700">Load more results</button>}
        </div>
      )}
    </div>
  );
}
