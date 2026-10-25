import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Newspaper,
  ShieldAlert,
  Store,
  Users,
} from "lucide-react";
import { apiRequest } from "./services/api.js";
import { CampusServicesAdmin } from "./CampusServices.jsx";
import campusConnectLogo from "./assets/cclogo.jpeg";

const sections = [
  { id: "Overview", icon: Activity },
  { id: "Users", icon: Users },
  { id: "Campus Services", icon: Store },
  { id: "Campus News", icon: Newspaper },
  { id: "Reports", icon: ShieldAlert },
];

const emptyNewsForm = {
  title: "",
  content: "",
  image: "",
  isPublished: true,
};

const dateLabel = (value) =>
  value ? new Date(value).toLocaleString() : "Not available";

function AdminDashboard() {
  const [section, setSection] = useState("Overview");
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [news, setNews] = useState([]);
  const [newsForm, setNewsForm] = useState(emptyNewsForm);
  const [editingNewsId, setEditingNewsId] = useState("");
  const [reports, setReports] = useState([]);
  const [vibeReports, setVibeReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingNews, setSavingNews] = useState(false);

  const loadOverview = useCallback(async () => {
    setCheckingAccess(true);
    try {
      const data = await apiRequest("/api/admin/overview");
      setOverview(data);
      setAuthorized(true);
      setError("");
    } catch (requestError) {
      setAuthorized(false);
      setError(requestError.message || "Administrator access is required.");
    } finally {
      setCheckingAccess(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(userPage),
        limit: "20",
      });
      if (userSearch.trim()) params.set("search", userSearch.trim());
      const data = await apiRequest(`/api/admin/users?${params}`);
      setUsers(data.users || []);
      setUserPagination(data.pagination || null);
    } catch (requestError) {
      setError(requestError.message || "Could not load campus users.");
    } finally {
      setUsersLoading(false);
    }
  }, [userPage, userSearch]);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/api/news/admin");
      setNews(data.news || []);
    } catch (requestError) {
      setError(requestError.message || "Could not load campus news.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [messagingData, vibeData] = await Promise.all([
        apiRequest("/api/admin/reports/messages"),
        apiRequest("/api/matching/admin/reports"),
      ]);
      setReports(messagingData.reports || []);
      setVibeReports(vibeData.reports || []);
    } catch (requestError) {
      setError(requestError.message || "Could not load moderation reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!authorized) return;
    if (section === "Users") loadUsers();
    if (section === "Campus News") loadNews();
    if (section === "Reports") loadReports();
  }, [authorized, section, loadNews, loadReports, loadUsers]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch]);

  async function updateRestriction(account) {
    const restricted = !account.isRestricted;
    let reason = "";
    if (restricted) {
      reason = window.prompt(
        `Reason for restricting ${account.name} (max 300 characters):`,
      );
      if (reason === null) return;
    } else if (
      !window.confirm(`Restore access for ${account.name}?`)
    ) {
      return;
    }
    setError("");
    setNotice("");
    try {
      const data = await apiRequest(
        `/api/admin/users/${account._id}/restriction`,
        {
          method: "PATCH",
          body: JSON.stringify({ restricted, reason }),
        },
      );
      setNotice(data.message || "Account access updated.");
      await Promise.all([loadUsers(), loadOverview()]);
    } catch (requestError) {
      setError(requestError.message || "Could not update account access.");
    }
  }

  function editNews(item) {
    setEditingNewsId(item._id);
    setNewsForm({
      title: item.title || "",
      content: item.content || "",
      image: item.image || "",
      isPublished: Boolean(item.isPublished),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetNewsForm() {
    setEditingNewsId("");
    setNewsForm(emptyNewsForm);
  }

  async function saveNews(event) {
    event.preventDefault();
    setSavingNews(true);
    setError("");
    setNotice("");
    try {
      const data = await apiRequest(
        editingNewsId ? `/api/news/${editingNewsId}` : "/api/news",
        {
          method: editingNewsId ? "PATCH" : "POST",
          body: JSON.stringify(newsForm),
        },
      );
      setNotice(data.message || "Campus news saved.");
      resetNewsForm();
      await loadNews();
    } catch (requestError) {
      setError(requestError.message || "Could not save campus news.");
    } finally {
      setSavingNews(false);
    }
  }

  async function deleteNews(item) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
      return;
    }
    setError("");
    setNotice("");
    try {
      const data = await apiRequest(`/api/news/${item._id}`, {
        method: "DELETE",
      });
      setNotice(data.message || "Campus news deleted.");
      if (editingNewsId === item._id) resetNewsForm();
      await loadNews();
    } catch (requestError) {
      setError(requestError.message || "Could not delete campus news.");
    }
  }

  async function reviewVibeReport(reportId, status) {
    try {
      setError("");
      const data = await apiRequest(
        `/api/matching/admin/reports/${reportId}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setNotice(data.message || "VibeCheck report reviewed.");
      await loadReports();
    } catch (requestError) {
      setError(requestError.message || "Could not review VibeCheck report.");
    }
  }

  async function reviewMessageReport(report, status) {
    const note = window.prompt("Optional moderation note (max 500 characters):");
    if (note === null) return;
    try {
      setError("");
      const data = await apiRequest(
        `/api/admin/reports/messages/${report._id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, note }),
        },
      );
      setNotice(data.message || "Messaging report reviewed.");
      await loadReports();
    } catch (requestError) {
      setError(requestError.message || "Could not review messaging report.");
    }
  }

  if (checkingAccess) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Verifying administrator access...
      </div>
    );
  }
  if (!authorized) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error || "Administrator access is required."}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-blue-800 p-6 text-white sm:p-8">
        <div className="flex items-center gap-3">
          <img
            src={campusConnectLogo}
            alt="Campus Connect logo"
            className="h-12 w-12 rounded-xl bg-white object-contain p-1"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
              Campus Connect
            </p>
            <h3 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              Admin Dashboard
            </h3>
          </div>
        </div>
        <p className="mt-3 text-sm text-blue-100">
          Manage users, services, campus news, and submitted reports.
        </p>
      </header>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        {sections.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSection(id);
              setError("");
              setNotice("");
            }}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
              section === id
                ? "bg-blue-700 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon size={16} /> {id}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {notice}
        </div>
      )}

      {section === "Overview" && (
        <div className="space-y-5">
          {!overview ? (
            <p className="rounded-xl bg-white p-6 text-sm text-slate-500">
              Loading campus overview...
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Counts cover all accounts registered at {overview.scope}. Online status reflects authenticated active Socket.IO connections.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Total users", overview.counts.totalUsers],
                  ["Verified students", overview.counts.verifiedStudents],
                  ["Online users", overview.counts.onlineUsers],
                  ["Offline users", overview.counts.offlineUsers],
                ].map(([label, value]) => (
                  <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-sm font-semibold text-slate-500">{label}</p>
                    <p className="mt-2 text-3xl font-extrabold text-slate-900">{value}</p>
                  </article>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {sections.slice(1).map(({ id, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setSection(id)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left font-bold hover:border-blue-300 hover:bg-blue-50">
                    <Icon size={19} className="text-blue-700" /> Open {id}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {section === "Users" && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div>
            <h4 className="text-lg font-extrabold">User management</h4>
            <p className="mt-1 text-sm text-slate-500">Student accounts at your campus. Admin roles cannot be changed here.</p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 sm:max-w-md">
            <Users size={17} className="text-slate-400" />
            <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search name or email" className="w-full text-sm outline-none" />
          </label>
          {usersLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No users found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {users.map((account) => (
                <article key={account._id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {account.profile?.avatar ? <img src={account.profile.avatar} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{account.name?.[0] || "S"}</span>}
                    <div className="min-w-0">
                      <p className="truncate font-bold">{account.name}</p>
                      <p className="truncate text-xs text-slate-500">{account.email}</p>
                      <p className="mt-1 text-xs text-slate-500">Joined {dateLabel(account.createdAt)} · {account.isVerifiedStudent ? "Verified" : "Unverified"} · {account.isOnline ? "Online" : "Offline"}</p>
                      {account.isRestricted && <p className="mt-1 text-xs text-red-700">Restricted: {account.restrictionReason || "No reason recorded"}</p>}
                    </div>
                  </div>
                  {account.role === "student" && (
                    <button type="button" onClick={() => updateRestriction(account)} className={`rounded-lg px-3 py-2 text-xs font-bold ${account.isRestricted ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                      {account.isRestricted ? "Restore access" : "Restrict account"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
          {userPagination && userPagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <span className="text-slate-500">Page {userPagination.page} of {userPagination.totalPages} · {userPagination.total} accounts</span>
              <div className="flex gap-2">
                <button type="button" disabled={userPage <= 1} onClick={() => setUserPage((page) => page - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Previous</button>
                <button type="button" disabled={userPage >= userPagination.totalPages} onClick={() => setUserPage((page) => page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {section === "Campus Services" && <CampusServicesAdmin />}

      {section === "Campus News" && (
        <div className="space-y-5">
          <form onSubmit={saveNews} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-extrabold">{editingNewsId ? "Edit campus news" : "Create campus news"}</h4>
              {editingNewsId && <button type="button" onClick={resetNewsForm} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancel</button>}
            </div>
            <label className="block text-sm font-semibold">Title *
              <input required maxLength={160} value={newsForm.title} onChange={(event) => setNewsForm((current) => ({ ...current, title: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" />
            </label>
            <label className="block text-sm font-semibold">Content *
              <textarea required maxLength={10000} rows={5} value={newsForm.content} onChange={(event) => setNewsForm((current) => ({ ...current, content: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" />
            </label>
            <label className="block text-sm font-semibold">Optional HTTPS image URL
              <input type="url" maxLength={2048} value={newsForm.image} onChange={(event) => setNewsForm((current) => ({ ...current, image: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={newsForm.isPublished} onChange={(event) => setNewsForm((current) => ({ ...current, isPublished: event.target.checked }))} className="accent-blue-700" />
              Published to students
            </label>
            <button type="submit" disabled={savingNews} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{savingNews ? "Saving..." : editingNewsId ? "Save changes" : "Publish news"}</button>
          </form>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold">News records</h4>
              <button type="button" onClick={loadNews} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Refresh</button>
            </div>
            {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading news...</p> : news.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No campus news records.</p> : (
              <div className="mt-3 divide-y divide-slate-100">
                {news.map((item) => (
                  <article key={item._id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.isPublished ? "Published" : "Draft"} · {dateLabel(item.createdAt)}</p></div>
                    <div className="flex gap-2"><button type="button" onClick={() => editNews(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Edit</button><button type="button" onClick={() => deleteNews(item)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Delete</button></div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {section === "Reports" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div><h4 className="text-lg font-extrabold">Reports and moderation</h4><p className="mt-1 text-sm text-slate-500">Only implemented messaging and VibeCheck reports are listed.</p></div>
            <button type="button" onClick={loadReports} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">Refresh</button>
          </div>
          {loading ? <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">Loading reports...</p> : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h5 className="font-extrabold">Messaging reports ({reports.length})</h5>
                {reports.length === 0 ? <p className="py-5 text-sm text-slate-500">No reported conversations.</p> : reports.map((report) => (
                  <article key={report._id} className="mt-4 rounded-xl border border-slate-100 p-4">
                    <p className="font-bold">{report.participants?.map((participant) => participant.name).join(" and ") || "Conversation participants"}</p>
                    <p className="mt-1 text-sm text-slate-600">{report.reportReason || "No report details provided."}</p>
                    {report.lastMessage?.message && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Last message: {report.lastMessage.message}</p>}
                    <p className="mt-2 text-xs text-slate-500">Reported by {report.reportedBy?.name || "participant"} · {report.moderationStatus || "OPEN"} · {dateLabel(report.updatedAt)}</p>
                    {report.moderationStatus !== "RESOLVED" && report.moderationStatus !== "DISMISSED" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => reviewMessageReport(report, "REVIEWED")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Mark reviewed</button>
                        <button type="button" onClick={() => reviewMessageReport(report, "RESOLVED")} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Resolve</button>
                        <button type="button" onClick={() => reviewMessageReport(report, "DISMISSED")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Dismiss</button>
                      </div>
                    )}
                    {report.moderationNote && <p className="mt-2 text-xs text-slate-500">Admin note: {report.moderationNote}</p>}
                  </article>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h5 className="font-extrabold">VibeCheck reports ({vibeReports.length})</h5>
                {vibeReports.length === 0 ? <p className="py-5 text-sm text-slate-500">No open VibeCheck reports.</p> : vibeReports.map((report) => (
                  <article key={report._id} className="mt-4 rounded-xl border border-slate-100 p-4">
                    <p className="font-bold">{report.reason} · {report.reportedUser?.name || "Reported profile"}</p>
                    <p className="mt-1 text-sm text-slate-600">{report.details || "No additional details."}</p>
                    <p className="mt-2 text-xs text-slate-500">Reported by {report.reporter?.name || "student"} · {dateLabel(report.createdAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["REVIEWED", "ACTIONED", "DISMISSED"].map((status) => (
                        <button key={status} type="button" onClick={() => reviewVibeReport(report._id, status)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{status}</button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default AdminDashboard;
