import { useEffect, useState } from "react";
import { apiRequest } from "./services/api.js";
import Auth from "./Auth.jsx";
import {
  Home,
  ShoppingBag,
  BookOpen,
  Newspaper,
  MessageCircle,
  Users,
  Utensils,
  Bell,
  Search,
  Settings,
  Menu,
  X,
  Plus,
  TrendingUp,
  MapPin,
  ChevronDown,
  Heart,
  MessageSquare,
  Share2,
  GraduationCap,
  ShieldCheck,
  Compass,
  LogOut,
} from "lucide-react";

const navigation = [
  { name: "Home Feed", icon: Home },
  { name: "Marketplace", icon: ShoppingBag },
  { name: "Study Centre", icon: BookOpen },
  { name: "Campus News", icon: Newspaper },
  { name: "Messages", icon: MessageCircle, badge: "3" },
  { name: "Communities", icon: Users },
  { name: "Cafeteria", icon: Utensils },
];

const initialPosts = [
  {
    id: 1,
    name: "Campus Connect",
    initials: "CC",
    university: "Campus Connect Team",
    time: "2 hours ago",
    text: "Welcome to Campus Connect! 🎉 Your new home for connecting with students, discovering opportunities, sharing resources, and staying updated on everything happening across Nigerian campuses.",
    category: "Announcement",
    likes: 124,
    comments: 32,
    color: "bg-blue-600",
    verified: true,
  },
  {
    id: 2,
    name: "Daniel Johnson",
    initials: "DJ",
    university: "Ritman University",
    time: "4 hours ago",
    text: "Students, what programming language are you currently learning? 👨‍💻 I am focusing on JavaScript and React. Drop yours in the comments. Let us learn together!",
    category: "Technology",
    likes: 48,
    comments: 17,
    color: "bg-orange-500",
    verified: false,
  },
  {
    id: 3,
    name: "Sarah Williams",
    initials: "SW",
    university: "University of Uyo",
    time: "6 hours ago",
    text: "Reminder to everyone preparing for exams: start early, take breaks, and help your classmates when you can. We all win when we learn together! 📚",
    category: "Academics",
    likes: 86,
    comments: 21,
    color: "bg-purple-600",
    verified: false,
  },
];

const trends = [
  { tag: "#CampusLife", posts: "2.4k posts" },
  { tag: "#TechStudentsNG", posts: "1.8k posts" },
  { tag: "#ExamPreparation", posts: "960 posts" },
  { tag: "#StudentOpportunities", posts: "740 posts" },
];

function getSavedUser() {
  try {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (!token || !savedUser) {
      return null;
    }

    return JSON.parse(savedUser);
  } catch {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return null;
  }
}

