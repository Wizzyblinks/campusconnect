import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  API_URL,
  apiRequest,
  expireSession,
  getTokenExpiration,
  SESSION_EXPIRED_EVENT,
} from "./services/api.js";
import Auth from "./Auth.jsx";
import { CampusServices } from "./CampusServices.jsx";
import Messages from "./Messages.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import PostComposer from "./PostComposer.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import StudentSuggestions from "./StudentSuggestions.jsx";
import { getThemePreference, persistThemePreference } from "./services/themePreference.js";
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
  { name: "Seller Dashboard", icon: Store, sellerOnly: true },
  { name: "Study Centre", icon: BookOpen },
  { name: "Campus News", icon: Newspaper },
  { name: "Messages", icon: MessageCircle },
  { name: "Communities", icon: Users },
  { name: "Cafeteria", icon: Utensils },
  { name: "Campus Services", icon: Store },
  { name: "Campus Match", label: "VibeCheck", icon: Heart, highlight: true },
  { name: "Discover Students", icon: GraduationCap },
  { name: "Admin Dashboard", icon: ShieldCheck, adminOnly: true },
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

const normalizePost = (post, institutionLabel = "Campus Connect Student") => {
  const author = post.author || {};
  const name = author.name || "Student";
  return {
    id: post._id,
    authorId: String(author._id || author),
    name,
    initials: name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "ST",
    university: institutionLabel,
    time: post.createdAt ? new Date(post.createdAt).toLocaleString() : "Just now",
    text: post.text || "",
    category: "General",
    likes: post.likesCount || 0,
    comments: post.commentsCount || 0,
    shares: post.sharesCount || 0,
    likedByMe: Boolean(post.likedByMe),
    visibility: post.visibility || "campus",
    color: "bg-blue-600",
    verified: Boolean(author.isVerifiedStudent),
    media: post.media,
  };
};

