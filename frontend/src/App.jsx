import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { API_URL, apiRequest } from "./services/api.js";
import Auth from "./Auth.jsx";
import { CampusServices } from "./CampusServices.jsx";
import Messages from "./Messages.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import campusConnectLogo from "./assets/cclogo.jpeg";
import {
  Home,
  ShoppingBag,
  BookOpen,
  Newspaper,
  MessageCircle,
  Users,
  Utensils,
  Store,
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
  UserRound,
} from "lucide-react";

const navigation = [
  { name: "Home Feed", icon: Home },
  { name: "Marketplace", icon: ShoppingBag },
  { name: "Study Centre", icon: BookOpen },
  { name: "Campus News", icon: Newspaper },
  { name: "Messages", icon: MessageCircle },
  { name: "Communities", icon: Users },
  { name: "Cafeteria", icon: Utensils },
  { name: "Campus Services", icon: Store },
  { name: "Campus Match", label: "VibeCheck", icon: Heart, highlight: true },
  { name: "Admin Dashboard", icon: ShieldCheck, adminOnly: true },
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

const bottomNavigation = [
  { label: "Home", page: "Home Feed", icon: Home },
  { label: "Marketplace", page: "Marketplace", icon: ShoppingBag },
  { label: "Campus News", page: "Campus News", icon: Newspaper },
  { label: "Campus Services", page: "Campus Services", icon: Store },
  { label: "Profile", page: "Profile", icon: UserRound },
];

function App() {
  const [user, setUser] = useState(getSavedUser);
  const [activePage, setActivePage] = useState("Home Feed");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [likedPosts, setLikedPosts] = useState([]);
  const [posts, setPosts] = useState(initialPosts);
  const [newPost, setNewPost] = useState("");
  const [search, setSearch] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messageSocket, setMessageSocket] = useState(null);
  const [campusNews, setCampusNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user || !token) {
      setMessageSocket(null);
      return undefined;
    }
    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    setMessageSocket(socket);
    return () => {
      socket.disconnect();
      setMessageSocket(null);
    };
  }, [user]);

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Welcome to Campus Connect!",
      message: "Explore your campus and connect with other students.",
      time: "Just now",
      read: false,
    },
    {
      id: 2,
      title: "Discover VibeCheck",
      message: "Find students who share your interests.",
      time: "Today",
      read: false,
    },
    {
      id: 3,
      title: "Explore your community",
      message: "Join conversations happening across campuses.",
      time: "Today",
      read: true,
    },
  ]);

  const [matchProfiles, setMatchProfiles] = useState([]);
  const [matchConnections, setMatchConnections] = useState([]);
  const [matchCampuses, setMatchCampuses] = useState([]);
  const [matchEnabled, setMatchEnabled] = useState(false);
  const [matchEligible, setMatchEligible] = useState(false);
  const [matchInterestsInput, setMatchInterestsInput] = useState("");
  const [matchConsentAccepted, setMatchConsentAccepted] = useState(false);
  const [matchCampusFilter, setMatchCampusFilter] = useState("");
  const [matchInterestFilter, setMatchInterestFilter] = useState("");
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchLoaded, setMatchLoaded] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [matchNotice, setMatchNotice] = useState("");
  const [matchRefreshVersion, setMatchRefreshVersion] = useState(0);
  const [matchActionLoading, setMatchActionLoading] = useState("");
  const [matchPreferencesSaving, setMatchPreferencesSaving] = useState(false);
  const [matchReportProfile, setMatchReportProfile] = useState(null);
  const [matchReportReason, setMatchReportReason] = useState("HARASSMENT");
  const [matchReportDetails, setMatchReportDetails] = useState("");

  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [marketplaceCategory, setMarketplaceCategory] = useState("all");
  const [marketplaceNotice, setMarketplaceNotice] = useState("");
  const [listingFormOpen, setListingFormOpen] = useState(false);
  const [checkoutListing, setCheckoutListing] = useState(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payoutSetupOpen, setPayoutSetupOpen] = useState(false);
  const [banks, setBanks] = useState([]);
  const [payoutForm, setPayoutForm] = useState({ accountNumber: "", bankCode: "" });
  const [deliveryOtpInputs, setDeliveryOtpInputs] = useState({});
  const [marketplaceSubmitting, setMarketplaceSubmitting] = useState(false);
  const [listingForm, setListingForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "electronics",
    condition: "new",
    stock: "1",
    media: [],
    sellerTermsAccepted: false,
  });
  const [orderForm, setOrderForm] = useState({
    quantity: "1",
    deliveryAddress: "",
    deliveryPhone: "",
    buyerNote: "",
    deliveryMethod: "SELLER_TO_BUYER",
  });

  async function loadMarketplaceListings() {
    setMarketplaceLoading(true);
    setMarketplaceError("");

    try {
      const data = await apiRequest("/api/marketplace");
      setMarketplaceListings(Array.isArray(data.listings) ? data.listings : []);
    } catch (error) {
      setMarketplaceError(
        error.message || "Failed to load marketplace listings.",
      );
    } finally {
      setMarketplaceLoading(false);
    }
  }

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const data = await apiRequest("/api/orders");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      setMarketplaceError(error.message || "Could not load your orders.");
    } finally {
      setOrdersLoading(false);
    }
  }

  async function verifyDeliveryOtp(orderId) {
    try {
      const data = await apiRequest(`/api/delivery/${orderId}/verify`, {
        method: "POST",
        body: JSON.stringify({ otp: deliveryOtpInputs[orderId] || "" }),
      });
      setMarketplaceNotice(data.message || "Delivery verified.");
      setDeliveryOtpInputs((current) => ({ ...current, [orderId]: "" }));
      loadOrders();
    } catch (error) {
      setMarketplaceError(error.message || "Could not verify the delivery code.");
    }
  }

  async function openPayoutSetup() {
    setPayoutSetupOpen(true);
    try {
      const data = await apiRequest("/api/payouts/banks");
      setBanks(Array.isArray(data.banks) ? data.banks : []);
    } catch (error) {
      setMarketplaceError(error.message || "Could not load the bank list.");
    }
  }

  async function savePayoutAccount(event) {
    event.preventDefault();
    setMarketplaceSubmitting(true);
    try {
      const data = await apiRequest("/api/payouts/account", {
        method: "PUT",
        body: JSON.stringify(payoutForm),
      });
      setMarketplaceNotice(data.message);
      setPayoutSetupOpen(false);
    } catch (error) {
      setMarketplaceError(error.message || "Could not save payout account.");
    } finally {
      setMarketplaceSubmitting(false);
    }
  }

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

  useEffect(() => {
    if (!user || activePage !== "Campus Match") {
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams();
    if (matchCampusFilter) {
      params.set("campusId", matchCampusFilter);
    }
    if (matchInterestFilter.trim()) {
      params.set("interest", matchInterestFilter.trim());
    }
    const query = params.toString();
    setMatchLoaded(false);
    setMatchLoading(true);
    setMatchProfiles([]);
    setMatchConnections([]);
    setMatchEnabled(false);
    setMatchEligible(false);

    async function loadVibeCheck() {
      setMatchLoading(true);
      setMatchError("");

      try {
        const data = await apiRequest(
          `/api/matching${query ? `?${query}` : ""}`,
        );

        if (!cancelled) {
          setMatchEligible(Boolean(data.eligible));
          setMatchEnabled(Boolean(data.enabled));
          setMatchInterestsInput(
            Array.isArray(data.interests) ? data.interests.join(", ") : "",
          );
          setMatchCampuses(Array.isArray(data.campuses) ? data.campuses : []);
          setMatchProfiles(
            Array.isArray(data.profiles) ? data.profiles : [],
          );
          setMatchConnections(
            Array.isArray(data.matches) ? data.matches : [],
          );
          setMatchLoaded(true);
        }
      } catch (error) {
        if (!cancelled) {
          setMatchError(error.message || "Could not load VibeCheck profiles.");
          setMatchProfiles([]);
          setMatchConnections([]);
          setMatchLoaded(true);
        }
      } finally {
        if (!cancelled) {
          setMatchLoading(false);
        }
      }
    }

    const debounce = window.setTimeout(loadVibeCheck, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [
    activePage,
    matchCampusFilter,
    matchInterestFilter,
    matchRefreshVersion,
    user,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");

    if (!user || params.get("payment") !== "success" || !reference) return;

    let cancelled = false;
    async function confirmReturnedPayment() {
      setActivePage("Marketplace");
      setMarketplaceNotice("Confirming your payment...");
      try {
        const data = await apiRequest("/api/payments/confirm", {
          method: "POST",
          body: JSON.stringify({ reference }),
        });
        if (!cancelled) {
          setMarketplaceNotice(data.message || "Payment confirmed successfully.");
          loadOrders();
        }
      } catch (error) {
        if (!cancelled) setMarketplaceError(error.message || "Could not confirm payment.");
      } finally {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    confirmReturnedPayment();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || activePage !== "Marketplace") {
      return;
    }

    loadMarketplaceListings();
  }, [activePage, user]);

  async function submitListing(event) {
    event.preventDefault();
    setMarketplaceSubmitting(true);
    setMarketplaceError("");

    try {
      const formData = new FormData();
      formData.append("title", listingForm.title.trim());
      formData.append("description", listingForm.description.trim());
      formData.append("price", listingForm.price);
      formData.append("category", listingForm.category);
      formData.append("condition", listingForm.condition);
      formData.append("stock", listingForm.stock);
      formData.append("sellerTermsAccepted", String(listingForm.sellerTermsAccepted));
      listingForm.media.forEach((file) => formData.append("media", file));

      const data = await apiRequest("/api/marketplace", {
        method: "POST",
        body: formData,
      });

      setMarketplaceListings((current) => [data.listing, ...current]);
      setListingFormOpen(false);
      setListingForm({
        title: "",
        description: "",
        price: "",
        category: "electronics",
        condition: "new",
        stock: "1",
        media: [],
        sellerTermsAccepted: false,
      });
      setMarketplaceNotice("Your item is now listed in the marketplace.");
    } catch (error) {
      setMarketplaceError(error.message || "Could not create your listing.");
    } finally {
      setMarketplaceSubmitting(false);
    }
  }

  async function startCheckout(event) {
    event.preventDefault();
    if (!checkoutListing) return;

    setMarketplaceSubmitting(true);
    setMarketplaceError("");

    try {
      const orderData = await apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          listingId: checkoutListing._id,
          quantity: Number(orderForm.quantity),
          deliveryAddress: orderForm.deliveryAddress.trim(),
          deliveryPhone: orderForm.deliveryPhone.trim(),
          buyerNote: orderForm.buyerNote.trim(),
          deliveryMethod: orderForm.deliveryMethod,
        }),
      });
      const paymentData = await apiRequest("/api/payments/initialize", {
        method: "POST",
        body: JSON.stringify({
          orderId: orderData.order._id,
          callbackUrl: `${window.location.origin}${window.location.pathname}?payment=success`,
        }),
      });

      if (!paymentData.payment?.authorizationUrl) {
        throw new Error("The payment provider did not return a checkout link.");
      }

      window.location.assign(paymentData.payment.authorizationUrl);
    } catch (error) {
      setMarketplaceError(error.message || "Could not start checkout.");
      setMarketplaceSubmitting(false);
    }
  }

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
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
  }

  function toggleLike(id) {
    setLikedPosts((previous) =>
      previous.includes(id)
        ? previous.filter((postId) => postId !== id)
        : [...previous, id],
    );
  }

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

  async function saveVibeCheckPreferences(enabled) {
    const interests = [
      ...new Set(
        matchInterestsInput
          .split(",")
          .map((interest) => interest.trim())
          .filter(Boolean),
      ),
    ];

    if (interests.length > 10 || interests.some((interest) => interest.length > 32)) {
      setMatchError("Enter up to 10 interests, each no longer than 32 characters.");
      return;
    }

    setMatchPreferencesSaving(true);
    setMatchError("");

    try {
      const data = await apiRequest("/api/matching/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          enabled,
          interests,
          consentAccepted: enabled && matchConsentAccepted,
        }),
      });
      setMatchEnabled(data.enabled);
      setMatchNotice(data.message || "VibeCheck settings updated.");
      setMatchConsentAccepted(false);
      setMatchRefreshVersion((current) => current + 1);
    } catch (error) {
      setMatchError(error.message || "Could not update VibeCheck settings.");
    } finally {
      setMatchPreferencesSaving(false);
    }
  }

  async function handleProfileAction(profileId, action) {
    setMatchActionLoading(profileId);
    setMatchError("");
    setMatchNotice("");

    try {
      const data = await apiRequest(
        `/api/matching/profiles/${profileId}/actions`,
        {
          method: "POST",
          body: JSON.stringify({ action }),
        },
      );
      setMatchNotice(data.message || "VibeCheck action saved.");
      setMatchRefreshVersion((current) => current + 1);
    } catch (error) {
      setMatchError(error.message || "Could not save that VibeCheck action.");
    } finally {
      setMatchActionLoading("");
    }
  }

  function handleLikeProfile(profileId) {
    return handleProfileAction(profileId, "LIKE");
  }

  function handlePassProfile(profileId) {
    return handleProfileAction(profileId, "PASS");
  }

  function handleBlockProfile(profileId) {
    if (!window.confirm("Block this student from seeing your VibeCheck profile?")) {
      return;
    }

    return handleProfileAction(profileId, "BLOCK");
  }

  async function submitVibeCheckReport(event) {
    event.preventDefault();
    if (!matchReportProfile) return;

    setMatchError("");
    try {
      const data = await apiRequest(
        `/api/matching/profiles/${matchReportProfile}/report`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: matchReportReason,
            details: matchReportDetails.trim(),
          }),
        },
      );
      setMatchNotice(data.message || "Report submitted for review.");
      setMatchReportProfile(null);
      setMatchReportDetails("");
    } catch (error) {
      setMatchError(error.message || "Could not submit the report.");
    }
  }

  function resetMatchDiscovery() {
    setMatchCampusFilter("");
    setMatchInterestFilter("");
    setMatchRefreshVersion((current) => current + 1);
  }

  function markNotificationsRead() {
    setNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        read: true,
      })),
    );
  }

  const unreadNotifications = notifications.filter(
    (notification) => !notification.read,
  ).length;

  const institutionName =
    typeof user?.institution === "object" && user.institution !== null
      ? user.institution.name || user.institution.shortName || ""
      : user?.institutionName || "";

  const campusName =
    typeof user?.campus === "object" && user.campus !== null
      ? user.campus.name || ""
      : user?.campusName || "";

  const filteredPosts = posts.filter((post) => {
    const query = search.toLowerCase();

    return (
      post.text.toLowerCase().includes(query) ||
      post.name.toLowerCase().includes(query) ||
      post.university.toLowerCase().includes(query)
    );
  });

  const filteredMarketplaceListings = marketplaceListings.filter((listing) => {
    const query = marketplaceSearch.trim().toLowerCase();

    const matchesSearch =
      !query ||
      listing.title?.toLowerCase().includes(query) ||
      listing.description?.toLowerCase().includes(query) ||
      listing.category?.toLowerCase().includes(query);

    const matchesCategory =
      marketplaceCategory === "all" || listing.category === marketplaceCategory;

    return matchesSearch && matchesCategory;
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
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-3 sm:gap-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen((previous) => !previous);
                setNotificationsOpen(false);
              }}
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <img
              src={campusConnectLogo}
              alt="Campus Connect logo"
              className="h-10 w-10 rounded-xl bg-white object-contain"
            />

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
              type="button"
              onClick={() => {
                setActivePage("Messages");
                setMobileMenuOpen(false);
                setNotificationsOpen(false);
              }}
              aria-label="Messages"
              title="Messages"
              className={`relative rounded-xl p-2.5 transition ${
                activePage === "Messages"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              <MessageCircle size={21} />
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePage("Campus Match");
                setMobileMenuOpen(false);
                setNotificationsOpen(false);
              }}
              aria-label="VibeCheck"
              title="VibeCheck"
              className={`rounded-xl p-2.5 transition ${
                activePage === "Campus Match"
                  ? "bg-pink-50 text-pink-600"
                  : "text-slate-600 hover:bg-pink-50 hover:text-pink-600"
              }`}
            >
              <Heart size={21} />
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen((previous) => !previous);
                  setProfileMenuOpen(false);
                }}
                className="relative rounded-xl p-2.5 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell size={21} />

                {unreadNotifications > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-[60] w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 p-4">
                    <div>
                      <h3 className="font-extrabold">Notifications</h3>

                      <p className="mt-1 text-xs text-slate-500">
                        {unreadNotifications} unread
                      </p>
                    </div>

                    <button
                      onClick={markNotificationsRead}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => {
                          setNotifications((previous) =>
                            previous.map((item) =>
                              item.id === notification.id
                                ? { ...item, read: true }
                                : item,
                            ),
                          );

                          setNotificationsOpen(false);

                          if (notification.id === 2) {
                            setActivePage("Campus Match");
                          } else if (notification.id === 3) {
                            setActivePage("Communities");
                          } else {
                            setActivePage("Home Feed");
                          }
                        }}
                        className={`flex w-full gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${
                          !notification.read ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                            notification.read ? "bg-slate-200" : "bg-blue-600"
                          }`}
                        />

                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-800">
                            {notification.title}
                          </span>

                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {notification.message}
                          </span>

                          <span className="mt-2 block text-[11px] text-slate-400">
                            {notification.time}
                          </span>
                        </span>
                      </button>
                    ))}

                    {notifications.length === 0 && (
                      <p className="p-6 text-center text-sm text-slate-500">
                        You're all caught up!
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

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

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 top-16 z-30 bg-slate-900/30 lg:hidden"
        />
      )}

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[245px_minmax(0,1fr)] xl:grid-cols-[245px_minmax(0,1fr)_290px]">
        <aside
          className={`${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-16 left-0 z-40 w-[min(290px,85vw)] overflow-y-auto border-r border-slate-200 bg-white p-4 transition-transform duration-200 lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:w-auto lg:translate-x-0`}
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
            {navigation
              .filter((item) => !item.adminOnly || user.role === "admin")
              .map((item) => {
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
                      ? item.highlight
                        ? "bg-pink-600 text-white shadow-md shadow-pink-100"
                        : "bg-blue-700 text-white shadow-md shadow-blue-100"
                      : item.highlight
                        ? "text-pink-600 hover:bg-pink-50"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={19} />
                    {item.label || item.name}
                  </span>

                  {(item.badge ||
                    (item.name === "Messages" && unreadMessages > 0)) && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        isActive
                          ? "bg-white text-blue-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {item.badge ||
                        (unreadMessages > 99 ? "99+" : unreadMessages)}
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

        <main className="min-w-0 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-28">
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
                : activePage === "Campus Match"
                  ? "VibeCheck"
                  : activePage}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {activePage === "Home Feed"
                ? "Connect with students and discover what is happening across campuses."
                : activePage === "Campus Services"
                  ? "Find local services, businesses, and essentials around your campus."
                  : activePage === "Campus Match"
                    ? "Discover students who share your interests."
                    : `Explore ${activePage.toLowerCase()} on Campus Connect.`}
            </p>
          </div>

          {activePage === "Campus Services" && <CampusServices />}

          {activePage === "Messages" && (
            <Messages
              user={user}
              socket={messageSocket}
              onUnreadCount={setUnreadMessages}
            />
          )}

          {activePage === "Admin Dashboard" && (
            <AdminDashboard />
          )}

          {activePage === "Campus Match" && (
            <section className="space-y-6">
              <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-pink-600 via-rose-500 to-purple-700 p-6 text-white sm:p-8">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">
                      <Heart size={15} />
                      VIBECHECK
                    </div>

                    <h3 className="text-2xl font-extrabold sm:text-3xl">
                      Meet your kind of people ❤️
                    </h3>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-pink-50">
                      Discover students with similar interests, make new
                      friends, and explore meaningful connections across
                      Nigerian campuses.
                    </p>
                  </div>

                  <div className="flex h-20 w-20 shrink-0 items-center justify-center self-center rounded-3xl bg-white/20 sm:self-auto">
                    <Heart size={42} fill="currentColor" />
                  </div>
                </div>
              </div>

              {matchError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {matchError}
                </div>
              )}

              {matchNotice && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  {matchNotice}
                </div>
              )}

              {!matchLoaded && matchLoading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Loading VibeCheck...
                </div>
              )}

              {matchLoaded && !matchEligible && !matchError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="font-extrabold text-amber-950">
                    VibeCheck is unavailable
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    VibeCheck is unavailable for this account right now. Please
                    try again later.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMatchRefreshVersion((current) => current + 1)}
                    className="mt-4 rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-900"
                  >
                    Try again
                  </button>
                  {matchEnabled && (
                    <button
                      type="button"
                      disabled={matchPreferencesSaving}
                      onClick={() => saveVibeCheckPreferences(false)}
                      className="ml-3 mt-4 rounded-xl border border-amber-800 px-4 py-2.5 text-sm font-bold text-amber-900 disabled:opacity-60"
                    >
                      Opt out
                    </button>
                  )}
                </div>
              )}

              {matchLoaded && matchEligible && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="font-extrabold">
                    {matchEnabled ? "Your VibeCheck profile" : "Join VibeCheck"}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {matchEnabled
                      ? "Only students at your institution who have opted in can see your profile. You can opt out at any time."
                      : "Opt in to meet students at your institution. Your name, photo, campus, department, level, bio, and interests may be shown; your email and phone number are never shared."}
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-sm font-semibold">
                      Interests (comma-separated, up to 10)
                    </span>
                    <input
                      value={matchInterestsInput}
                      onChange={(event) =>
                        setMatchInterestsInput(event.target.value)
                      }
                      maxLength={340}
                      placeholder="e.g. football, music, volunteering"
                      className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                    />
                  </label>
                  {matchEnabled ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={matchPreferencesSaving}
                        onClick={() => saveVibeCheckPreferences(true)}
                        className="rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-60"
                      >
                        {matchPreferencesSaving ? "Saving..." : "Save interests"}
                      </button>
                      <button
                        type="button"
                        disabled={matchPreferencesSaving}
                        onClick={() => saveVibeCheckPreferences(false)}
                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Opt out
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700">
                        <input
                          required
                          type="checkbox"
                          checked={matchConsentAccepted}
                          onChange={(event) =>
                            setMatchConsentAccepted(event.target.checked)
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          I agree to show this profile information to other
                          VibeCheck students at my institution. I can turn
                          visibility off at any time.
                        </span>
                      </label>
                      <button
                        type="button"
                        disabled={!matchConsentAccepted || matchPreferencesSaving}
                        onClick={() => saveVibeCheckPreferences(true)}
                        className="mt-4 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {matchPreferencesSaving ? "Joining..." : "Opt in"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {matchEnabled && matchConnections.length > 0 && (
                <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5">
                  <h3 className="font-extrabold text-pink-950">
                    Your mutual connections
                  </h3>
                  <p className="mt-1 text-sm text-pink-800">
                    You and these students have both liked each other.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {matchConnections.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                      >
                        {profile.avatar ? (
                          <img
                            src={profile.avatar}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 font-bold text-pink-700">
                            {profile.name
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </span>
                        )}
                        {profile.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchEnabled && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-extrabold">Discover students</h3>

                <p className="mt-1 text-sm text-slate-500">
                  Filter opted-in student profiles by campus or shared interests.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="match-campus"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Campus
                    </label>

                    <select
                      id="match-campus"
                      value={matchCampusFilter}
                      onChange={(event) =>
                        setMatchCampusFilter(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                    >
                      <option value="">All campuses</option>
                      {matchCampuses.map((campus) => (
                        <option key={campus.id} value={campus.id}>
                          {campus.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="match-interest"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Interest
                    </label>

                    <input
                      id="match-interest"
                      value={matchInterestFilter}
                      onChange={(event) =>
                        setMatchInterestFilter(event.target.value)
                      }
                      placeholder="e.g. Technology, Music..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                    />
                  </div>
                </div>
              </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {matchEnabled && matchProfiles.map((profile) => (
                  <article
                    key={profile.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="flex items-center gap-4 border-b border-slate-100 p-5">
                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-xl font-extrabold text-pink-700">
                          {profile.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-extrabold">
                          {profile.name}
                        </h3>

                        {profile.department && (
                          <p className="mt-1 text-sm text-slate-500">
                            {profile.department}
                          </p>
                        )}

                        {profile.level && (
                          <p className="mt-1 text-xs text-slate-400">
                            {profile.level}
                          </p>
                        )}
                      </div>

                      <Heart className="shrink-0 text-pink-500" size={22} />
                    </div>

                    <div className="p-5">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <GraduationCap
                          size={17}
                          className="shrink-0 text-blue-600"
                        />

                        <span>{profile.campus}</span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        {profile.bio}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {profile.interests.map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <button
                          disabled={matchActionLoading === profile.id}
                          onClick={() => handlePassProfile(profile.id)}
                          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          <X size={17} />
                          Pass
                        </button>

                        <button
                          disabled={matchActionLoading === profile.id}
                          onClick={() => handleLikeProfile(profile.id)}
                          className="flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-pink-700 disabled:opacity-60"
                        >
                          <Heart size={17} />
                          {matchActionLoading === profile.id
                            ? "Saving..."
                            : "Like"}
                        </button>
                      </div>

                      <div className="mt-3 flex justify-end gap-4 text-xs font-semibold">
                        <button
                          type="button"
                          disabled={matchActionLoading === profile.id}
                          onClick={() => handleBlockProfile(profile.id)}
                          className="text-slate-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Block
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMatchReportProfile(profile.id);
                            setMatchReportReason("HARASSMENT");
                            setMatchReportDetails("");
                          }}
                          className="text-slate-500 hover:text-red-700"
                        >
                          Report
                        </button>
                      </div>

                      {matchReportProfile === profile.id && (
                        <form
                          onSubmit={submitVibeCheckReport}
                          className="mt-4 space-y-3 rounded-xl border border-red-100 bg-red-50 p-3"
                        >
                          <label className="block text-xs font-semibold text-slate-700">
                            Report reason
                            <select
                              value={matchReportReason}
                              onChange={(event) =>
                                setMatchReportReason(event.target.value)
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            >
                              <option value="HARASSMENT">Harassment</option>
                              <option value="SPAM">Spam</option>
                              <option value="IMPERSONATION">Impersonation</option>
                              <option value="INAPPROPRIATE">Inappropriate content</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </label>
                          <label className="block text-xs font-semibold text-slate-700">
                            Additional details (optional)
                            <textarea
                              value={matchReportDetails}
                              onChange={(event) =>
                                setMatchReportDetails(event.target.value)
                              }
                              maxLength={500}
                              rows={3}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setMatchReportProfile(null)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white"
                            >
                              Submit report
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {matchEnabled && matchLoading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Loading opted-in student profiles...
                </div>
              )}

              {matchEnabled &&
                !matchLoading &&
                !matchError &&
                matchProfiles.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                  <Heart size={36} className="mx-auto text-pink-400" />

                  <h3 className="mt-3 font-extrabold">No profiles found</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Try changing your filters or check back when more students
                    opt in.
                  </p>

                  <button
                    onClick={resetMatchDiscovery}
                    className="mt-4 rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-700"
                  >
                    Refresh discovery
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={21}
                    className="mt-0.5 shrink-0 text-amber-700"
                  />

                  <div>
                    <h4 className="font-bold text-amber-900">
                      Your privacy matters
                    </h4>

                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      Profiles are visible only to students at your institution
                      who have opted in, whether or not they are verified.
                      Likes create a mutual connection only when both students
                      like each other. Blocked profiles stay hidden, and
                      reports are submitted for review. You can opt out at any
                      time.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
          {activePage === "Profile" && (
            <section className="space-y-5">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="h-28 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700" />
                <div className="px-5 pb-6 sm:px-7">
                  <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex items-end gap-4">
                      <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-blue-100 text-2xl font-extrabold text-blue-700 shadow-sm">
                        {userInitials}
                      </div>
                      <div className="pb-1">
                        <h3 className="text-xl font-extrabold">{fullName}</h3>
                        <p className="mt-1 text-sm capitalize text-slate-500">
                          {user.role || "Student"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActivePage("Settings")}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Settings size={16} className="mr-2 inline" />
                      Account settings
                    </button>
                  </div>
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Email
                      </p>
                      <p className="mt-2 break-words text-sm font-medium text-slate-800">
                        {user.email || "Not provided"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Institution
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-800">
                        {institutionName || "Not set"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Campus
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-800">
                        {campusName || "Not set"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Student verification
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-800">
                        {user.isVerifiedStudent
                          ? "Verified student"
                          : "Not verified"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              </div>
            </section>
          )}
          {activePage === "Marketplace" && (
            <section className="space-y-6">
              {/* Marketplace banner */}
              <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-6 text-white sm:p-8">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                      <ShoppingBag size={15} />
                      STUDENT MARKETPLACE
                    </div>

                    <h3 className="text-2xl font-extrabold sm:text-3xl">
                      Buy and sell on campus
                    </h3>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">
                      Discover products and services offered by students in your
                      campus community.
                    </p>
                  </div>

                  <div className="flex h-20 w-20 shrink-0 items-center justify-center self-center rounded-3xl bg-white/15 sm:self-auto">
                    <ShoppingBag size={40} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMarketplaceNotice("");
                    setListingFormOpen(true);
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  <Plus size={18} />
                  Sell an item
                </button>
                <button
                  type="button"
                  onClick={() => { loadOrders(); setOrdersOpen(true); }}
                  className="ml-3 inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  My orders
                </button>
                <button
                  type="button"
                  onClick={openPayoutSetup}
                  className="ml-3 mt-3 inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 sm:mt-0"
                >
                  Set payout account
                </button>
              </div>

              {marketplaceNotice && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  {marketplaceNotice}
                </div>
              )}

              {/* Search and category filters */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                    <Search size={19} className="shrink-0 text-slate-400" />

                    <input
                      type="search"
                      value={marketplaceSearch}
                      onChange={(event) =>
                        setMarketplaceSearch(event.target.value)
                      }
                      placeholder="Search products..."
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>

                  <select
                    value={marketplaceCategory}
                    onChange={(event) =>
                      setMarketplaceCategory(event.target.value)
                    }
                    aria-label="Filter marketplace by category"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">All categories</option>
                    <option value="electronics">Electronics</option>
                    <option value="fashion">Fashion</option>
                    <option value="books">Books</option>
                    <option value="food">Food</option>
                    <option value="services">Services</option>
                    <option value="school_items">School Items</option>
                    <option value="others">Others</option>
                  </select>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    {filteredMarketplaceListings.length}{" "}
                    {filteredMarketplaceListings.length === 1
                      ? "listing"
                      : "listings"}{" "}
                    found
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setMarketplaceSearch("");
                      setMarketplaceCategory("all");
                      setMarketplaceError("");
                      setActivePage("Marketplace");
                    }}
                    className="text-sm font-semibold text-blue-700 hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              </div>

              {/* Loading state */}
              {marketplaceLoading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />

                  <p className="mt-4 text-sm font-medium text-slate-600">
                    Loading marketplace listings...
                  </p>
                </div>
              )}

              {/* Error state */}
              {!marketplaceLoading && marketplaceError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="font-bold text-red-800">
                    Unable to load marketplace
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-red-700">
                    {marketplaceError}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setMarketplaceError("");
                      loadMarketplaceListings();
                    }}
                    className="mt-4 rounded-xl bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-200"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Empty state */}
              {!marketplaceLoading &&
                !marketplaceError &&
                marketplaceListings.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                      <ShoppingBag size={32} />
                    </div>

                    <h3 className="mt-4 text-lg font-extrabold">
                      No marketplace listings yet
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                      Products listed by students in your campus community will
                      appear here.
                    </p>

                    <button
                      type="button"
                      onClick={() => setListingFormOpen(true)}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800"
                    >
                      <Plus size={18} />
                      List your first item
                    </button>
                  </div>
                )}

              {/* No search results */}
              {!marketplaceLoading &&
                !marketplaceError &&
                marketplaceListings.length > 0 &&
                filteredMarketplaceListings.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                    <Search size={32} className="mx-auto text-slate-400" />

                    <h3 className="mt-3 font-bold text-slate-800">
                      No matching products
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      Try another search term or select a different category.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setMarketplaceSearch("");
                        setMarketplaceCategory("all");
                      }}
                      className="mt-4 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
                    >
                      Show all products
                    </button>
                  </div>
                )}

              {/* Product listings */}
              {!marketplaceLoading &&
                !marketplaceError &&
                filteredMarketplaceListings.length > 0 && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredMarketplaceListings.map((listing) => {
                      const image = Array.isArray(listing.images)
                        ? listing.images[0]
                        : listing.images;

                      const imageUrl = image
                        ? image.startsWith("http")
                          ? image
                          : `http://localhost:5000${
                              image.startsWith("/") ? "" : "/"
                            }${image}`
                        : "";

                      const seller =
                        typeof listing.seller === "object"
                          ? listing.seller?.name
                          : "Campus seller";

                      return (
                        <article
                          key={listing._id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                        >
                          <div className="relative flex h-52 items-center justify-center overflow-hidden bg-slate-100">
                            {imageUrl ? (
                              imageUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i) ? (
                                <video src={imageUrl} controls className="h-full w-full object-cover" />
                              ) : (
                                <img
                                  src={imageUrl}
                                  alt={listing.title || "Marketplace product"}
                                  className="h-full w-full object-cover"
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              )
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-slate-400">
                                <ShoppingBag size={42} />

                                <span className="text-xs">
                                  No product image
                                </span>
                              </div>
                            )}

                            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold capitalize text-blue-700 shadow-sm">
                              {(listing.category || "others").replace(
                                /_/g,
                                " ",
                              )}
                            </span>

                            {listing.condition && (
                              <span className="absolute right-3 top-3 rounded-full bg-slate-900/75 px-3 py-1.5 text-xs font-semibold capitalize text-white">
                                {listing.condition}
                              </span>
                            )}
                          </div>

                          <div className="p-4">
                            <h3 className="line-clamp-2 min-h-12 text-base font-extrabold text-slate-900">
                              {listing.title || "Untitled product"}
                            </h3>

                            <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-500">
                              {listing.description ||
                                "No product description provided."}
                            </p>

                            <div className="mt-4 flex items-center justify-between gap-3">
                              <p className="text-lg font-extrabold text-blue-700">
                                {new Intl.NumberFormat("en-NG", {
                                  style: "currency",
                                  currency: "NGN",
                                  maximumFractionDigits: 2,
                                }).format(Number(listing.price) || 0)}
                              </p>

                              <span className="text-xs text-slate-500">
                                Stock: {listing.stock ?? 1}
                              </span>
                            </div>

                            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                                {(seller || "S")
                                  .split(" ")
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((part) => part[0].toUpperCase())
                                  .join("")}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {seller || "Campus seller"}
                                </p>

                                <p className="text-xs text-slate-500">
                                  Campus Connect seller
                                </p>
                              </div>
                            </div>

                            {String(
                              typeof listing.seller === "object"
                                ? listing.seller?._id || listing.seller?.id
                                : listing.seller,
                            ) === String(user.id) ? (
                              <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-500">
                                This is your listing
                              </p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setOrderForm((current) => ({
                                    ...current,
                                    quantity: "1",
                                  }));
                                  setCheckoutListing(listing);
                                }}
                                className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
                              >
                                Buy now
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

              {listingFormOpen && (
                <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-4">
                  <form
                    onSubmit={submitListing}
                    className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-900">Sell an item</h3>
                        <p className="mt-1 text-sm text-slate-500">Your listing will be visible to students on your campus.</p>
                      </div>
                      <button type="button" onClick={() => setListingFormOpen(false)} aria-label="Close listing form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Item title</span><input required maxLength={120} value={listingForm.title} onChange={(event) => setListingForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="e.g. Calculus textbook" /></label>
                      <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Description</span><textarea required maxLength={1000} rows={4} value={listingForm.description} onChange={(event) => setListingForm((current) => ({ ...current, description: event.target.value }))} className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Describe the item, its condition, and how students can use it." /></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Price (₦)</span><input required min="0" step="0.01" type="number" value={listingForm.price} onChange={(event) => setListingForm((current) => ({ ...current, price: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Quantity available</span><input required min="1" step="1" type="number" value={listingForm.stock} onChange={(event) => setListingForm((current) => ({ ...current, stock: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Category</span><select value={listingForm.category} onChange={(event) => setListingForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-600"><option value="electronics">Electronics</option><option value="fashion">Fashion</option><option value="books">Books</option><option value="food">Food</option><option value="services">Services</option><option value="school_items">School Items</option><option value="others">Others</option></select></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Condition</span><select value={listingForm.condition} onChange={(event) => setListingForm((current) => ({ ...current, condition: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-600"><option value="new">New</option><option value="used">Used</option><option value="fair">Fair</option></select></label>
                      <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Photos <span className="font-normal text-slate-400">(up to 4 files, 25 MB each)</span></span><input type="file" accept="image/*" multiple onChange={(event) => setListingForm((current) => ({ ...current, media: Array.from(event.target.files || []) }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" /></label>
                      <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><input required type="checkbox" checked={listingForm.sellerTermsAccepted} onChange={(event) => setListingForm((current) => ({ ...current, sellerTermsAccepted: event.target.checked }))} className="mt-0.5 h-4 w-4" /><span>I confirm that this listing is genuine, I will not engage in fraudulent activity, and I accept Campus Connect’s 7% commission on each completed sale plus any applicable marketplace terms.</span></label>
                    </div>
                    <button type="submit" disabled={marketplaceSubmitting} className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{marketplaceSubmitting ? "Publishing..." : "Publish listing"}</button>
                  </form>
                </div>
              )}

              {checkoutListing && (
                <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-4">
                  <form onSubmit={startCheckout} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-7">
                    <div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-extrabold text-slate-900">Checkout</h3><p className="mt-1 text-sm text-slate-500">{checkoutListing.title} · ₦{Number(checkoutListing.price).toLocaleString()}</p></div><button type="button" onClick={() => setCheckoutListing(null)} aria-label="Close checkout" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button></div>
                    <div className="mt-6 space-y-4">
                      <label><span className="mb-1.5 block text-sm font-semibold">Quantity</span><input required min="1" max={checkoutListing.stock} type="number" value={orderForm.quantity} onChange={(event) => setOrderForm((current) => ({ ...current, quantity: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
                      <fieldset><legend className="mb-2 text-sm font-semibold">Delivery method</legend><div className="space-y-2"><label className={`block cursor-pointer rounded-xl border p-3 ${orderForm.deliveryMethod === "SELLER_TO_BUYER" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><input className="mr-2" type="radio" name="deliveryMethod" value="SELLER_TO_BUYER" checked={orderForm.deliveryMethod === "SELLER_TO_BUYER"} onChange={(event) => setOrderForm((current) => ({ ...current, deliveryMethod: event.target.value }))} /><span className="font-bold">Seller to buyer</span><span className="mt-1 block pl-5 text-xs text-slate-600">No Campus Connect delivery charge. The seller delivers; give the seller your OTP only after receiving the item.</span></label><label className={`block cursor-pointer rounded-xl border p-3 ${orderForm.deliveryMethod === "MIDDLEMAN" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><input className="mr-2" type="radio" name="deliveryMethod" value="MIDDLEMAN" checked={orderForm.deliveryMethod === "MIDDLEMAN"} onChange={(event) => setOrderForm((current) => ({ ...current, deliveryMethod: event.target.value }))} /><span className="font-bold">Campus Connect middleman</span><span className="mt-1 block pl-5 text-xs text-slate-600">A Campus Connect middleman handles pickup and delivery. ₦500 campus delivery charge applies.</span></label></div></fieldset>
                      <label><span className="mb-1.5 block text-sm font-semibold">Delivery location</span><input required value={orderForm.deliveryAddress} onChange={(event) => setOrderForm((current) => ({ ...current, deliveryAddress: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Hostel, department, or campus pickup point" /></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Phone number</span><input required type="tel" value={orderForm.deliveryPhone} onChange={(event) => setOrderForm((current) => ({ ...current, deliveryPhone: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="080..." /></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Note to seller <span className="font-normal text-slate-400">(optional)</span></span><textarea maxLength={500} rows={3} value={orderForm.buyerNote} onChange={(event) => setOrderForm((current) => ({ ...current, buyerNote: event.target.value }))} className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
                    </div>
                    <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{orderForm.deliveryMethod === "MIDDLEMAN" ? "₦500 middleman delivery fee will be added at checkout." : "The seller will arrange direct delivery with you."}</p><button type="submit" disabled={marketplaceSubmitting} className="mt-4 w-full rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{marketplaceSubmitting ? "Opening secure checkout..." : "Continue to secure payment"}</button>
                  </form>
                </div>
              )}

              {ordersOpen && (
                <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-4">
                  <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7">
                    <div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-extrabold">My orders</h3><p className="mt-1 text-sm text-slate-500">Track purchases and orders placed for your listings.</p></div><button type="button" onClick={() => setOrdersOpen(false)} aria-label="Close orders" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button></div>
                    {ordersLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading orders...</p> : orders.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">You do not have any orders yet.</p> : <div className="mt-5 space-y-3">{orders.map((order) => {
                      const isSeller = String(order.seller?._id || order.seller) === String(user.id);
                      return <article key={order._id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-extrabold text-slate-900">{order.listing?.title || "Marketplace item"}</p><p className="mt-1 text-sm text-slate-500">{isSeller ? `Buyer: ${order.buyer?.name || "Student"}` : `Seller: ${order.seller?.name || "Student"}`}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{order.status.replaceAll("_", " ")}</span></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600"><span>₦{Number(order.totalAmount).toLocaleString()}</span><span>Qty: {order.quantity}</span><span>Payment: {order.paymentStatus}</span><span>Delivery: {order.deliveryStatus}</span></div><p className="mt-3 text-sm font-semibold text-slate-700">{order.deliveryMethod === "MIDDLEMAN" ? `Campus Connect middleman · ₦${Number(order.deliveryFee || 0).toLocaleString()} fee` : "Seller-to-buyer delivery"}</p>{isSeller && <p className="mt-1 text-xs text-slate-500">Campus Connect commission: ₦{Number(order.platformCommission || 0).toLocaleString()} · Your payout after OTP verification: ₦{Number(order.sellerPayoutAmount || 0).toLocaleString()}</p>}{(isSeller || (order.deliveryMethod === "MIDDLEMAN" && user.role === "admin")) && order.status === "DELIVERED" && <div className="mt-4 flex gap-2"><input inputMode="numeric" maxLength={6} value={deliveryOtpInputs[order._id] || ""} onChange={(event) => setDeliveryOtpInputs((current) => ({ ...current, [order._id]: event.target.value }))} placeholder="Buyer’s 6-digit OTP" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button type="button" onClick={() => verifyDeliveryOtp(order._id)} className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-bold text-white">Verify</button></div>}<p className="mt-3 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</p></article>;
                    })}</div>}
                  </div>
                </div>
              )}

              {payoutSetupOpen && (
                <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-4">
                  <form onSubmit={savePayoutAccount} className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-7">
                    <div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-extrabold">Seller payout account</h3><p className="mt-1 text-sm text-slate-500">Verified through Paystack test mode. Your account number is not stored.</p></div><button type="button" onClick={() => setPayoutSetupOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button></div>
                    <div className="mt-6 space-y-4"><label><span className="mb-1.5 block text-sm font-semibold">Bank</span><select required value={payoutForm.bankCode} onChange={(event) => setPayoutForm((current) => ({ ...current, bankCode: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="">Choose your bank</option>{banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></label><label><span className="mb-1.5 block text-sm font-semibold">10-digit account number</span><input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={payoutForm.accountNumber} onChange={(event) => setPayoutForm((current) => ({ ...current, accountNumber: event.target.value.replace(/\D/g, "") }))} className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="0123456789" /></label></div><button type="submit" disabled={marketplaceSubmitting} className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-60">{marketplaceSubmitting ? "Verifying..." : "Verify and save account"}</button>
                  </form>
                </div>
              )}

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={22}
                    className="mt-0.5 shrink-0 text-blue-700"
                  />

                  <div>
                    <h4 className="font-bold text-blue-900">
                      Shop with confidence
                    </h4>

                    <p className="mt-1 text-sm leading-6 text-blue-800">
                      Confirm the product details before paying. Payments are
                      processed through the secure checkout page.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activePage !== "Home Feed" &&
            activePage !== "Campus News" &&
            activePage !== "Campus Services" &&
            activePage !== "Campus Match" &&
            activePage !== "Messages" &&
            activePage !== "Admin Dashboard" &&
            activePage !== "Profile" &&
            activePage !== "Marketplace" && (
              <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <h3 className="font-bold text-blue-900">
                  {activePage} is ready for development
                </h3>

                <p className="mt-2 text-sm leading-6 text-blue-800">
                  This section will be connected to the backend in the next
                  stages.
                </p>
              </div>
            )}
          {activePage === "Home Feed" && (
            <>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-extrabold">Campus Feed</h3>

                <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                  Latest posts
                </span>
              </div>

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
                            likedPosts.includes(post.id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                        {post.likes + (likedPosts.includes(post.id) ? 1 : 0)}{" "}
                        Likes
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          window.alert(
                            "Comments will be available when the comments feature is connected.",
                          )
                        }
                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      >
                        <MessageSquare size={18} />
                        {post.comments} Comments
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              `${post.name}: ${post.text}`,
                            );

                            window.alert("Post copied to clipboard.");
                          } catch {
                            window.alert(
                              "Unable to copy this post on your device.",
                            );
                          }
                        }}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      >
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
            </>
          )}
          <footer className="py-8 text-center text-xs text-slate-400">
            Campus Connect · Connecting students, building communities.
          </footer>
        </main>

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
                  onClick={() => {
                    setSearch(trend.tag.replace("#", ""));
                    setActivePage("Home Feed");
                  }}
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

            <button
              onClick={() => setActivePage("Home Feed")}
              className="mt-5 text-sm font-bold text-blue-700 hover:underline"
            >
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

              <button
                onClick={() => setActivePage("Campus Services")}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Store size={19} />
                </div>

                <div>
                  <p className="text-sm font-semibold">Campus Services</p>

                  <p className="mt-1 text-xs text-slate-500">
                    Find local businesses and essential services
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActivePage("Campus Match")}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-pink-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                  <Heart size={19} />
                </div>

                <div>
                  <p className="text-sm font-semibold">VibeCheck</p>

                  <p className="mt-1 text-xs text-slate-500">
                    Discover shared interests
                  </p>
                </div>
              </button>
            </div>
          </section>
        </aside>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between overflow-x-auto px-1 sm:px-4">
          {bottomNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.page;

            return (
              <button
                key={item.page}
                type="button"
                onClick={() => {
                  setActivePage(item.page);
                  setMobileMenuOpen(false);
                  setNotificationsOpen(false);
                }}
                className={`relative flex min-w-[68px] flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors sm:min-w-0 ${
                  isActive
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-blue-600"
                }`}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />

                  {item.page === "Messages" && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      3
                    </span>
                  )}
                </span>

                <span
                  className={`whitespace-nowrap text-[9px] sm:text-xs ${
                    isActive ? "font-semibold" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>

                {isActive && (
                  <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