function App() {
  const [user, setUser] = useState(getSavedUser);
  const [activePage, setActivePage] = useState("Home Feed");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [likedPosts, setLikedPosts] = useState([]);
  const [posts, setPosts] = useState(initialPosts);
  const [newPost, setNewPost] = useState("");
  const [search, setSearch] = useState("");

  const [campusNews, setCampusNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");

  useEffect(() => {
    if (!user || activePage !== "Campus News") {
      return;
    }

    let cancelled = false;

    async function loadCampusNews() {
      setNewsLoading(true);
      setNewsError("");

      try {
        const data = await apiRequest("/api/news/campus");

        if (!cancelled) {
          setCampusNews(Array.isArray(data.news) ? data.news : []);
        }
      } catch (error) {
        if (!cancelled) {
          setNewsError(error.message || "Failed to load campus news.");
        }
      } finally {
        if (!cancelled) {
          setNewsLoading(false);
        }
      }
    }

    loadCampusNews();

    return () => {
      cancelled = true;
    };
  }, [activePage, user]);

  function handleLogin(loggedInUser) {
    localStorage.setItem("user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    setActivePage("Home Feed");
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
    setActivePage("Home Feed");
    setCampusNews([]);
    setNewsError("");
    setLikedPosts([]);
    setMobileMenuOpen(false);
  }

  function toggleLike(id) {
    setLikedPosts((previous) =>
      previous.includes(id)
        ? previous.filter((postId) => postId !== id)
        : [...previous, id],
    );
  }

  // Support both populated institution/campus objects and plain ID fields.
  const institutionName =
    typeof user?.institution === "object" && user.institution !== null
      ? user.institution.name || user.institution.shortName || ""
      : user?.institutionName || "";

  const campusName =
    typeof user?.campus === "object" && user.campus !== null
      ? user.campus.name || ""
      : user?.campusName || "";

  function publishPost(event) {
    event.preventDefault();

    if (!newPost.trim()) {
      return;
    }

    const fullName = user?.name || "Student";

    const initials =
      fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "ST";

    const post = {
      id: Date.now(),
      name: fullName,
      initials,
      university: institutionName || campusName || "Campus Connect Student",
      time: "Just now",
      text: newPost.trim(),
      category: "General",
      likes: 0,
      comments: 0,
      color: "bg-blue-600",
      verified: Boolean(user?.isVerifiedStudent),
    };

    setPosts((previous) => [post, ...previous]);
    setNewPost("");
    setActivePage("Home Feed");
  }

  const filteredPosts = posts.filter((post) => {
    const query = search.toLowerCase();

    return (
      post.text.toLowerCase().includes(query) ||
      post.name.toLowerCase().includes(query) ||
      post.university.toLowerCase().includes(query)
    );
  });

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  const fullName = user.name || "Student";

  const userInitials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "ST";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* TOP NAVIGATION */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white">
              <GraduationCap size={25} />
            </div>

            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-blue-700 sm:text-xl">
                Campus<span className="text-slate-900">Connect</span>
              </h1>

              <p className="hidden text-[10px] font-medium tracking-widest text-slate-500 sm:block">
                YOUR CAMPUS. YOUR COMMUNITY.
              </p>
            </div>
          </div>

          <div className="hidden max-w-md flex-1 md:block">
            <div className="flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-200">
              <Search size={19} className="text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students, posts, campuses..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <button
              className="relative rounded-xl p-2.5 text-slate-600 hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell size={21} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
            </button>

            <div className="hidden h-8 border-l border-slate-200 sm:block" />

            <div className="flex items-center gap-2 rounded-xl p-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                {userInitials}
              </div>

              <div className="hidden text-left sm:block">
                <p className="max-w-40 truncate text-sm font-semibold">
                  {fullName}
                </p>

                <p className="text-xs capitalize text-slate-500">
                  {user.role || "Student"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[245px_minmax(0,1fr)] xl:grid-cols-[245px_minmax(0,1fr)_290px]">
        {/* SIDEBAR */}
        <aside
          className={`${
            mobileMenuOpen ? "block" : "hidden"
          } fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-r border-slate-200 bg-white p-4 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)]`}
        >
          <div className="mb-6 rounded-2xl bg-blue-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-blue-700">
              <MapPin size={17} />
              <span className="text-xs font-bold uppercase tracking-wide">
                Your Campus
              </span>
            </div>

            <p className="font-bold text-slate-900">
              {campusName || "Campus not set"}
            </p>

            <p className="mt-1 text-sm font-medium text-slate-600">
              {institutionName || "Institution not set"}
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Discover what's happening at your university.
            </p>

            <button
              onClick={() => {
                setActivePage("Settings");
                setMobileMenuOpen(false);
              }}
              className="mt-3 flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              Campus settings <ChevronDown size={15} />
            </button>
          </div>

          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Main Menu
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setActivePage(item.name);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-700 text-white shadow-md shadow-blue-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={19} />
                    {item.name}
                  </span>

                  {item.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        isActive
                          ? "bg-white text-blue-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="my-6 border-t border-slate-100" />

          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            Account
          </p>

          <button
            onClick={() => {
              setActivePage("Settings");
              setMobileMenuOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Settings size={19} /> Settings
          </button>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={19} /> Log out
          </button>

          <div className="mt-8 rounded-2xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck size={20} className="text-blue-700" />
              <p className="text-sm font-bold">Student verification</p>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Verify your student status to build trust in the community.
            </p>

            <button
              onClick={() => {
                setActivePage("Student Verification");
                setMobileMenuOpen(false);
              }}
              className="mt-3 text-sm font-bold text-blue-700 hover:underline"
            >
              Get verified →
            </button>
          </div>

          <p className="mt-8 px-3 text-xs text-slate-400">
            © 2026 Campus Connect
          </p>
        </aside>

        {/* MAIN CONTENT */}
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 md:hidden">
            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
              <Search size={19} className="text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Campus Connect..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="mb-7">
            <p className="mb-1 text-sm font-medium text-slate-500">
              Welcome, {fullName}
            </p>

            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {activePage === "Home Feed"
                ? "Your Campus, Your World 👋"
                : activePage}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {activePage === "Home Feed"
                ? "Connect with students and discover what is happening across campuses."
                : `Explore ${activePage.toLowerCase()} on Campus Connect.`}
            </p>
          </div>

          {/* QUICK STATS */}
          <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Users size={19} />
              </div>
              <p className="text-xl font-extrabold">Connect</p>
              <p className="mt-1 text-xs text-slate-500">
                Across Nigerian campuses
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <TrendingUp size={19} />
              </div>
              <p className="text-xl font-extrabold">Discover</p>
              <p className="mt-1 text-xs text-slate-500">
                Campus trends and stories
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <BookOpen size={19} />
              </div>
              <p className="text-xl font-extrabold">Learn</p>
              <p className="mt-1 text-xs text-slate-500">
                Resources for students
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <ShoppingBag size={19} />
              </div>
              <p className="text-xl font-extrabold">Trade</p>
              <p className="mt-1 text-xs text-slate-500">
                Buy and sell on campus
              </p>
            </div>
          </div>

          {/* CREATE POST */}
          {activePage === "Home Feed" && (
            <form
              onSubmit={publishPost}
              className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                  {userInitials}
                </div>

                <textarea
                  value={newPost}
                  onChange={(event) => setNewPost(event.target.value)}
                  placeholder="What's happening on your campus?"
                  rows={2}
                  className="min-h-20 flex-1 resize-y rounded-xl bg-slate-50 p-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="hidden text-xs text-slate-400 sm:block">
                  Share ideas, questions and campus updates.
                </p>

                <button
                  type="submit"
                  disabled={!newPost.trim()}
                  className="ml-auto flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={17} /> Create Post
                </button>
              </div>
            </form>
          )}

          {/* FEED HEADING */}
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-extrabold">
              {activePage === "Home Feed" ? "Campus Feed" : activePage}
            </h3>

            <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Latest posts
            </button>
          </div>

          {/* PLACEHOLDER FOR OTHER SECTIONS */}
          {activePage !== "Home Feed" && activePage !== "Campus News" && (
            <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h3 className="font-bold text-blue-900">
                {activePage} is ready for development
              </h3>

              <p className="mt-2 text-sm leading-6 text-blue-800">
                This is the initial dashboard layout. We'll build this section
                and connect it to the backend API in the next stages.
              </p>
            </div>
          )}

          {/* CAMPUS NEWS */}
          {activePage === "Campus News" && (
            <section className="space-y-5">
              {newsLoading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    Loading campus news...
                  </p>
                </div>
              )}

              {!newsLoading && newsError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="font-bold text-red-800">
                    Unable to load campus news
                  </h3>

                  <p className="mt-2 text-sm text-red-700">{newsError}</p>

                  <button
                    onClick={() => {
                      setNewsError("");
                      setActivePage("Home Feed");
                    }}
                    className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-800"
                  >
                    Return to Home Feed
                  </button>
                </div>
              )}

              {!newsLoading && !newsError && campusNews.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                  <Newspaper size={32} className="mx-auto text-slate-400" />

                  <h3 className="mt-3 font-bold text-slate-800">
                    No campus news yet
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    News and announcements from your campus will appear here.
                  </p>
                </div>
              )}

              {!newsLoading &&
                !newsError &&
                campusNews.map((news) => (
                  <article
                    key={news._id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    {news.image && (
                      <img
                        src={
                          news.image.startsWith("http")
                            ? news.image
                            : `http://localhost:5000${news.image}`
                        }
                        alt={news.title}
                        className="h-56 w-full object-cover"
                      />
                    )}

                    <div className="p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <Newspaper size={18} />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {news.author?.name || "Campus Administration"}
                          </p>

                          <p className="text-xs text-slate-500">
                            {news.createdAt
                              ? new Date(news.createdAt).toLocaleDateString()
                              : "Recently published"}
                          </p>
                        </div>
                      </div>

                      <h3 className="text-lg font-extrabold text-slate-900">
                        {news.title}
                      </h3>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {news.content}
                      </p>
                    </div>
                  </article>
                ))}
            </section>
          )}

          {/* HOME FEED POSTS */}
          {activePage === "Home Feed" && (
            <div className="space-y-5">
              {filteredPosts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${post.color}`}
                    >
                      {post.initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="text-sm font-bold">{post.name}</h4>

                        {post.verified && (
                          <ShieldCheck
                            size={16}
                            className="text-blue-600"
                            aria-label="Verified account"
                          />
                        )}
                      </div>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {post.university} · {post.time}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                      {post.category}
                    </span>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {post.text}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition hover:bg-slate-50 ${
                        likedPosts.includes(post.id)
                          ? "text-red-500"
                          : "text-slate-500"
                      }`}
                    >
                      <Heart
                        size={18}
                        fill={
                          likedPosts.includes(post.id) ? "currentColor" : "none"
                        }
                      />
                      {post.likes + (likedPosts.includes(post.id) ? 1 : 0)}{" "}
                      Likes
                    </button>

                    <button className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">
                      <MessageSquare size={18} />
                      {post.comments} Comments
                    </button>

                    <button className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">
                      <Share2 size={18} />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                  </div>
                </article>
              ))}

              {filteredPosts.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                  <Search size={28} className="mx-auto text-slate-400" />

                  <p className="mt-3 font-bold">No matching posts found</p>

                  <p className="mt-1 text-sm text-slate-500">
                    Try searching for something else.
                  </p>
                </div>
              )}
            </div>
          )}

          <footer className="py-8 text-center text-xs text-slate-400">
            Campus Connect · Connecting students, building communities.
          </footer>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="hidden space-y-6 px-5 py-6 xl:block">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-extrabold">Trending Nationwide</h3>
              <TrendingUp size={18} className="text-orange-500" />
            </div>

            <p className="mb-4 text-xs leading-5 text-slate-500">
              Topics students across Nigeria are talking about.
            </p>

            <div className="space-y-4">
              {trends.map((trend, index) => (
                <button
                  key={trend.tag}
                  onClick={() => setSearch(trend.tag.replace("#", ""))}
                  className="block w-full text-left"
                >
                  <p className="text-sm font-bold text-blue-700 hover:underline">
                    {trend.tag}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {trend.posts} · #{index + 1} trending
                  </p>
                </button>
              ))}
            </div>

            <button className="mt-5 text-sm font-bold text-blue-700 hover:underline">
              Explore trends →
            </button>
          </section>

          <section className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 p-5 text-white">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Compass size={23} />
            </div>

            <h3 className="text-lg font-extrabold">
              Your next opportunity awaits.
            </h3>

            <p className="mt-2 text-sm leading-6 text-blue-100">
              Explore communities, discover learning resources, and connect with
              students beyond your campus.
            </p>

            <button
              onClick={() => setActivePage("Communities")}
              className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-800 transition hover:bg-blue-50"
            >
              Explore Communities
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 font-extrabold">Quick Access</h3>

            <div className="space-y-2">
              <button
                onClick={() => setActivePage("Study Centre")}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                  <BookOpen size={19} />
                </div>

                <div>
                  <p className="text-sm font-semibold">Study resources</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Learn and prepare
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActivePage("Marketplace")}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                  <ShoppingBag size={19} />
                </div>

                <div>
                  <p className="text-sm font-semibold">Student marketplace</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Shop within the community
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActivePage("Cafeteria")}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-700">
                  <Utensils size={19} />
                </div>

                <div>
                  <p className="text-sm font-semibold">Campus cafeteria</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Find food around campus
                  </p>
                </div>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default App;