function App() {
  const [user, setUser] = useState(getSavedUser);
  const [theme, setTheme] = useState(getThemePreference);
  const [activePage, setActivePage] = useState("Home Feed");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [postsReload, setPostsReload] = useState(0);
  const [postComposerOpen, setPostComposerOpen] = useState(false);
  const [postNotice, setPostNotice] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);
  const [profileMessageRecipientId, setProfileMessageRecipientId] = useState("");
  const [profileReturnPage, setProfileReturnPage] = useState("");
  const [followListDialog, setFollowListDialog] = useState(null);
  const [followRequests, setFollowRequests] = useState({ incoming: [], outgoing: [] });
  const [followRequestsError, setFollowRequestsError] = useState("");
  const [followActionLoading, setFollowActionLoading] = useState("");
  const [trending, setTrending] = useState({ posts: [], hashtags: [] });
  const [trendingError, setTrendingError] = useState("");
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [feedPage, setFeedPage] = useState(1);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [postActionError, setPostActionError] = useState("");
  const [postActionNotice, setPostActionNotice] = useState("");
  const [pendingPostLikes, setPendingPostLikes] = useState(() => new Set());
  const [editingPost, setEditingPost] = useState(null);
  const [postEditSaving, setPostEditSaving] = useState(false);
  const [commentsForPost, setCommentsForPost] = useState("");
  const [postComments, setPostComments] = useState([]);
  const [commentReplies, setCommentReplies] = useState({});
  const [commentReplyTo, setCommentReplyTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentEditSaving, setCommentEditSaving] = useState(false);
  const [activeTrendTag, setActiveTrendTag] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messageSocket, setMessageSocket] = useState(null);
  const [notificationConversationId, setNotificationConversationId] = useState("");

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsReload, setNotificationsReload] = useState(0);
  const notificationIds = useRef(new Set());
  const profileRequestId = useRef(0);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    persistThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setSellerStatus({ eligible: false, legacySeller: false, application: null });
      setSellerListings([]);
      return () => { active = false; };
    }

    apiRequest("/api/marketplace/seller-status")
      .then((data) => {
        if (!active) return;
        const nextStatus = {
          eligible: Boolean(data.eligible),
          legacySeller: Boolean(data.legacySeller),
          application: data.application || null,
        };
        setSellerStatus(nextStatus);
        if (!nextStatus.eligible) setSellerListings([]);
        setSellerStatusError("");
      })
      .catch((error) => {
        if (active) setSellerStatusError(error.message || "We couldn't check seller application status.");
      });

    return () => { active = false; };
  }, [user]);

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

  useEffect(() => {
    if (!user) return undefined;
    const token = localStorage.getItem("token");
    const handleSessionExpired = () => {
      setUser(null);
      setActivePage("Home Feed");
      setMobileMenuOpen(false);
      setNotificationsOpen(false);
      setPosts([]);
      setSelectedSearchResult(null);
      setNotifications([]);
      setUnreadNotifications(0);
      setNotificationsError("");
      setUnreadMessages(0);
      setNotificationConversationId("");
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    if (!token) {
      handleSessionExpired();
      return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    }

    const checkExpiration = () => {
      const expiresAt = getTokenExpiration(token);
      if (!expiresAt || expiresAt <= Date.now()) expireSession(token);
    };
    const expiresAt = getTokenExpiration(token);
    const timer = expiresAt
      ? setTimeout(() => expireSession(token), Math.max(0, expiresAt - Date.now()))
      : null;
    window.addEventListener("focus", checkExpiration);
    document.addEventListener("visibilitychange", checkExpiration);
    checkExpiration();

    return () => {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener("focus", checkExpiration);
      document.removeEventListener("visibilitychange", checkExpiration);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setNotificationsLoading(false);
      setUnreadNotifications(0);
      setNotificationsError("");
      notificationIds.current = new Set();
      return undefined;
    }

    let cancelled = false;
    setNotificationsLoading(true);
    setNotificationsError("");
    apiRequest("/api/notifications")
      .then((data) => {
        if (cancelled) return;
        const loaded = Array.isArray(data.notifications) ? data.notifications : [];
        setNotifications(loaded);
        notificationIds.current = new Set(loaded.map((item) => String(item._id)));
        setUnreadNotifications(Number(data.unreadCount) || 0);
      })
      .catch((error) => {
        if (!cancelled) {
          setNotificationsError(error.message || "We couldn't load your notifications.");
        }
      })
      .finally(() => {
        if (!cancelled) setNotificationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, notificationsReload]);

  useEffect(() => {
    if (user && activePage === "Profile") loadFollowRequests();
  }, [activePage, user]);

  useEffect(() => {
    if (!messageSocket) return undefined;
    const handleNotification = ({ notification } = {}) => {
      if (!notification?._id) return;
      const notificationId = String(notification._id);
      if (!notificationIds.current.has(notificationId)) {
        notificationIds.current.add(notificationId);
        if (!notification.readAt) {
          setUnreadNotifications((count) => count + 1);
        }
      }
      setNotifications((current) => [
        notification,
        ...current.filter((item) => String(item._id) !== notificationId),
      ].slice(0, 50));
    };
    const handleNotificationRead = ({ all, notificationId, unreadCount } = {}) => {
      setNotifications((current) => current.map((item) => {
        if (all || String(item._id) === String(notificationId)) {
          return { ...item, readAt: item.readAt || new Date().toISOString() };
        }
        return item;
      }));
      if (Number.isFinite(unreadCount)) setUnreadNotifications(unreadCount);
    };
    messageSocket.on("notification:new", handleNotification);
    messageSocket.on("notification:read", handleNotificationRead);
    return () => {
      messageSocket.off("notification:new", handleNotification);
      messageSocket.off("notification:read", handleNotificationRead);
    };
  }, [messageSocket]);

  useEffect(() => {
    if (!user || !localStorage.getItem("token")) return undefined;
    let cancelled = false;
    setPostsLoading(true);
    setPostsError("");
    apiRequest("/api/posts")
      .then((data) => {
        if (!cancelled) {
          const label =
            (typeof user?.institution === "object" && user.institution !== null
              ? user.institution.name || user.institution.shortName
              : user?.institutionName) || "Campus Connect Student";
          setPosts((Array.isArray(data.posts) ? data.posts : []).map((post) => normalizePost(post, label)));
          setFeedPage(data.page || 1);
          setFeedHasMore(Boolean(data.hasMore));
        }
      })
      .catch((error) => {
        if (!cancelled) setPostsError(error.message || "We couldn't load posts. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, postsReload]);

  useEffect(() => {
    if (!user || activePage !== "Home Feed") return undefined;
    let cancelled = false;
    setTrendingLoading(true);
    setTrendingError("");
    apiRequest("/api/search/trending")
      .then((data) => {
        if (!cancelled) setTrending({ posts: data.posts || [], hashtags: data.hashtags || [] });
      })
      .catch((error) => {
        if (!cancelled) setTrendingError(error.message || "We couldn't load current trends.");
      })
      .finally(() => {
        if (!cancelled) setTrendingLoading(false);
      });
    return () => { cancelled = true; };
  }, [activePage, user, postsReload]);

  useEffect(() => {
    if (!user) return;
    const sharedPostId = new URLSearchParams(window.location.search).get("post");
    if (!sharedPostId) return;
    let cancelled = false;
    apiRequest(`/api/posts/${encodeURIComponent(sharedPostId)}`)
      .then((data) => {
        if (cancelled) return;
        const post = normalizePost(data.post);
        setPosts((current) => current.some((item) => item.id === post.id)
          ? current.map((item) => item.id === post.id ? post : item)
          : [post, ...current]);
        setActivePage("Home Feed");
        setSelectedSearchResult({ type: "posts", item: post });
      })
      .catch((error) => {
        if (!cancelled) setPostActionError(error.message || "This post isn't available.");
      });
    return () => { cancelled = true; };
  }, [user]);

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
  const [dashboardView, setDashboardView] = useState("buyer");
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");
  const [sellerListings, setSellerListings] = useState([]);
  const [sellerListingsLoading, setSellerListingsLoading] = useState(false);
  const [sellerListingsError, setSellerListingsError] = useState("");
  const [sellerStatus, setSellerStatus] = useState({ eligible: false, legacySeller: false, application: null });
  const [sellerStatusError, setSellerStatusError] = useState("");
  const [sellerApplicationOpen, setSellerApplicationOpen] = useState(false);
  const [sellerApplicationSaving, setSellerApplicationSaving] = useState(false);
  const [sellerApplicationForm, setSellerApplicationForm] = useState({
    businessName: "",
    categories: [],
    description: "",
  });
  const [editingListingId, setEditingListingId] = useState("");
  const [listingActionId, setListingActionId] = useState("");
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
    existingImages: [],
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
    setOrdersError("");
    try {
      const data = await apiRequest("/api/orders");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      setOrders([]);
      setOrdersError(error.message || "We couldn't load your orders.");
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadSellerListings() {
    setSellerListingsLoading(true);
    setSellerListingsError("");
    try {
      const data = await apiRequest("/api/marketplace/mine");
      setSellerListings(Array.isArray(data.listings) ? data.listings : []);
    } catch (error) {
      setSellerListings([]);
      setSellerListingsError(error.message || "We couldn't load your listings.");
    } finally {
      setSellerListingsLoading(false);
    }
  }

  async function loadSellerStatus() {
      setSellerStatusError("");
      try {
        const data = await apiRequest("/api/marketplace/seller-status");
        const nextStatus = {
          eligible: Boolean(data.eligible),
          legacySeller: Boolean(data.legacySeller),
          application: data.application || null,
        };
        setSellerStatus(nextStatus);
        if (!nextStatus.eligible) setSellerListings([]);
        return nextStatus;
      } catch (error) {
        setSellerStatusError(error.message || "We couldn't check seller application status.");
        return null;
      }
  }

  async function submitSellerApplication(event) {
      event.preventDefault();
      setSellerApplicationSaving(true);
      setMarketplaceError("");
      try {
        const data = await apiRequest("/api/marketplace/seller-application", {
          method: "POST",
          body: JSON.stringify(sellerApplicationForm),
        });
        setSellerStatus({
          eligible: false,
          legacySeller: false,
          application: data.application,
        });
        setSellerApplicationOpen(false);
        setSellerApplicationForm({ businessName: "", categories: [], description: "" });
        setMarketplaceNotice(data.message || "Your seller application was submitted.");
      } catch (error) {
        setMarketplaceError(error.message || "We couldn't submit your seller application.");
      } finally {
        setSellerApplicationSaving(false);
    }
  }

  function resetListingForm() {
    setListingForm({
      title: "",
      description: "",
      price: "",
      category: "electronics",
      condition: "new",
      stock: "1",
      media: [],
      existingImages: [],
      sellerTermsAccepted: false,
    });
    setEditingListingId("");
    setListingFormOpen(false);
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
    loadOrders();
    loadSellerStatus().then((status) => {
      if (status?.eligible) loadSellerListings();
    });
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
      if (editingListingId) {
        formData.append("images", JSON.stringify(listingForm.existingImages));
      } else {
        formData.append("sellerTermsAccepted", String(listingForm.sellerTermsAccepted));
      }
      listingForm.media.forEach((file) => formData.append("media", file));

      const data = await apiRequest(
        editingListingId ? `/api/marketplace/${editingListingId}` : "/api/marketplace",
        {
        method: editingListingId ? "PATCH" : "POST",
        body: formData,
      });

      setMarketplaceListings((current) => {
        const next = current.filter((listing) => listing._id !== data.listing._id);
        return data.listing.status === "active" && data.listing.stock > 0
          ? [data.listing, ...next]
          : next;
      });
      setSellerListings((current) => [
        data.listing,
        ...current.filter((listing) => listing._id !== data.listing._id),
      ]);
      resetListingForm();
      setMarketplaceNotice(editingListingId
        ? "Your listing has been updated."
        : "Your item is now listed in the marketplace.");
      const eligibility = await loadSellerStatus();
      if (eligibility?.eligible) await loadSellerListings();
    } catch (error) {
      setMarketplaceError(error.message || "Could not create your listing.");
    } finally {
      setMarketplaceSubmitting(false);
    }
  }

  async function changeListingStatus(listing) {
    const restoring = listing.status === "hidden";
    if (!restoring && !window.confirm("Take this listing down from the public marketplace? Existing orders and payment records will remain unchanged.")) {
      return;
    }
    setListingActionId(listing._id);
    setMarketplaceError("");
    try {
      const data = await apiRequest(`/api/marketplace/${listing._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: restoring ? "active" : "hidden" }),
      });
      setSellerListings((current) => current.map((item) =>
        item._id === listing._id ? data.listing : item,
      ));
      setMarketplaceListings((current) => {
        const next = current.filter((item) => item._id !== listing._id);
        return data.listing.status === "active" && data.listing.stock > 0
          ? [data.listing, ...next]
          : next;
      });
      setMarketplaceNotice(restoring ? "Your listing is back in the marketplace." : "Your listing has been taken down.");
    } catch (error) {
      setMarketplaceError(error.message || "We couldn't update this listing.");
    } finally {
      setListingActionId("");
    }
  }

  function editListing(listing) {
    setOrdersOpen(false);
    setEditingListingId(listing._id);
    setListingForm({
      title: listing.title || "",
      description: listing.description || "",
      price: String(listing.price ?? ""),
      category: listing.category || "others",
      condition: listing.condition || "new",
      stock: String(listing.stock ?? 0),
      media: [],
      existingImages: Array.isArray(listing.images) ? listing.images : [],
      sellerTermsAccepted: true,
    });
    setMarketplaceError("");
    setListingFormOpen(true);
  }

  function selectListingMedia(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length + listingForm.existingImages.length > 4) {
      setMarketplaceError("A listing can have no more than four photos.");
      return;
    }
    if (files.some((file) => !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type))) {
      setMarketplaceError("Choose JPG, PNG, GIF, or WebP image files.");
      return;
    }
    if (files.some((file) => file.size > 25 * 1024 * 1024)) {
      setMarketplaceError("Each listing photo must be 25 MB or smaller.");
      return;
    }
    setMarketplaceError("");
    setListingForm((current) => ({ ...current, media: files }));
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
    apiRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
    setActivePage("Home Feed");
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
    setPosts([]);
    setSelectedSearchResult(null);
    setNotifications([]);
    setUnreadNotifications(0);
    setUnreadMessages(0);
    setNotificationConversationId("");
  }

  async function saveProfileSettings(event) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileNotice("");
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    delete body.discoverable;
    delete body.profileVisibility;
    delete body.defaultPostVisibility;
    body.privacy = {
      discoverable: formData.get("discoverable") === "on",
      profileVisibility: formData.get("profileVisibility"),
      defaultPostVisibility: formData.get("defaultPostVisibility"),
    };
    try {
      const data = await apiRequest("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const updatedUser = { ...user, ...data.user };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setProfileNotice("Your profile settings have been saved.");
    } catch (error) {
      setProfileError(error.message || "We couldn't save your profile settings.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function changeAccountPassword(event) {
    event.preventDefault();
    setPasswordSaving(true);
    setProfileError("");
    setProfileNotice("");
    try {
      const data = await apiRequest("/api/profile/password", {
        method: "PATCH",
        body: JSON.stringify(passwordForm),
      });
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setProfileNotice(data.message || "Password updated. Please log in again.");
      window.setTimeout(handleLogout, 1500);
    } catch (error) {
      setProfileError(error.message || "We couldn't update your password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  function addPublishedPost(post) {
    setPosts((previous) => [normalizePost(post, institutionName || campusName), ...previous]);
    setPostComposerOpen(false);
    setPostNotice("Your post has been published successfully.");
  }

  async function togglePostLike(post) {
    if (pendingPostLikes.has(post.id)) return;
    const likedByMe = !post.likedByMe;
    setPendingPostLikes((current) => new Set(current).add(post.id));
    setPostActionError("");
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, likedByMe, likes: Math.max(0, item.likes + (likedByMe ? 1 : -1)) }
      : item));
    try {
      const result = await apiRequest(`/api/posts/${post.id}/like`, {
        method: likedByMe ? "POST" : "DELETE",
      });
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, likedByMe: result.liked, likes: result.likesCount }
        : item));
    } catch (error) {
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, likedByMe: post.likedByMe, likes: post.likes }
        : item));
      setPostActionError(error.message || "We couldn't update your like.");
    } finally {
      setPendingPostLikes((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  }

  async function openPostComments(postId) {
    if (commentsForPost === postId) {
      setCommentsForPost("");
      return;
    }
    setCommentsForPost(postId);
    setCommentsLoading(true);
    setPostActionError("");
    setCommentReplies({});
    setCommentReplyTo(null);
    setEditingComment(null);
    try {
      const data = await apiRequest(`/api/posts/${postId}/comments`);
      setPostComments(data.comments || []);
    } catch (error) {
      setPostActionError(error.message || "We couldn't load comments.");
      setPostComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function submitPostComment(event, postId) {
    event.preventDefault();
    const text = commentDraft.trim();
    if (!text || commentSaving) return;
    setCommentSaving(true);
    setPostActionError("");
    try {
      const data = await apiRequest(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ text, ...(commentReplyTo ? { parent: commentReplyTo._id } : {}) }),
      });
      if (commentReplyTo) {
        setCommentReplies((current) => ({
          ...current,
          [commentReplyTo._id]: [...(current[commentReplyTo._id] || []), data.comment],
        }));
      } else {
        setPostComments((current) => [...current, data.comment]);
      }
      setPosts((current) => current.map((post) => post.id === postId
        ? { ...post, comments: data.commentsCount }
        : post));
      setCommentDraft("");
      setCommentReplyTo(null);
    } catch (error) {
      setPostActionError(error.message || "We couldn't add your comment.");
    } finally {
      setCommentSaving(false);
    }
  }

  async function loadCommentReplies(postId, commentId) {
    try {
      const data = await apiRequest(`/api/posts/${postId}/comments?parent=${commentId}`);
      setCommentReplies((current) => ({ ...current, [commentId]: data.comments || [] }));
    } catch (error) {
      setPostActionError(error.message || "We couldn't load replies.");
    }
  }

  async function saveCommentEdit(event, comment) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = String(formData.get("text") || "").trim();
    if (!text || commentEditSaving) return;
    setCommentEditSaving(true);
    setPostActionError("");
    try {
      const data = await apiRequest(`/api/posts/comments/${comment._id}`, {
        method: "PATCH",
        body: JSON.stringify({ text }),
      });
      const replaceComment = (items) => items.map((item) => item._id === comment._id ? data.comment : item);
      setPostComments(replaceComment);
      setCommentReplies((current) => Object.fromEntries(
        Object.entries(current).map(([id, items]) => [id, replaceComment(items)]),
      ));
      setEditingComment(null);
    } catch (error) {
      setPostActionError(error.message || "We couldn't update your comment.");
    } finally {
      setCommentEditSaving(false);
    }
  }

  async function removeComment(comment) {
    if (!window.confirm("Delete this comment?")) return;
    setPostActionError("");
    try {
      await apiRequest(`/api/posts/comments/${comment._id}`, { method: "DELETE" });
      const markDeleted = (items) => items.map((item) =>
        item._id === comment._id ? { ...item, isDeleted: true, text: "" } : item,
      );
      setPostComments(markDeleted);
      setCommentReplies((current) => Object.fromEntries(
        Object.entries(current).map(([id, items]) => [id, markDeleted(items)]),
      ));
      setPosts((current) => current.map((post) => post.id === commentsForPost
        ? { ...post, comments: Math.max(0, post.comments - 1) }
        : post));
    } catch (error) {
      setPostActionError(error.message || "We couldn't delete your comment.");
    }
  }

  async function sharePost(post) {
    const url = new URL(window.location.href);
    url.searchParams.set("post", post.id);
    const shareData = { title: `Post by ${post.name}`, text: post.text, url: url.toString() };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(url.toString());
      const data = await apiRequest(`/api/posts/${post.id}/share`, { method: "POST" });
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, shares: data.sharesCount }
        : item));
      setPostActionNotice(navigator.share ? "Post shared." : "A link to the post was copied.");
    } catch (error) {
      if (error.name === "AbortError") return;
      setPostActionError(error.message || "We couldn't share this post.");
    }
  }

  async function savePostEdit(event) {
    event.preventDefault();
    if (!editingPost) return;
    const formData = new FormData(event.currentTarget);
    setPostEditSaving(true);
    setPostActionError("");
    try {
      const result = await apiRequest(`/api/posts/${editingPost.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          text: formData.get("text"),
          visibility: formData.get("visibility"),
        }),
      });
      const updated = normalizePost(result.post, institutionName || campusName);
      setPosts((current) => current.map((post) => post.id === updated.id ? { ...post, ...updated } : post));
      setEditingPost(null);
      setPostActionNotice("Your post has been updated.");
    } catch (error) {
      setPostActionError(error.message || "We couldn't update your post.");
    } finally {
      setPostEditSaving(false);
    }
  }

  async function removePost(postId) {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await apiRequest(`/api/posts/${postId}`, { method: "DELETE" });
      setPosts((current) => current.filter((post) => post.id !== postId));
      setPostActionNotice("Your post has been deleted.");
    } catch (error) {
      setPostActionError(error.message || "We couldn't delete your post.");
    }
  }

  async function reportPost(postId) {
    const reason = window.prompt("Choose a reason: spam, harassment, misinformation, inappropriate, or other", "other");
    if (reason === null) return;
    if (!["spam", "harassment", "misinformation", "inappropriate", "other"].includes(reason.trim().toLowerCase())) {
      setPostActionError("Choose spam, harassment, misinformation, inappropriate, or other as the reason.");
      return;
    }
    const details = window.prompt("Add details for campus moderators (optional, up to 500 characters):");
    if (details === null) return;
    try {
      const data = await apiRequest(`/api/posts/${postId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim().toLowerCase(), details }),
      });
      setPostActionNotice(data.message || "Your report has been sent to campus moderators.");
      setPostActionError("");
    } catch (error) {
      setPostActionError(error.message || "We couldn't send your report.");
    }
  }

  async function openUserProfile(profileReference) {
    const requestId = ++profileRequestId.current;
    setPostActionError("");
    setProfileError("");
    setProfileNotice("");
    const targetId = profileReference?._id || profileReference?.id || profileReference;
    if (!targetId) {
      return;
    }

    if (String(targetId) === String(user?._id || user?.id || "")) {
      setActivePage("Profile");
      setSelectedSearchResult(null);
      return;
    }

    setSelectedSearchResult(null);
    try {
      const data = await apiRequest(`/api/discovery/profiles/${encodeURIComponent(String(targetId))}`);
      if (requestId === profileRequestId.current) {
        setSelectedSearchResult({ type: "students", item: data.profile });
      }
    } catch (error) {
      if (requestId === profileRequestId.current) {
        setProfileError(error.message || "We couldn't open that profile.");
      }
    }
  }

  function openProfileConversation(profile) {
    const recipientId = String(profile?.id || profile?._id || "");
    if (!recipientId) return;
    setProfileReturnPage(activePage === "Messages" ? "" : activePage);
    setProfileMessageRecipientId(recipientId);
    setSelectedSearchResult(null);
    setActivePage("Messages");
  }

  async function selectSearchResult(type, item) {
    setPostActionError("");
    if (type === "students") {
      await openUserProfile(item);
      return;
    }
    try {
      if (type === "posts") {
        const data = await apiRequest(`/api/posts/${item._id || item.id}`);
        const post = normalizePost(data.post, institutionName || campusName);
        setPosts((current) => current.some((existing) => existing.id === post.id)
          ? current.map((existing) => existing.id === post.id ? post : existing)
          : [post, ...current]);
        setSelectedSearchResult({ type, item: post });
        setActivePage("Home Feed");
      } else if (type === "marketplace") {
        setActivePage("Marketplace");
        setSelectedSearchResult({ type, item });
      } else if (type === "news") {
        setActivePage("Campus News");
        setSelectedSearchResult({ type, item });
      } else {
        setActivePage("Communities");
        setSelectedSearchResult({ type, item });
      }
    } catch (error) {
      setPostActionError(error.message || "We couldn't open that result.");
    }
  }

  async function updateFollowAction(profile, action) {
    const profileId = String(profile?.id || profile?._id || "");
    if (!profileId) return;
    setFollowActionLoading(profileId);
    setProfileError("");
    try {
      const data = await apiRequest(
        `/api/follows/${encodeURIComponent(profileId)}`,
        {
          method: action === "request" ? "POST" : "PATCH",
          ...(action === "request"
            ? {}
            : { body: JSON.stringify({ action }) }),
        },
      );
      const selectedProfileId = selectedSearchResult?.type === "students"
        ? String(selectedSearchResult.item.id || selectedSearchResult.item._id || "")
        : "";
      if (selectedProfileId === profileId) {
        try {
          const fresh = await apiRequest(
            `/api/discovery/profiles/${encodeURIComponent(profileId)}`,
          );
          setSelectedSearchResult({ type: "students", item: fresh.profile });
        } catch {
          setSelectedSearchResult(null);
        }
      }
      if (["accept", "decline", "cancel"].includes(action)) {
        await refreshFollowRequests();
      }
      setProfileNotice(data.message || "Follow details updated.");
    } catch (error) {
      setProfileError(error.message || "We couldn't update this follow request.");
    } finally {
      setFollowActionLoading("");
    }
  }

  async function refreshFollowRequests() {
    try {
      const data = await apiRequest("/api/follows/requests");
      setFollowRequests({
        incoming: data.incoming || [],
        outgoing: data.outgoing || [],
      });
      setFollowRequestsError("");
    } catch (error) {
      setFollowRequestsError(error.message || "We couldn't load your follow requests.");
    }
  }

  async function loadFollowList(profileId, list) {
    setFollowListDialog({ profileId, list, users: [], loading: true, error: "", page: 1, hasMore: false });
    try {
      const data = await apiRequest(
        `/api/follows/${encodeURIComponent(profileId)}/${list}?page=1&limit=20`,
      );
      setFollowListDialog({
        profileId,
        list,
        users: data.users || [],
        loading: false,
        error: "",
        page: 1,
        hasMore: (data.pagination?.totalPages || 1) > 1,
      });
    } catch (error) {
      setFollowListDialog({
        profileId,
        list,
        users: [],
        loading: false,
        error: error.message || "We couldn't load this list.",
      });
    }
  }

  async function loadMoreFollowList() {
    if (!followListDialog || followListDialog.loading || !followListDialog.hasMore) return;
    const page = followListDialog.page + 1;
    setFollowListDialog((current) => ({ ...current, loading: true, error: "" }));
    try {
      const { profileId, list } = followListDialog;
      const data = await apiRequest(
        `/api/follows/${encodeURIComponent(profileId)}/${list}?page=${page}&limit=20`,
      );
      setFollowListDialog((current) => ({
        ...current,
        users: [...current.users, ...(data.users || [])],
        loading: false,
        page,
        hasMore: (data.pagination?.totalPages || page) > page,
      }));
    } catch (error) {
      setFollowListDialog((current) => ({
        ...current,
        loading: false,
        error: error.message || "We couldn't load more students.",
      }));
    }
  }

  async function loadFollowRequests() {
    setFollowRequestsError("");
    try {
      const data = await apiRequest("/api/follows/requests");
      setFollowRequests({
        incoming: Array.isArray(data.incoming) ? data.incoming : [],
        outgoing: Array.isArray(data.outgoing) ? data.outgoing : [],
      });
    } catch (error) {
      setFollowRequestsError(error.message || "We couldn't load follow requests.");
    }
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

  async function markNotificationsRead() {
    setNotificationsError("");
    try {
      const data = await apiRequest("/api/notifications/read", {
        method: "PATCH",
      });
      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          readAt: notification.readAt || new Date().toISOString(),
        })),
      );
      setUnreadNotifications(Number(data.unreadCount) || 0);
    } catch (error) {
      setNotificationsError(error.message || "We couldn't update your notifications.");
    }
  }

  async function openNotification(notification) {
    setNotificationsError("");
    if (!notification.readAt) {
      try {
        const data = await apiRequest(
          `/api/notifications/${encodeURIComponent(notification._id)}/read`,
          { method: "PATCH" },
        );
        setNotifications((previous) =>
          previous.map((item) =>
            item._id === notification._id
              ? { ...item, readAt: data.notification?.readAt || new Date().toISOString() }
              : item,
          ),
        );
        setUnreadNotifications(Number(data.unreadCount) || 0);
      } catch (error) {
        setNotificationsError(error.message || "We couldn't update your notification.");
        return;
      }
    }

    setNotificationsOpen(false);
    setMobileMenuOpen(false);
    if (notification.targetType === "conversation") {
      setNotificationConversationId(String(notification.targetId));
      setActivePage("Messages");
      return;
    }
    if (notification.targetType === "user") {
      await openUserProfile(notification.actor || notification.targetId);
      return;
    }
    if (notification.targetType === "post") {
      setActivePage("Home Feed");
      try {
        const data = await apiRequest(
          `/api/posts/${encodeURIComponent(notification.targetId)}`,
        );
        const post = normalizePost(data.post);
        setPosts((current) => current.some((item) => item.id === post.id)
          ? current.map((item) => item.id === post.id ? post : item)
          : [post, ...current]);
        setSelectedSearchResult({ type: "posts", item: post });
      } catch (error) {
        setPostActionError(error.message || "This post isn't available.");
      }
    }
  }

  const institutionName =
    typeof user?.institution === "object" && user.institution !== null
      ? user.institution.name || user.institution.shortName || ""
      : user?.institutionName || "";

  const campusName =
    typeof user?.campus === "object" && user.campus !== null
      ? user.campus.name || ""
      : user?.campusName || "";

  const filteredPosts = activeTrendTag
    ? posts.filter((post) => post.text.toLowerCase().includes(activeTrendTag.toLowerCase()))
    : posts;

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

  const accountId = String(user?._id || user?.id || "");
  const sellerDashboardEligible = Boolean(sellerStatus.eligible);
  const selectedStudentProfile = selectedSearchResult?.type === "students"
    ? selectedSearchResult.item
    : null;
  const selectedProfileFollowStatus = selectedStudentProfile?.followStatus || "NONE";
  const buyerOrders = orders.filter(
    (order) => String(order.buyer?._id || order.buyer) === accountId,
  );
  const sellerOrders = orders.filter(
    (order) => String(order.seller?._id || order.seller) === accountId,
  );
  const dashboardOrders = dashboardView === "seller" ? sellerOrders : buyerOrders;
  const buyerOrderStats = [
    ["Total orders", buyerOrders.length],
    ["Pending payment", buyerOrders.filter((order) => order.paymentStatus === "PENDING").length],
    ["Awaiting processing", buyerOrders.filter((order) => order.status === "PAID").length],
    ["In progress", buyerOrders.filter((order) => ["PROCESSING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)).length],
    ["Completed", buyerOrders.filter((order) => order.status === "COMPLETED").length],
    ["Cancelled / disputed", buyerOrders.filter((order) => ["CANCELLED", "DISPUTED", "REFUNDED"].includes(order.status)).length],
  ];
  const sellerOrderStats = [
    ["Active listings", sellerListings.filter((listing) => listing.status === "active" && listing.stock > 0).length],
    ["Unavailable", sellerListings.filter((listing) => listing.status === "sold" || (listing.status === "active" && listing.stock <= 0)).length],
    ["Taken down", sellerListings.filter((listing) => listing.status === "hidden").length],
    ["Total orders", sellerOrders.length],
    ["Awaiting action", sellerOrders.filter((order) => ["PAID", "PROCESSING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY"].includes(order.status)).length],
    ["Completed sales", sellerOrders.filter((order) => order.status === "COMPLETED").length],
  ];

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

  function renderComment(comment) {
    const isOwner = String(comment.author?._id || comment.author) === String(user._id || user.id);
    const authorId = comment.author?._id || comment.author?.id || comment.author;
    return (
      <>
        <button type="button" onClick={() => openUserProfile(authorId)} className="text-left text-xs font-bold text-slate-700 hover:text-blue-700 hover:underline">
          {comment.author?.name || "Student"}
        </button>
        {editingComment?._id === comment._id ? (
          <form onSubmit={(event) => saveCommentEdit(event, comment)} className="mt-2 flex gap-2">
            <input name="text" defaultValue={comment.text} maxLength={2000} autoFocus className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <button type="submit" disabled={commentEditSaving} className="text-xs font-bold text-blue-700 disabled:opacity-50">{commentEditSaving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setEditingComment(null)} className="text-xs text-slate-500">Cancel</button>
          </form>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.isDeleted ? "Comment deleted" : comment.text}</p>
        )}
        {isOwner && !comment.isDeleted && editingComment?._id !== comment._id && (
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => setEditingComment(comment)} className="text-xs font-semibold text-slate-500">Edit</button>
            <button type="button" onClick={() => removeComment(comment)} className="text-xs font-semibold text-red-600">Delete</button>
          </div>
        )}
      </>
    );
  }

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
            <GlobalSearch onSelect={selectSearchResult} onProfile={openUserProfile} />
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
                }}
                className="relative rounded-xl p-2.5 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell size={21} />

                {unreadNotifications > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
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
                      disabled={unreadNotifications === 0}
                      className="text-xs font-semibold text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notificationsLoading ? (
                      <p className="p-6 text-center text-sm text-slate-500">Loading notifications...</p>
                    ) : notificationsError ? (
                      <div role="alert" className="p-5 text-center">
                        <p className="text-sm text-red-700">{notificationsError}</p>
                        <button
                          type="button"
                          onClick={() => setNotificationsReload((current) => current + 1)}
                          className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
                        >
                          Try again
                        </button>
                      </div>
                    ) : notifications.length === 0 ? (
                      <p className="p-6 text-center text-sm text-slate-500">
                        You're all caught up!
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification._id}
                          className={`flex w-full gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${
                            !notification.readAt ? "bg-blue-50/60" : ""
                          }`}
                        >
                          <span
                            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                              notification.readAt ? "bg-slate-200" : "bg-blue-600"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <button type="button" onClick={() => openNotification(notification)} className="block w-full text-left">
                              <span className="block text-sm font-bold text-slate-800">
                                {notification.title}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-slate-500">
                                {notification.message}
                              </span>
                              <span className="mt-2 block text-[11px] text-slate-400">
                                {notification.createdAt
                                  ? new Date(notification.createdAt).toLocaleString()
                                  : ""}
                              </span>
                            </button>
                            {notification.actor && (
                              <button type="button" onClick={() => openUserProfile(notification.actor)} className="mt-2 text-xs font-semibold text-blue-700 hover:underline">
                                View {notification.actor.name || "student"}'s profile
                              </button>
                            )}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden h-8 border-l border-slate-200 sm:block" />

            <button type="button" onClick={() => { setActivePage("Profile"); setSelectedSearchResult(null); }} className="flex items-center gap-2 rounded-xl p-1.5 text-left hover:bg-slate-50">
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
            </button>
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
              .filter((item) => (!item.adminOnly || user.role === "admin") && (!item.sellerOnly || sellerDashboardEligible))
              .map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.sellerOnly) {
                      setActivePage("Marketplace");
                      setDashboardView("seller");
                      setOrdersOpen(true);
                      loadOrders();
                      loadSellerListings();
                    } else {
                      setActivePage(item.name);
                    }
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
            <GlobalSearch onSelect={selectSearchResult} onProfile={openUserProfile} />
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
            <>
              {profileReturnPage && (
                <button type="button" onClick={() => {
                  setActivePage(profileReturnPage);
                  setProfileReturnPage("");
                  setProfileMessageRecipientId("");
                }} className="mb-3 min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
                  ← Back to {profileReturnPage}
                </button>
              )}
              <Messages
                user={user}
                socket={messageSocket}
                onUnreadCount={setUnreadMessages}
                initialConversationId={notificationConversationId}
                onInitialConversationHandled={() => setNotificationConversationId("")}
                initialRecipientId={profileMessageRecipientId}
                onInitialRecipientHandled={() => setProfileMessageRecipientId("")}
                onProfile={openUserProfile}
              />
            </>
          )}

          {activePage === "Admin Dashboard" && (
            <AdminDashboard />
          )}

          {activePage === "Discover Students" && (
            <StudentSuggestions
              onProfile={openUserProfile}
            />
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
                      {user.profile?.avatar
                        ? <img src={user.profile.avatar} alt={`${fullName}'s profile`} className="h-24 w-24 rounded-3xl border-4 border-white object-cover shadow-sm" />
                        : <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-blue-100 text-2xl font-extrabold text-blue-700 shadow-sm">{userInitials}</div>}
                      <div className="pb-1">
                        <h3 className="text-xl font-extrabold">{fullName}</h3>
                        <p className="mt-1 text-sm capitalize text-slate-500">
                          {user.role || "Student"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePage("Profile");
                        window.setTimeout(() => document.getElementById("profile-settings")?.scrollIntoView({ behavior: "smooth" }), 0);
                      }}
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
              <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold">Follow requests</h3>
                    <p className="mt-1 text-sm text-slate-500">Approve or decline requests to view private-profile content.</p>
                  </div>
                  <button type="button" onClick={refreshFollowRequests} className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Refresh</button>
                </div>
                {followRequestsError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{followRequestsError}</p>}
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  {[
                    ["Incoming", "incoming", "follower", ["accept", "decline"]],
                    ["Sent", "outgoing", "following", ["cancel"]],
                  ].map(([title, listKey, personKey, actions]) => (
                    <div key={listKey}>
                      <h4 className="mb-2 text-sm font-bold">{title}</h4>
                      {followRequests[listKey].length === 0 ? (
                        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No {title.toLowerCase()} requests.</p>
                      ) : (
                        <div className="space-y-2">
                          {followRequests[listKey].map((request) => {
                            const person = request[personKey];
                            if (!person?._id) return null;
                            return (
                              <div key={request._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                                <button type="button" onClick={() => openUserProfile(person)} className="min-h-10 min-w-0 truncate text-left text-sm font-semibold text-primary hover:underline">{person.name}</button>
                                <div className="flex gap-2">
                                  {actions.map((action) => (
                                    <button key={action} type="button" onClick={() => updateFollowAction(person, action)} disabled={followActionLoading === String(person._id)} className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-bold ${action === "accept" ? "bg-primary text-white" : "border border-slate-200"}`}>
                                      {followActionLoading === String(person._id) ? "Saving..." : action[0].toUpperCase() + action.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
              <section id="profile-settings" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
                <h3 className="text-lg font-extrabold">Profile and privacy settings</h3>
                <p className="mt-1 text-sm text-slate-500">Choose what campus students can discover and edit the details shown on your profile.</p>
                {profileNotice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{profileNotice}</p>}
                {profileError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{profileError}</p>}
                <form onSubmit={saveProfileSettings} className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label><span className="mb-1.5 block text-sm font-semibold">Display name</span><input name="name" required maxLength={80} defaultValue={user.name || ""} className="w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                  <label><span className="mb-1.5 block text-sm font-semibold">Profile picture URL (HTTPS)</span><input name="avatar" type="url" defaultValue={user.profile?.avatar || ""} className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="https://..." /></label>
                  <label><span className="mb-1.5 block text-sm font-semibold">Phone</span><input name="phone" maxLength={30} defaultValue={user.profile?.phone || ""} className="w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                  <label><span className="mb-1.5 block text-sm font-semibold">Department</span><input name="department" maxLength={100} defaultValue={user.profile?.department || ""} className="w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                  <label><span className="mb-1.5 block text-sm font-semibold">Level</span><input name="level" maxLength={50} defaultValue={user.profile?.level || ""} className="w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                  <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Biography</span><textarea name="bio" maxLength={300} rows={3} defaultValue={user.profile?.bio || ""} className="w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                  <label><span className="mb-1.5 block text-sm font-semibold">Who can view your profile?</span><select name="profileVisibility" defaultValue={user.privacy?.profileVisibility || "campus"} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="public">All students</option><option value="campus">My campus</option><option value="private">Only me</option></select></label>
                  <label><span className="mb-1.5 block text-sm font-semibold">Default post visibility</span><select name="defaultPostVisibility" defaultValue={user.privacy?.defaultPostVisibility || "campus"} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="public">All students</option><option value="campus">My campus</option><option value="private">Only me</option></select></label>
                  <label className="sm:col-span-2 flex items-center gap-3 text-sm"><input name="discoverable" type="checkbox" defaultChecked={user.privacy?.discoverable !== false} className="h-4 w-4" />Allow eligible students to find my profile in discovery.</label>
                  <button type="submit" disabled={profileSaving} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{profileSaving ? "Saving..." : "Save profile settings"}</button>
                </form>
                <form onSubmit={changeAccountPassword} className="mt-8 border-t border-slate-100 pt-6">
                  <h4 className="font-bold">Change password</h4>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label><span className="mb-1.5 block text-sm font-semibold">Current password</span><input required type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                    <label><span className="mb-1.5 block text-sm font-semibold">New password (at least 8 characters)</span><input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
                  </div>
                  <button type="submit" disabled={passwordSaving} className="mt-4 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-50">{passwordSaving ? "Updating..." : "Update password"}</button>
                </form>
              </section>
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
                    if (sellerDashboardEligible) {
                      setListingFormOpen(true);
                    } else if (sellerStatus.application?.status === "PENDING") {
                      setMarketplaceNotice("Your seller application is awaiting campus review.");
                    } else if (sellerStatus.application?.status === "SUSPENDED") {
                      setMarketplaceError("Seller access is currently suspended.");
                    } else if (!user.isVerifiedStudent) {
                      setMarketplaceError("Verify your student account before applying to sell.");
                    } else {
                      setSellerApplicationOpen(true);
                    }
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  <Plus size={18} />
                  {sellerDashboardEligible ? "Sell an item" : sellerStatus.application?.status === "PENDING" ? "Application pending" : "Apply to sell"}
                </button>
                <button
                  type="button"
                  onClick={() => { setDashboardView("buyer"); loadOrders(); setOrdersOpen(true); }}
                  className="ml-3 mt-5 inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  My Orders
                </button>
                {sellerDashboardEligible && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setDashboardView("seller"); loadOrders(); loadSellerListings(); setOrdersOpen(true); }}
                      className="ml-3 mt-5 inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      Seller dashboard
                    </button>
                    <button
                      type="button"
                      onClick={openPayoutSetup}
                      className="ml-3 mt-5 inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      Set payout account
                    </button>
                  </>
                )}
              </div>

              {sellerStatusError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{sellerStatusError}</p>}
              {sellerStatus.application && (
                <div className={`rounded-xl border p-3 text-sm ${
                  sellerStatus.application.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
                    sellerStatus.application.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-900" :
                      "border-slate-200 bg-white text-slate-700"
                }`}>
                  Seller application: <strong>{sellerStatus.application.status.toLowerCase()}</strong>
                  {sellerStatus.application.reviewNote && <p className="mt-1">{sellerStatus.application.reviewNote}</p>}
                </div>
              )}

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
                      const sellerId =
                        typeof listing.seller === "object"
                          ? listing.seller?._id || listing.seller?.id
                          : listing.seller;

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
                              <button type="button" disabled={!sellerId} onClick={() => openUserProfile(sellerId)} aria-label={`Open ${seller || "seller"}'s profile`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 disabled:cursor-default">
                                {listing.seller?.profile?.avatar
                                  ? <img src={listing.seller.profile.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                                  : (seller || "S")
                                  .split(" ")
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((part) => part[0].toUpperCase())
                                  .join("")}
                              </button>

                              <div className="min-w-0">
                                <button type="button" disabled={!sellerId} onClick={() => openUserProfile(sellerId)} className="block max-w-full truncate text-left text-sm font-semibold text-slate-800 hover:text-blue-700 hover:underline disabled:no-underline">
                                  {seller || "Campus seller"}
                                </button>

                                <p className="text-xs text-slate-500">
                                  Campus Connect seller
                                </p>
                              </div>
                            </div>

                            {String(
                              typeof listing.seller === "object"
                                ? listing.seller?._id || listing.seller?.id
                                : listing.seller,
                            ) === accountId ? (
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
                        <h3 className="text-xl font-extrabold text-slate-900">{editingListingId ? "Edit listing" : "Sell an item"}</h3>
                        <p className="mt-1 text-sm text-slate-500">Your listing will be visible to students on your campus.</p>
                      </div>
                      <button type="button" onClick={resetListingForm} aria-label="Close listing form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Item title</span><input required maxLength={120} value={listingForm.title} onChange={(event) => setListingForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="e.g. Calculus textbook" /></label>
                      <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Description</span><textarea required maxLength={1000} rows={4} value={listingForm.description} onChange={(event) => setListingForm((current) => ({ ...current, description: event.target.value }))} className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Describe the item, its condition, and how students can use it." /></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Price (₦)</span><input required min="0" step="0.01" type="number" value={listingForm.price} onChange={(event) => setListingForm((current) => ({ ...current, price: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Quantity available</span><input required min={editingListingId ? "0" : "1"} step="1" type="number" value={listingForm.stock} onChange={(event) => setListingForm((current) => ({ ...current, stock: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Category</span><select value={listingForm.category} onChange={(event) => setListingForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-600"><option value="electronics">Electronics</option><option value="fashion">Fashion</option><option value="books">Books</option><option value="food">Food</option><option value="services">Services</option><option value="school_items">School Items</option><option value="others">Others</option></select></label>
                      <label><span className="mb-1.5 block text-sm font-semibold">Condition</span><select value={listingForm.condition} onChange={(event) => setListingForm((current) => ({ ...current, condition: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-600"><option value="new">New</option><option value="used">Used</option><option value="fair">Fair</option></select></label>
                      {listingForm.existingImages.length > 0 && (
                        <div className="sm:col-span-2">
                          <p className="mb-2 text-sm font-semibold">Current photos</p>
                          <div className="flex flex-wrap gap-3">
                            {listingForm.existingImages.map((image, index) => (
                              <div key={`${image}-${index}`} className="relative">
                                <img src={image} alt={`Listing photo ${index + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                                <button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => setListingForm((current) => ({ ...current, existingImages: current.existingImages.filter((_, itemIndex) => itemIndex !== index) }))} className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow">✕</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Photos <span className="font-normal text-slate-400">(up to 4 files, 25 MB each)</span></span><input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={selectListingMedia} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" /></label>
                      {!editingListingId && <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><input required type="checkbox" checked={listingForm.sellerTermsAccepted} onChange={(event) => setListingForm((current) => ({ ...current, sellerTermsAccepted: event.target.checked }))} className="mt-0.5 h-4 w-4" /><span>I confirm that this listing is genuine, I will not engage in fraudulent activity, and I accept Campus Connect’s 7% commission on each completed sale plus any applicable marketplace terms.</span></label>}
                    </div>
                    <button type="submit" disabled={marketplaceSubmitting} className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{marketplaceSubmitting ? "Saving..." : editingListingId ? "Save changes" : "Publish listing"}</button>
                  </form>
                </div>
              )}

              {sellerApplicationOpen && (
                <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-4">
                  <form onSubmit={submitSellerApplication} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-extrabold">Apply to sell</h3>
                        <p className="mt-1 text-sm text-slate-500">Applications are reviewed by an administrator at your campus. You can list products after approval.</p>
                      </div>
                      <button type="button" onClick={() => setSellerApplicationOpen(false)} aria-label="Close seller application" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
                    </div>
                    <div className="mt-5 space-y-4">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-semibold">Business or seller name</span>
                        <input required minLength={2} maxLength={100} value={sellerApplicationForm.businessName} onChange={(event) => setSellerApplicationForm((current) => ({ ...current, businessName: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
                      </label>
                      <fieldset>
                        <legend className="mb-2 text-sm font-semibold">What do you plan to sell?</legend>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {[
                            ["electronics", "Electronics"],
                            ["fashion", "Fashion"],
                            ["books", "Books"],
                            ["food", "Food"],
                            ["services", "Services"],
                            ["school_items", "School items"],
                            ["others", "Other goods"],
                          ].map(([value, label]) => (
                            <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-sm">
                              <input
                                type="checkbox"
                                checked={sellerApplicationForm.categories.includes(value)}
                                onChange={(event) => setSellerApplicationForm((current) => ({
                                  ...current,
                                  categories: event.target.checked
                                    ? [...current.categories, value]
                                    : current.categories.filter((category) => category !== value),
                                }))}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-semibold">Describe what you will offer and how you will fulfill orders</span>
                        <textarea required minLength={20} maxLength={1000} rows={4} value={sellerApplicationForm.description} onChange={(event) => setSellerApplicationForm((current) => ({ ...current, description: event.target.value }))} className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3" />
                      </label>
                    </div>
                    {marketplaceError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{marketplaceError}</p>}
                    <button type="submit" disabled={sellerApplicationSaving || sellerApplicationForm.categories.length === 0} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-4 py-3 font-bold text-white disabled:opacity-50">
                      {sellerApplicationSaving ? "Submitting..." : "Submit for review"}
                    </button>
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
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-extrabold">{dashboardView === "seller" ? "Seller dashboard" : "My Orders"}</h3>
                        <p className="mt-1 text-sm text-slate-500">{dashboardView === "seller" ? "Manage listings, orders, and payout progress." : "Track your purchases, payments, and delivery."}</p>
                      </div>
                      <button type="button" onClick={() => setOrdersOpen(false)} aria-label="Close dashboard" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {(dashboardView === "seller" ? sellerOrderStats : buyerOrderStats).map(([label, count]) => (
                        <div key={label} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className="mt-1 text-xl font-extrabold text-slate-900">
                            {dashboardView === "buyer" && ordersError
                              ? "—"
                              : dashboardView === "seller" &&
                                  ((label.includes("listing") || label === "Unavailable" || label === "Taken down")
                                    ? sellerListingsError
                                    : ordersError)
                                ? "—"
                                : count}
                          </p>
                        </div>
                      ))}
                    </div>
                    {dashboardView === "seller" && (
                      <section className="mt-6">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-extrabold">Your listings</h4>
                          <button type="button" onClick={() => { setOrdersOpen(false); setListingFormOpen(true); setMarketplaceError(""); }} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Add listing</button>
                        </div>
                        {sellerListingsError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{sellerListingsError}</p>}
                        {sellerListingsLoading ? <p className="py-5 text-sm text-slate-500">Loading your listings...</p> : sellerListingsError ? null : sellerListings.length === 0 ? <p className="py-5 text-sm text-slate-500">You have not listed any products yet.</p> : (
                          <div className="mt-3 space-y-3">
                            {sellerListings.map((listing) => (
                              <article key={listing._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  {listing.images?.[0] && <img src={listing.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold">{listing.title}</p>
                                    <p className="text-xs text-slate-500">₦{Number(listing.price).toLocaleString()} · Stock {listing.stock} · {listing.status.replaceAll("_", " ")}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => editListing(listing)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Edit</button>
                                  {listing.status !== "sold" && <button type="button" disabled={listingActionId === listing._id} onClick={() => changeListingStatus(listing)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">{listingActionId === listing._id ? "Saving..." : listing.status === "hidden" ? "Restore" : "Take down"}</button>}
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    )}
                    <section className="mt-6">
                      <h4 className="font-extrabold">{dashboardView === "seller" ? "Orders for your listings" : "Your orders"}</h4>
                      {ordersError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{ordersError}</p>}
                      {ordersLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading orders...</p> : ordersError ? null : dashboardOrders.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{dashboardView === "seller" ? "No students have ordered your listings yet." : "You do not have any orders yet."}</p> : (
                        <div className="mt-3 space-y-3">
                          {dashboardOrders.map((order) => {
                            const isSeller = dashboardView === "seller";
                            const counterparty = isSeller ? order.buyer : order.seller;
                            return (
                              <article key={order._id} className="rounded-2xl border border-slate-200 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-start gap-3">
                                    {order.listing?.images?.[0] && <img src={order.listing.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
                                    <div className="min-w-0">
                                      <p className="font-extrabold text-slate-900">{order.listing?.title || "Marketplace item"}</p>
                                      <p className="mt-1 text-sm text-slate-500">
                                        {isSeller ? "Buyer: " : "Seller: "}
                                        <button type="button" disabled={!counterparty?._id} onClick={() => openUserProfile(counterparty)} className="font-semibold text-blue-700 hover:underline disabled:text-slate-500 disabled:no-underline">{counterparty?.name || "Student"}</button>
                                      </p>
                                    </div>
                                  </div>
                                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{(order.status || "UNKNOWN").replaceAll("_", " ")}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                                  <span>Amount: ₦{Number(order.totalAmount || 0).toLocaleString()}</span><span>Qty: {order.quantity}</span><span>Payment: {order.paymentStatus}</span><span>Delivery: {order.deliveryStatus}</span>
                                </div>
                                <p className="mt-3 text-sm font-semibold text-slate-700">{order.deliveryMethod === "MIDDLEMAN" ? `Campus Connect middleman · ₦${Number(order.deliveryFee || 0).toLocaleString()} fee` : "Seller-to-buyer delivery"}</p>
                                {isSeller && <p className="mt-1 text-xs text-slate-500">Payout: {order.sellerPayoutStatus} · ₦{Number(order.sellerPayoutAmount || 0).toLocaleString()} after ₦{Number(order.platformCommission || 0).toLocaleString()} commission</p>}
                                {(isSeller || (order.deliveryMethod === "MIDDLEMAN" && user.role === "admin")) && order.status === "DELIVERED" && <div className="mt-4 flex gap-2"><input inputMode="numeric" maxLength={6} value={deliveryOtpInputs[order._id] || ""} onChange={(event) => setDeliveryOtpInputs((current) => ({ ...current, [order._id]: event.target.value }))} placeholder="Buyer’s 6-digit OTP" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button type="button" onClick={() => verifyDeliveryOtp(order._id)} className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-bold text-white">Verify</button></div>}
                                <p className="mt-3 text-xs text-slate-500">Order date: {order.createdAt ? new Date(order.createdAt).toLocaleString() : "Not available"}</p>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </section>
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

          {activePage === "Settings" && (
            <section className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
                <h3 className="text-xl font-extrabold">Appearance</h3>
                <p className="mt-2 text-sm text-slate-500">Choose how Campus Connect looks on this device. Your choice is saved and restored when you return.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2" role="group" aria-label="Color theme">
                  {["light", "dark"].map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setTheme(choice)}
                      aria-pressed={theme === choice}
                      className={`min-h-12 rounded-xl border px-4 py-3 text-left font-semibold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                        theme === choice
                          ? "border-primary bg-blue-50 text-primary"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {choice} mode{theme === choice ? " · Selected" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
                <Settings size={30} className="text-primary" />
                <h3 className="mt-3 text-xl font-extrabold">Account settings</h3>
                <p className="mt-2 text-sm text-slate-500">Profile, privacy, and password settings are available from your Profile page.</p>
                <button type="button" onClick={() => setActivePage("Profile")} className="mt-5 min-h-11 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white">
                  Open profile settings
                </button>
              </div>
            </section>
          )}
          {activePage !== "Home Feed" &&
            activePage !== "Campus News" &&
            activePage !== "Campus Services" &&
            activePage !== "Campus Match" &&
            activePage !== "Messages" &&
            activePage !== "Admin Dashboard" &&
            activePage !== "Discover Students" &&
            activePage !== "Profile" &&
            activePage !== "Settings" &&
            activePage !== "Marketplace" && (
              <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <h3 className="font-bold text-blue-900">Coming Soon</h3>

                <p className="mt-2 text-sm leading-6 text-blue-800">
                  {activePage} is not available yet. We’ll let you know when this section is ready.
                </p>
              </div>
            )}
          {activePage === "Home Feed" && (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-extrabold">Campus Feed</h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                    Latest posts
                  </span>
                  <button
                    type="button"
                    onClick={() => { setPostNotice(""); setPostComposerOpen(true); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
                  >
                    <Plus size={17} />
                    Create Post
                  </button>
                </div>
              </div>

              {activeTrendTag && (
                <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <span>Showing posts tagged with <strong>{activeTrendTag}</strong></span>
                  <button type="button" onClick={() => setActiveTrendTag("")} className="font-bold underline">Clear filter</button>
                </div>
              )}
              {postNotice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{postNotice}</p>}
              {postActionError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{postActionError}</p>}
              {postActionNotice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{postActionNotice}</p>}
              {postsError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{postsError}</span><button type="button" onClick={() => setPostsReload((current) => current + 1)} className="rounded-lg bg-red-100 px-3 py-2 font-semibold">Try again</button></div>}
              {postsLoading && <p className="mb-4 text-sm text-slate-500">Loading campus posts...</p>}
              <div className="space-y-5">
                {filteredPosts.map((post) => (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => openUserProfile(post.authorId)}
                        aria-label={`Open ${post.name}'s profile`}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${post.color}`}
                      >
                        {post.initials}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button type="button" onClick={() => openUserProfile(post.authorId)} className="text-left text-sm font-bold hover:text-blue-700 hover:underline">{post.name}</button>

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

                      {post.authorId === String(user._id || user.id) && (
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => setEditingPost(post)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Edit</button>
                          <button type="button" onClick={() => removePost(post.id)} className="rounded-lg border border-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>
                        </div>
                      )}
                      {post.authorId !== String(user._id || user.id) && (
                        <button type="button" onClick={() => reportPost(post.id)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">Report</button>
                      )}
                    </div>

                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {post.text}
                    </p>

                    {post.media?.url && (
                      post.media.type === "video"
                        ? <video src={post.media.url} controls preload="metadata" className="mt-4 max-h-[34rem] w-full rounded-xl bg-black object-contain" aria-label="Post video" />
                        : <img src={post.media.url} alt="Post attachment" loading="lazy" className="mt-4 max-h-[34rem] w-full rounded-xl object-contain" />
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        disabled={pendingPostLikes.has(post.id)}
                        onClick={() => togglePostLike(post)}
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition hover:bg-slate-50 disabled:opacity-50 ${post.likedByMe ? "text-red-500" : "text-slate-500"}`}
                      >
                        <Heart size={18} fill={post.likedByMe ? "currentColor" : "none"} />
                        {post.likes} Likes
                      </button>

                      <button
                        type="button"
                        onClick={() => openPostComments(post.id)}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      >
                        <MessageSquare size={18} />
                        {post.comments} Comments
                      </button>

                      <button
                        type="button"
                        onClick={() => sharePost(post)}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      >
                        <Share2 size={18} />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                    </div>
                    {commentsForPost === post.id && (
                      <section className="mt-4 border-t border-slate-100 pt-4" aria-label="Post comments">
                        {commentsLoading ? <p className="text-sm text-slate-500">Loading comments...</p> : (
                          <div className="space-y-4">
                            {postComments.map((comment) => (
                              <div key={comment._id} className="rounded-xl bg-slate-50 p-3">
                                {renderComment(comment)}
                                {commentReplies[comment._id]?.map((reply) => (
                                  <div key={reply._id} className="ml-5 mt-3 border-l-2 border-blue-100 pl-3">
                                    {renderComment(reply)}
                                  </div>
                                ))}
                                <button type="button" onClick={() => loadCommentReplies(post.id, comment._id)} className="mt-2 text-xs font-semibold text-slate-500">Load replies</button>
                                {!comment.isDeleted && (
                                  <button type="button" onClick={() => { setCommentReplyTo(comment); setCommentDraft(""); }} className="mt-2 text-xs font-bold text-blue-700">Reply</button>
                                )}
                              </div>
                            ))}
                            {!postComments.length && <p className="text-sm text-slate-500">No comments yet. Start the conversation.</p>}
                          </div>
                        )}
                        {commentReplyTo && <p className="mt-3 text-xs text-slate-500">Replying to {commentReplyTo.author?.name || "student"} <button type="button" onClick={() => setCommentReplyTo(null)} className="ml-2 font-bold text-blue-700">Cancel</button></p>}
                        <form onSubmit={(event) => submitPostComment(event, post.id)} className="mt-3 flex gap-2">
                          <input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={2000} placeholder={commentReplyTo ? "Write a reply..." : "Write a comment..."} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                          <button type="submit" disabled={commentSaving || !commentDraft.trim()} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{commentSaving ? "Sending..." : "Send"}</button>
                        </form>
                      </section>
                    )}
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
              {feedHasMore && (
                <button type="button" disabled={feedLoadingMore} onClick={async () => {
                  setFeedLoadingMore(true);
                  try {
                    const data = await apiRequest(`/api/posts?page=${feedPage + 1}`);
                    const label = institutionName || campusName || "Campus Connect Student";
                    setPosts((current) => {
                      const known = new Set(current.map((post) => post.id));
                      return [...current, ...(data.posts || []).filter((item) => !known.has(String(item._id))).map((item) => normalizePost(item, label))];
                    });
                    setFeedPage(data.page || feedPage + 1);
                    setFeedHasMore(Boolean(data.hasMore));
                  } catch (error) {
                    setPostActionError(error.message || "We couldn't load more posts.");
                  } finally {
                    setFeedLoadingMore(false);
                  }
                }} className="mt-5 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-blue-700 disabled:opacity-50">{feedLoadingMore ? "Loading..." : "Load more posts"}</button>
              )}
              {postComposerOpen && (
                <PostComposer
                  onClose={() => setPostComposerOpen(false)}
                  onPublished={addPublishedPost}
                />
              )}
            </>
          )}
          <footer className="py-8 text-center text-xs text-slate-400">
            Campus Connect · Connecting students, building communities.
          </footer>
        </main>

        <aside className="hidden space-y-6 px-5 py-6 xl:block">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-extrabold">Trending on your campus</h3>

              <TrendingUp size={18} className="text-orange-500" />
            </div>

            <p className="mb-4 text-xs leading-5 text-slate-500">
              Popular posts and topics from your campus community.
            </p>

            <div className="space-y-4">
              {trendingLoading && <p className="text-sm text-slate-500">Loading current trends...</p>}
              {trendingError && <p role="alert" className="text-sm text-red-700">{trendingError}</p>}
              {trending.hashtags.map((tag, index) => (
                <button
                  key={tag.tag}
                  onClick={() => {
                    setActiveTrendTag(tag.tag);
                    setActivePage("Home Feed");
                    setSelectedSearchResult(null);
                  }}
                  className="block w-full text-left"
                >
                  <p className="text-sm font-bold text-blue-700 hover:underline">
                    {tag.tag}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {tag.posts} posts · #{index + 1} trending
                  </p>
                </button>
              ))}
              {trending.posts.slice(0, 3).map((post, index) => (
                <button key={post._id} type="button" onClick={() => selectSearchResult("posts", post)} className="block w-full border-t border-slate-100 pt-3 text-left">
                  <p className="text-xs font-semibold uppercase text-slate-400">Trending post #{index + 1}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700">{post.text || "Post with media"}</p>
                  <p className="mt-1 text-xs text-slate-400">{post.likes} likes · {post.comments} comments · {post.shares} shares</p>
                </button>
              ))}
              {!trendingLoading && !trendingError && !trending.hashtags.length && !trending.posts.length && (
                <p className="text-sm text-slate-500">No trending posts yet. Start a conversation in your feed.</p>
              )}
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

      <nav className="mobile-bottom-navigation fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur-md">
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
      {editingPost && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
          <form onSubmit={savePostEdit} role="dialog" aria-modal="true" aria-labelledby="edit-post-title" className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 id="edit-post-title" className="text-xl font-extrabold">Edit your post</h2>
              <button type="button" disabled={postEditSaving} onClick={() => setEditingPost(null)} aria-label="Close edit post form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <label className="mt-5 block text-sm font-semibold">Post text
              <textarea name="text" defaultValue={editingPost.text} maxLength={2000} rows={5} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="mt-4 block text-sm font-semibold">Who can see this post?
              <select name="visibility" defaultValue={editingPost.visibility} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                <option value="campus">My campus</option>
                <option value="public">All students</option>
                <option value="private">Only me</option>
              </select>
            </label>
            {postActionError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{postActionError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={postEditSaving} onClick={() => setEditingPost(null)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold">Cancel</button>
              <button type="submit" disabled={postEditSaving} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{postEditSaving ? "Saving..." : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}
      {selectedSearchResult && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedSearchResult(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="search-result-title" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{selectedSearchResult.type}</p>
                <h2 id="search-result-title" className="mt-1 text-xl font-extrabold">{selectedSearchResult.type === "posts" ? `Post by ${selectedSearchResult.item.name}` : selectedSearchResult.item.name || selectedSearchResult.item.title || "Search result"}</h2>
              </div>
              <button type="button" onClick={() => setSelectedSearchResult(null)} aria-label="Close search result" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            {selectedSearchResult.type === "students" && (
              <div className="mt-5">
                <div className="flex items-start gap-4">
                  {selectedStudentProfile.avatar
                    ? <img src={selectedStudentProfile.avatar} alt={`${selectedStudentProfile.name}'s profile`} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
                    : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl font-extrabold text-blue-700">{selectedStudentProfile.name?.[0] || "S"}</div>}
                  <div className="min-w-0">
                    <p className="text-sm text-slate-600">{[selectedStudentProfile.institution, selectedStudentProfile.campus].filter(Boolean).join(" · ") || "Campus Connect student"}</p>
                    <p className="mt-1 text-sm text-slate-500">{[selectedStudentProfile.department, selectedStudentProfile.level].filter(Boolean).join(" · ")}</p>
                    {selectedStudentProfile.isVerifiedStudent && <p className="mt-2 text-sm font-semibold text-blue-700">Verified student</p>}
                  </div>
                </div>
                {selectedStudentProfile.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedStudentProfile.bio}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => loadFollowList(selectedStudentProfile.id, "followers")} className="rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100">
                    <strong>{selectedStudentProfile.followersCount || 0}</strong> followers
                  </button>
                  <button type="button" onClick={() => loadFollowList(selectedStudentProfile.id, "following")} className="rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100">
                    <strong>{selectedStudentProfile.followingCount || 0}</strong> following
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={followActionLoading === String(selectedStudentProfile.id)}
                    onClick={() => updateFollowAction(
                      selectedStudentProfile,
                      selectedProfileFollowStatus === "PENDING"
                        ? "cancel"
                        : selectedProfileFollowStatus === "ACCEPTED"
                          ? "unfollow"
                          : "request",
                    )}
                    className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {followActionLoading === String(selectedStudentProfile.id)
                      ? "Saving..."
                      : selectedProfileFollowStatus === "PENDING"
                        ? "Cancel request"
                        : selectedProfileFollowStatus === "ACCEPTED"
                          ? "Unfollow"
                          : "Follow"}
                  </button>
                  <button type="button" onClick={() => openProfileConversation(selectedStudentProfile)} className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
                    Message
                  </button>
                </div>
                {profileNotice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{profileNotice}</p>}
                {profileError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{profileError}</p>}
                <section className="mt-6 border-t border-slate-100 pt-5">
                  <h3 className="font-extrabold">Recent posts</h3>
                  {(selectedStudentProfile.posts || []).length === 0 ? (
                    <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No posts are available to you.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {selectedStudentProfile.posts.map((post) => (
                        <article key={post.id} className="rounded-xl border border-slate-200 p-3">
                          {post.text && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.text}</p>}
                          {post.media?.url && (post.media.type === "video"
                            ? <video src={post.media.url} controls className="mt-3 max-h-64 w-full rounded-lg bg-black" />
                            : <img src={post.media.url} alt="Post attachment" className="mt-3 max-h-64 w-full rounded-lg object-contain" />)}
                          <p className="mt-2 text-xs text-slate-500">{post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
            {selectedSearchResult.type === "posts" && (
              <div className="mt-5">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedSearchResult.item.text || "Post with media"}</p>
                {selectedSearchResult.item.media?.url && (selectedSearchResult.item.media.type === "video"
                  ? <video src={selectedSearchResult.item.media.url} controls className="mt-4 max-h-80 w-full rounded-xl bg-black" />
                  : <img src={selectedSearchResult.item.media.url} alt="Post attachment" className="mt-4 max-h-80 w-full rounded-xl object-contain" />)}
              </div>
            )}
            {["news", "groups", "marketplace"].includes(selectedSearchResult.type) && (
              <div className="mt-5">
                {selectedSearchResult.type === "marketplace" && selectedSearchResult.item.images?.[0] && <img src={selectedSearchResult.item.images[0]} alt="" className="mb-4 max-h-64 w-full rounded-xl object-contain" />}
                {selectedSearchResult.type === "marketplace" && <p className="font-bold text-blue-700">₦{Number(selectedSearchResult.item.price).toLocaleString()} · {selectedSearchResult.item.category}</p>}
                {selectedSearchResult.item.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedSearchResult.item.description}</p>}
                {selectedSearchResult.item.content && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedSearchResult.item.content}</p>}
                {selectedSearchResult.type === "groups" && <p className="mt-3 text-sm text-slate-500">{selectedSearchResult.item.memberCount ?? selectedSearchResult.item.members?.length ?? 0} members</p>}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setSelectedSearchResult(null)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold">Close</button>
              {selectedSearchResult.type !== "posts" && selectedSearchResult.type !== "students" && (
                <button type="button" onClick={() => {
                  const destinations = { marketplace: "Marketplace", news: "Campus News", groups: "Communities" };
                  setActivePage(destinations[selectedSearchResult.type]);
                  setSelectedSearchResult(null);
                }} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Open section</button>
              )}
            </div>
          </section>
        </div>
      )}
      {followListDialog && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setFollowListDialog(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="follow-list-title" className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="follow-list-title" className="text-lg font-extrabold capitalize">{followListDialog.list}</h2>
              <button type="button" onClick={() => setFollowListDialog(null)} aria-label="Close follow list" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            {followListDialog.error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{followListDialog.error}</p>}
            {followListDialog.users.length === 0 && !followListDialog.loading ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No discoverable students to show.</p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {followListDialog.users.map((person) => (
                  <button key={person.id} type="button" onClick={() => {
                    setFollowListDialog(null);
                    openUserProfile(person.id);
                  }} className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-slate-50">
                    {person.avatar
                      ? <img src={person.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                      : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{person.name?.[0] || "S"}</span>}
                    <span className="truncate text-sm font-semibold">{person.name}</span>
                  </button>
                ))}
              </div>
            )}
            {followListDialog.loading && <p className="py-3 text-center text-sm text-slate-500">Loading...</p>}
            {followListDialog.hasMore && <button type="button" disabled={followListDialog.loading} onClick={loadMoreFollowList} className="mt-3 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Load more</button>}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
