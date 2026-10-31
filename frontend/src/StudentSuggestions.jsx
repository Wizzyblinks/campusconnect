import { useEffect, useState } from "react";
import { GraduationCap, Search, ShieldCheck } from "lucide-react";
import { apiRequest } from "./services/api.js";

export default function StudentSuggestions({ onProfile }) {
  const [mode, setMode] = useState("campus");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [campus, setCampus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ students: [], institutions: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ mode, page: String(page), limit: "12" });
    if (name.trim()) params.set("name", name.trim());
    if (mode === "intercampus" && institution) params.set("institution", institution);
    if (mode === "intercampus" && campus) params.set("campus", campus);
    apiRequest(`/api/discovery/students?${params}`)
      .then((data) => {
        if (!cancelled) setResult({
          students: data.students || [],
          institutions: data.institutions || [],
          pagination: data.pagination || null,
        });
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "We couldn't load student suggestions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mode, page, name, institution, campus, reload]);

  const campuses = result.institutions.find((item) => item.id === institution)?.campuses || [];

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setMode("campus"); setPage(1); setInstitution(""); setCampus(""); }} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${mode === "campus" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}>My campus</button>
          <button type="button" onClick={() => { setMode("intercampus"); setPage(1); }} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${mode === "intercampus" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}>Across campuses</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="relative md:col-span-1">
            <Search size={17} className="absolute left-3 top-3.5 text-slate-400" />
            <input value={name} onChange={(event) => { setName(event.target.value); setPage(1); }} maxLength={80} placeholder="Find a student by name" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm" />
          </label>
          {mode === "intercampus" && (
            <>
              <select value={institution} onChange={(event) => { setInstitution(event.target.value); setCampus(""); setPage(1); }} aria-label="Filter by institution" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                <option value="">All institutions</option>
                {result.institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select value={campus} onChange={(event) => { setCampus(event.target.value); setPage(1); }} aria-label="Filter by campus" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" disabled={!institution}>
                <option value="">All campuses</option>
                {campuses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </>
          )}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {mode === "campus"
            ? "Students who allow campus discovery and have a visible campus profile appear here."
            : "Only students who make their profiles public can be discovered across campuses."}
        </p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={() => setReload((current) => current + 1)} className="ml-2 font-bold underline">Retry</button></div>}
      {loading && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Finding students...</div>}
      {!loading && !error && !result.students.length && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <GraduationCap size={34} className="mx-auto text-blue-600" />
          <h3 className="mt-3 font-bold">No students found</h3>
          <p className="mt-1 text-sm text-slate-500">Try another name or check back later.</p>
        </div>
      )}
      {!loading && result.students.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.students.map((student) => (
              <article key={student.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => onProfile(student.id)} aria-label={`Open ${student.name}'s profile`} className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
                    {student.avatar ? <img src={student.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-700">{student.name.slice(0, 1)}</span>}
                  </button>
                  <div className="min-w-0">
                    <button type="button" onClick={() => onProfile(student.id)} className="max-w-full truncate text-left font-bold hover:text-blue-700 hover:underline">{student.name}{student.isVerifiedStudent && <ShieldCheck size={15} className="ml-1 inline text-blue-600" />}</button>
                    <p className="truncate text-xs text-slate-500">{student.institution}{student.campus ? ` · ${student.campus}` : ""}</p>
                  </div>
                </div>
                {(student.department || student.level) && <p className="mt-3 text-xs text-slate-500">{[student.department, student.level].filter(Boolean).join(" · ")}</p>}
                {student.bio && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{student.bio}</p>}
                <button type="button" onClick={() => onProfile(student.id)} className="mt-4 w-full rounded-xl border border-blue-200 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50">View profile</button>
              </article>
            ))}
          </div>
          {result.pagination?.totalPages > 1 && <div className="flex items-center justify-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Previous</button>
            <span className="text-sm text-slate-500">Page {page} of {result.pagination.totalPages}</span>
            <button type="button" disabled={page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Next</button>
          </div>}
        </>
      )}
    </section>
  );
}
