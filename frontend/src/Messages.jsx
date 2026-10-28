import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Search, Send, ShieldAlert, Check, X } from "lucide-react";
import { apiRequest, getFriendlyErrorMessage } from "./services/api.js";
import { mergeChronologicalMessages, messageId } from "./services/messageUtils.js";

const otherParticipant = (conversation, userId) =>
  conversation.participants?.find(
    (participant) => String(participant?._id || participant) !== String(userId),
  );

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

function Avatar({ name, image, online = false }) {
  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
      {image ? (
        <img src={image} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        (name || "S").slice(0, 1).toUpperCase()
      )}
      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
      )}
    </span>
  );
}

export default function Messages({
  user,
  socket,
  onUnreadCount,
  initialConversationId,
  onInitialConversationHandled,
}) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [mobileShowConversation, setMobileShowConversation] = useState(false);
  const [socketConnected, setSocketConnected] = useState(Boolean(socket?.connected));
  const socketRef = useRef(null);
  const messageEndRef = useRef(null);
  const pendingSendRef = useRef(null);

  const refreshConversations = useCallback(async () => {
    setLoadingConversations(true);
    setConversationError("");
    try {
      const data = await apiRequest("/api/messages/conversations");
      const next = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(next);
      setOnlineUsers(
        new Set(
          next
            .map((conversation) => otherParticipant(conversation, user._id))
            .filter((participant) => participant?.isOnline)
            .map((participant) => String(participant._id)),
        ),
      );
      return next;
    } catch (error) {
      setConversationError(error.message || "Could not load conversations.");
      return null;
    } finally {
      setLoadingConversations(false);
    }
  }, [user._id]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (
      !initialConversationId ||
      !conversations.some(
        (conversation) => String(conversation._id) === String(initialConversationId),
      )
    ) {
      return;
    }
    setActiveId(String(initialConversationId));
    setMobileShowConversation(true);
    onInitialConversationHandled?.();
  }, [initialConversationId, conversations, onInitialConversationHandled]);

  useEffect(() => {
    socketRef.current = socket;
    setSocketConnected(Boolean(socket?.connected));
    if (!socket) return undefined;

    const onConnect = () => {
      setSocketConnected(true);
      if (!activeId) return;
      socket.emit("dm:join", { conversationId: activeId }, (acknowledgement) => {
        if (acknowledgement?.error) {
          setMessageError(getFriendlyErrorMessage(
            new Error(acknowledgement.error),
            "Couldn't reconnect to this conversation.",
          ));
        }
      });
      apiRequest(`/api/messages/conversations/${activeId}/messages`)
        .then((data) => setMessages((current) =>
          mergeChronologicalMessages(current, Array.isArray(data.messages) ? data.messages : []),
        ))
        .catch((error) => setMessageError(error.message || "We couldn't refresh your messages."));
    };
    const onDisconnect = () => setSocketConnected(false);
    const onConnectError = () => {
      setSocketConnected(false);
      setMessageError("Live messaging is reconnecting. Your messages remain saved and you can continue sending.");
    };

    const onMessage = ({ conversationId, message }) => {
      if (conversationId === activeId) {
        setMessages((current) => mergeChronologicalMessages(current, [message]));
        if (String(message.receiver) === String(user._id)) {
          apiRequest(`/api/messages/conversations/${conversationId}/read`, {
            method: "PATCH",
          }).catch((error) =>
            setMessageError(error.message || "Could not mark messages as read."),
          );
        }
      }
      refreshConversations();
    };
    const onRequest = () => refreshConversations();
    const onRead = () => refreshConversations();
    const onSocketError = ({ message }) =>
      setMessageError(getFriendlyErrorMessage(
        new Error(message),
        "We couldn't complete that messaging action.",
      ));
    const onPresence = ({ userId, isOnline }) => {
      setOnlineUsers((current) => {
        const next = new Set(current);
        if (isOnline) next.add(String(userId));
        else next.delete(String(userId));
        return next;
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("dm:new", onMessage);
    socket.on("dm:preview", onMessage);
    socket.on("dm:request", onRequest);
    socket.on("dm:request-updated", onRequest);
    socket.on("dm:read", onRead);
    socket.on("dm:error", onSocketError);
    socket.on("presence:update", onPresence);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("dm:new", onMessage);
      socket.off("dm:preview", onMessage);
      socket.off("dm:request", onRequest);
      socket.off("dm:request-updated", onRequest);
      socket.off("dm:read", onRead);
      socket.off("dm:error", onSocketError);
      socket.off("presence:update", onPresence);
      socketRef.current = null;
    };
  }, [activeId, refreshConversations, socket, user._id]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation._id === activeId),
    [activeId, conversations],
  );
  const activeOther = activeConversation
    ? otherParticipant(activeConversation, user._id)
    : null;

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return undefined;
    }
    let cancelled = false;
    const conversationId = activeId;
    setLoadingMessages(true);
    setMessageError("");
    async function loadHistory() {
      try {
        const data = await apiRequest(
          `/api/messages/conversations/${conversationId}/messages`,
        );
        if (!cancelled) {
          setMessages(mergeChronologicalMessages(Array.isArray(data.messages) ? data.messages : []));
          await refreshConversations();
          socketRef.current?.emit("dm:join", { conversationId }, (acknowledgement) => {
            if (acknowledgement?.error) {
              setMessageError(getFriendlyErrorMessage(new Error(acknowledgement.error), "Couldn't open this conversation."));
            }
          });
        }
      } catch (error) {
        if (!cancelled) {
          setMessageError(error.message || "We couldn't load this conversation's messages.");
          setMessages([]);
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    loadHistory();
    return () => {
      cancelled = true;
      socketRef.current?.emit("dm:leave", { conversationId });
    };
  }, [activeId, refreshConversations]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      setSearchError("");
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const data = await apiRequest(
          `/api/messages/users?search=${encodeURIComponent(search.trim())}`,
        );
        if (!cancelled) setSearchResults(Array.isArray(data.users) ? data.users : []);
      } catch (error) {
        if (!cancelled) {
          setSearchError(error.message || "Could not search students.");
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  async function openConversation(conversationId) {
    setActiveId(conversationId);
    setMobileShowConversation(true);
    setMessageError("");
    setNotice("");
  }

  async function startConversation(recipient) {
    setMessageError("");
    setNotice("");
    try {
      const data = await apiRequest("/api/messages/conversations", {
        method: "POST",
        body: JSON.stringify({ receiverId: recipient._id }),
      });
      const next = await refreshConversations();
      const conversation = data.conversation;
      const id = conversation?._id || recipient.conversationId;
      if (id) {
        setActiveId(id);
        setMobileShowConversation(true);
      }
      setSearch("");
      setSearchResults([]);
      setNotice(data.message || "Conversation request sent.");
      if (next && !next.some((item) => item._id === id) && conversation) {
        setConversations((current) => [conversation, ...current]);
      }
    } catch (error) {
      setMessageError(error.message || "Could not start the conversation.");
    }
  }

  async function updateRequest(action) {
    if (!activeId) return;
    setMessageError("");
    try {
      const data = await apiRequest(
        `/api/messages/conversations/${activeId}/${action}`,
        { method: "PATCH" },
      );
      setNotice(data.message || "Conversation request updated.");
      await refreshConversations();
    } catch (error) {
      setMessageError(error.message || "Could not update the request.");
    }
  }

  async function reportConversation() {
    if (!activeId) return;
    const reason = window.prompt("Briefly describe the concern (optional):");
    if (reason === null) return;
    setMessageError("");
    try {
      const data = await apiRequest(
        `/api/messages/conversations/${activeId}/report`,
        {
          method: "PATCH",
          body: JSON.stringify({ reason }),
        },
      );
      setNotice(data.message || "Conversation reported for review.");
      await refreshConversations();
    } catch (error) {
      setMessageError(error.message || "Could not report this conversation.");
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    if (pendingSendRef.current?.content !== text) {
      pendingSendRef.current = {
        content: text,
        id:
          globalThis.crypto?.randomUUID?.() ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    }
    const clientMessageId = pendingSendRef.current.id;
    setSending(true);
    setMessageError("");
    try {
      const data = await apiRequest(
        `/api/messages/conversations/${activeId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ message: text, clientMessageId }),
        },
      );
      setMessages((current) =>
        mergeChronologicalMessages(current, [data.data]),
      );
      setDraft("");
      pendingSendRef.current = null;
      await refreshConversations();
    } catch (error) {
      setMessageError(error.message || "Message failed to send. You can retry.");
    } finally {
      setSending(false);
    }
  }

  const incomingPending = (conversation) =>
    conversation.status === "PENDING" &&
    String(conversation.initiatedBy) !== String(user._id);
  const isAccepted = activeConversation?.status === "ACCEPTED";
  const unreadTotal = conversations.reduce(
    (total, conversation) => total + (conversation.unreadCount || 0),
    0,
  );

  useEffect(() => {
    onUnreadCount?.(unreadTotal);
  }, [onUnreadCount, unreadTotal]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="text-xl font-extrabold">Messages</h3>
          <p className="mt-1 text-sm text-slate-500">
            Private conversations with students at your institution.
          </p>
        </div>
        <span className="mt-3 self-start rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 sm:mt-0">
          {unreadTotal} unread
        </span>
      </div>

      {(messageError || conversationError || notice) && (
        <div className="space-y-2 px-4 pt-4 sm:px-6">
          {(messageError || conversationError) && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {messageError || conversationError}
            </div>
          )}
          {notice && (
            <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {notice}
            </div>
          )}
        </div>
      )}

      <div className="grid min-h-[620px] lg:grid-cols-[minmax(280px,0.38fr)_minmax(0,1fr)]">
        <aside
          className={`border-b border-slate-200 lg:border-b-0 lg:border-r ${
            mobileShowConversation ? "hidden lg:block" : ""
          }`}
        >
          <div className="border-b border-slate-100 p-4">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
              <Search size={17} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a student"
                className="w-full min-w-0 text-sm outline-none"
              />
            </label>
            {searchLoading && <p className="mt-3 text-xs text-slate-500">Searching...</p>}
            {searchError && <p role="alert" className="mt-3 text-xs text-red-700">{searchError}</p>}
            {search.trim().length > 0 && search.trim().length < 2 && (
              <p className="mt-3 text-xs text-slate-500">Type at least two characters.</p>
            )}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-100">
                {searchResults.map((candidate) => (
                  <button
                    key={candidate._id}
                    type="button"
                    onClick={() =>
                      candidate.conversationId
                        ? openConversation(candidate.conversationId)
                        : startConversation(candidate)
                    }
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-slate-50"
                  >
                    <Avatar name={candidate.name} image={candidate.profile?.avatar} online={candidate.isOnline} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{candidate.name}</span>
                      <span className="block text-xs text-slate-500">
                        {candidate.conversationStatus
                          ? `${candidate.conversationStatus.toLowerCase()} conversation`
                          : "Start conversation"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {loadingConversations && (
              <p className="p-6 text-center text-sm text-slate-500">Loading conversations...</p>
            )}
            {!loadingConversations && !conversationError && conversations.length === 0 && (
              <div className="p-7 text-center">
                <MessageCircle size={30} className="mx-auto text-blue-600" />
                <p className="mt-3 text-sm font-bold">No conversations yet</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Search for a student above to send a conversation request.
                </p>
              </div>
            )}
            {conversations.map((conversation) => {
              const participant = otherParticipant(conversation, user._id);
              const personId = String(participant?._id || participant || "");
              return (
                <button
                  key={conversation._id}
                  type="button"
                  onClick={() => openConversation(conversation._id)}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${
                    activeId === conversation._id ? "bg-blue-50" : ""
                  }`}
                >
                  <Avatar
                    name={participant?.name}
                    image={participant?.profile?.avatar}
                    online={onlineUsers.has(personId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold">
                        {participant?.name || "Student"}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatTime(conversation.lastMessageAt)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {conversation.status === "PENDING"
                        ? incomingPending(conversation)
                          ? "Incoming conversation request"
                          : "Request sent"
                        : conversation.status === "REPORTED"
                          ? "Reported conversation"
                          : conversation.lastMessage?.message || "No messages yet"}
                    </span>
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] font-bold text-white">
                      {conversation.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <div className={`${!mobileShowConversation ? "hidden lg:flex" : "flex"} min-h-[500px] flex-col`}>
          {!activeConversation ? (
            <div className="m-auto p-8 text-center text-sm text-slate-500">
              Select a conversation or search for a student.
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-slate-100 p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => setMobileShowConversation(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                  aria-label="Back to conversations"
                >
                  <X size={18} />
                </button>
                <Avatar
                  name={activeOther?.name}
                  image={activeOther?.profile?.avatar}
                  online={onlineUsers.has(String(activeOther?._id))}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{activeOther?.name || "Student"}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {!socketConnected
                      ? "Live connection reconnecting · messages are saved"
                      : activeConversation.status === "ACCEPTED"
                      ? onlineUsers.has(String(activeOther?._id))
                        ? "Online"
                        : "Conversation accepted"
                      : activeConversation.status.toLowerCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reportConversation}
                  aria-label="Report conversation"
                  title="Report conversation"
                  className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                >
                  <ShieldAlert size={18} />
                </button>
              </header>

              {incomingPending(activeConversation) && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-900">Accept this conversation request?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateRequest("accept")} className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white">
                      <Check size={14} /> Accept
                    </button>
                    <button type="button" onClick={() => updateRequest("decline")} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">
                      <X size={14} /> Decline
                    </button>
                  </div>
                </div>
              )}
              {activeConversation.status === "PENDING" &&
                !incomingPending(activeConversation) && (
                  <p className="border-b border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Your request is waiting for the other student. Messages are available after acceptance.
                  </p>
                )}
              {activeConversation.status === "REPORTED" && (
                <p className="border-b border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  This conversation was reported and is unavailable while it is reviewed.
                </p>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">
                {loadingMessages && (
                  <p className="text-center text-sm text-slate-500">Loading message history...</p>
                )}
                {!loadingMessages && messages.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">No messages in this conversation yet.</p>
                )}
                {messages.map((message) => {
                  const outgoing = String(message.sender?._id || message.sender) === String(user._id);
                  return (
                    <div key={messageId(message)} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                      <article className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[70%] ${outgoing ? "rounded-br-md bg-blue-700 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.message}</p>
                        <p className={`mt-1 text-right text-[10px] ${outgoing ? "text-blue-100" : "text-slate-400"}`}>
                          {formatTime(message.createdAt)}
                          {outgoing && message.isRead ? " · Read" : ""}
                        </p>
                      </article>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>

              <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-100 p-3 sm:p-4">
                <textarea
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    if (event.target.value.trim() !== pendingSendRef.current?.content) {
                      pendingSendRef.current = null;
                    }
                  }}
                  maxLength={2000}
                  rows={1}
                  disabled={!isAccepted || sending}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={isAccepted ? "Write a message..." : "Accept the conversation to message"}
                  className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 disabled:bg-slate-100"
                />
                <button
                  type="submit"
                  disabled={!isAccepted || !draft.trim() || sending}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
