import React, { useEffect, useState, useRef, useCallback } from "react";
import socket from "../socket";
import API from "../api";
import { useNavigate } from "react-router-dom";
import "./Chat.css";

// Helper: get initials from username or group name
const getInitials = (name) => {
  if (!name) return "?";
  return name.slice(0, 2).toUpperCase();
};

// Helper: avatar color class from index
const getAvatarColor = (index) => `avatar-color-${Math.abs(index) % 7}`;

// Helper: format time
const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// Helper: format date separator
const formatDateSep = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

// Helper: get display name for a chat
const getChatDisplayName = (chat, currentUserId) => {
  if (chat.isGroupChat) return chat.chatName || "Group Chat";
  const otherUser = chat.users?.find((u) => (u._id || u) !== currentUserId);
  return otherUser?.username || "Chat";
};

// Helper: get other user from private chat
const getOtherUser = (chat, currentUserId) => {
  if (chat.isGroupChat) return null;
  return chat.users?.find((u) => (u._id || u) !== currentUserId);
};

function Chat() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const messagesEndRef = useRef(null);

  // State
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState("chats"); // "chats" or "users"
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [typingInfo, setTypingInfo] = useState(null); // { chatId, userId }

  // Group creation modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Register socket on mount
  useEffect(() => {
    if (currentUser._id) {
      socket.emit("setup", currentUser._id);
    }

    socket.on("online-users", (userIds) => {
      setOnlineUserIds(userIds);
    });

    socket.on("user-online", (userId) => {
      setOnlineUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    });

    socket.on("user-offline", (userId) => {
      setOnlineUserIds((prev) => prev.filter((id) => id !== userId));
    });

    return () => {
      socket.off("online-users");
      socket.off("user-online");
      socket.off("user-offline");
    };
  }, [currentUser._id]);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/auth/users");
        setUsers(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Fetch all chats
  const fetchChats = useCallback(async () => {
    try {
      const res = await API.get("/chats/");
      setChats(res.data || []);
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Search filter for sidebar
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (sidebarTab === "chats") {
      if (!q) {
        setFilteredItems(chats);
      } else {
        setFilteredItems(
          chats.filter((chat) => {
            const name = getChatDisplayName(chat, currentUser._id);
            return name.toLowerCase().includes(q);
          })
        );
      }
    } else {
      // users tab
      if (!q) {
        setFilteredItems(users);
      } else {
        setFilteredItems(
          users.filter(
            (u) =>
              u.username?.toLowerCase().includes(q) ||
              u.email?.toLowerCase().includes(q)
          )
        );
      }
    }
  }, [searchQuery, sidebarTab, chats, users, currentUser._id]);

  // Socket: listen for incoming messages
  useEffect(() => {
    const handleMessage = (msg) => {
      const msgChatId = msg.chats?._id || msg.chats;
      const senderId = msg.sender?._id || msg.sender;

      // If this message is for the currently open chat, add to messages
      setSelectedChat((current) => {
        if (current && current._id === msgChatId) {
          // Only add if not a duplicate of our optimistic message
          if (senderId === currentUser._id) {
            // Replace optimistic message with server version
            setMessages((prev) => {
              const withoutOptimistic = prev.filter(
                (m) => !(m._optimistic && m.content === msg.content)
              );
              return [...withoutOptimistic, msg];
            });
          } else {
            setMessages((prev) => [...prev, msg]);
          }
        }
        return current;
      });

      // Update chat list — move this chat to top
      fetchChats();
    };

    socket.on("recieve-message", handleMessage);

    return () => {
      socket.off("recieve-message", handleMessage);
    };
  }, [currentUser._id, fetchChats]);

  // Typing indicators
  useEffect(() => {
    const handleTyping = (data) => {
      setTypingInfo(data);
    };
    const handleStopTyping = () => {
      setTypingInfo(null);
    };

    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);

    return () => {
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
    };
  }, []);

  // Open/create chat with a user (from Users tab)
  const openChatWithUser = async (user) => {
    setMobileSidebarOpen(false);
    setLoadingMessages(true);
    setMessages([]);

    try {
      // Create or get existing private chat
      const chatRes = await API.post("/chats/create", {
        users: [user._id],
        isGroupChat: false,
      });
      const chat = chatRes.data;
      setSelectedChat(chat);

      // Join the socket room
      socket.emit("join-chat", chat._id);

      // Fetch existing messages
      const msgRes = await API.get(`/messages/get/${chat._id}`);
      setMessages(msgRes.data || []);

      // Refresh chat list and switch to chats tab
      await fetchChats();
      setSidebarTab("chats");
    } catch (err) {
      console.error("Failed to open chat:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Open an existing chat (from Chats tab)
  const openExistingChat = async (chat) => {
    setSelectedChat(chat);
    setMobileSidebarOpen(false);
    setLoadingMessages(true);
    setMessages([]);

    try {
      // Join the socket room
      socket.emit("join-chat", chat._id);

      // Fetch existing messages
      const msgRes = await API.get(`/messages/get/${chat._id}`);
      setMessages(msgRes.data || []);
    } catch (err) {
      console.error("Failed to open chat:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Send message
  const handleSend = () => {
    if (!newMessage.trim() || !selectedChat) return;

    const msgData = {
      sender: currentUser._id,
      content: newMessage.trim(),
      chatId: selectedChat._id,
    };

    socket.emit("send_message", msgData);

    // Optimistic local append
    setMessages((prev) => [
      ...prev,
      {
        sender: { _id: currentUser._id, username: currentUser.username, email: currentUser.email },
        content: newMessage.trim(),
        createdAt: new Date().toISOString(),
        _optimistic: true,
      },
    ]);
    setNewMessage("");

    // Stop typing
    socket.emit("stop-typing", selectedChat._id);
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Typing handler
  let typingTimeout = useRef(null);
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (selectedChat) {
      socket.emit("typing", selectedChat._id);
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit("stop-typing", selectedChat._id);
      }, 2000);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await API.post("/auth/logout");
    } catch (err) {
      // ignore
    }
    localStorage.removeItem("user");
    navigate("/");
  };

  // === Group creation ===
  const toggleGroupUser = (userId) => {
    setSelectedGroupUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedGroupUsers.length < 2) return;
    setCreatingGroup(true);

    try {
      const res = await API.post("/chats/create", {
        users: selectedGroupUsers,
        isGroupChat: true,
        chatName: groupName.trim(),
      });

      const newGroup = res.data;

      // Tell other online members' sockets to join this room
      socket.emit("new-group-created", newGroup);
      // Join ourselves
      socket.emit("join-chat", newGroup._id);

      // Reset modal
      setShowGroupModal(false);
      setGroupName("");
      setSelectedGroupUsers([]);
      setGroupSearchQuery("");

      // Refresh chats and open the new group
      await fetchChats();
      setSelectedChat(newGroup);
      setMessages([]);
      setSidebarTab("chats");
    } catch (err) {
      console.error("Failed to create group:", err);
    } finally {
      setCreatingGroup(false);
    }
  };

  // Filtered users for group modal search
  const filteredGroupUsers = groupSearchQuery.trim()
    ? users.filter(
        (u) =>
          u.username?.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
          u.email?.toLowerCase().includes(groupSearchQuery.toLowerCase())
      )
    : users;

  // Group messages by date
  const renderMessages = () => {
    const items = [];
    let lastDate = null;

    messages.forEach((msg, i) => {
      const msgDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : null;
      if (msgDate && msgDate !== lastDate) {
        items.push(
          <div key={`date-${i}`} className="date-separator">
            <span>{formatDateSep(msg.createdAt)}</span>
          </div>
        );
        lastDate = msgDate;
      }

      const senderId = msg.sender?._id || msg.sender;
      const isSent = senderId === currentUser._id;
      const senderName = msg.sender?.username || "Unknown";
      const senderIdx = users.findIndex((u) => u._id === senderId);

      items.push(
        <div key={msg._id || `opt-${i}`} className={`msg-row ${isSent ? "sent" : "received"}`}>
          {!isSent && (
            <div className={`msg-avatar-small ${getAvatarColor(senderIdx >= 0 ? senderIdx : 0)}`}>
              {getInitials(senderName)}
            </div>
          )}
          <div className="msg-bubble">
            {!isSent && selectedChat?.isGroupChat && <div className="msg-sender">{senderName}</div>}
            <p className="msg-text">{msg.content}</p>
            <div className="msg-time">
              {formatTime(msg.createdAt)}
              {isSent && msg._optimistic && <span className="msg-pending"> ○</span>}
              {isSent && !msg._optimistic && <span className="msg-delivered"> ✓</span>}
            </div>
          </div>
        </div>
      );
    });

    return items;
  };

  // Get chat header info
  const getChatHeaderInfo = () => {
    if (!selectedChat) return {};
    if (selectedChat.isGroupChat) {
      const memberNames = selectedChat.users
        ?.map((u) => u.username || u.email)
        .filter(Boolean)
        .join(", ");
      return {
        name: selectedChat.chatName || "Group Chat",
        subtitle: `${selectedChat.users?.length || 0} members`,
        secondSubtitle: memberNames,
        isGroup: true,
      };
    }
    const otherUser = getOtherUser(selectedChat, currentUser._id);
    const isOnline = otherUser && onlineUserIds.includes(otherUser._id);
    return {
      name: otherUser?.username || "Chat",
      subtitle: isOnline ? "Online" : otherUser?.email || "",
      isGroup: false,
      isOnline,
      otherUser,
    };
  };

  const headerInfo = getChatHeaderInfo();

  return (
    <div className="chat-page">
      {/* ===== Sidebar ===== */}
      <div className={`chat-sidebar ${!mobileSidebarOpen ? "hidden-mobile" : ""}`}>
        <div className="sidebar-header">
          <h2>Aura Spaces</h2>
          <div className="sidebar-user-info">
            <span className="user-label">{currentUser.username || currentUser.email}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div className="sidebar-tabs">
          <button
            className={`tab-btn ${sidebarTab === "chats" ? "active" : ""}`}
            onClick={() => setSidebarTab("chats")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chats
          </button>
          <button
            className={`tab-btn ${sidebarTab === "users" ? "active" : ""}`}
            onClick={() => setSidebarTab("users")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Users
          </button>
          <button className="tab-btn new-group-btn" onClick={() => setShowGroupModal(true)} title="Create Group">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Group
          </button>
        </div>

        <div className="sidebar-search">
          <input
            type="text"
            placeholder={sidebarTab === "chats" ? "Search chats..." : "Search users..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="user-list">
          {loadingUsers ? (
            <div className="chat-loading">
              <div className="chat-spinner"></div>
            </div>
          ) : sidebarTab === "chats" ? (
            // === CHATS TAB ===
            filteredItems.length === 0 ? (
              <div className="no-users-msg">
                <p>No chats yet</p>
                <p className="no-users-hint">Go to Users tab to start chatting</p>
              </div>
            ) : (
              filteredItems.map((chat, idx) => {
                const displayName = getChatDisplayName(chat, currentUser._id);
                const otherUser = getOtherUser(chat, currentUser._id);
                const isOnline = otherUser && onlineUserIds.includes(otherUser._id);
                const hashIdx = chat._id ? chat._id.charCodeAt(0) : idx;

                return (
                  <div
                    key={chat._id}
                    className={`user-list-item ${selectedChat?._id === chat._id ? "active" : ""}`}
                    onClick={() => openExistingChat(chat)}
                  >
                    <div className={`user-avatar ${getAvatarColor(hashIdx)}`}>
                      {chat.isGroupChat && <div className="group-badge">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="10" height="10">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>}
                      {!chat.isGroupChat && isOnline && <div className="online-dot"></div>}
                      {getInitials(displayName)}
                    </div>
                    <div className="user-item-info">
                      <div className="user-item-name">{displayName}</div>
                      <div className="user-item-email">
                        {chat.isGroupChat
                          ? `${chat.users?.length || 0} members`
                          : otherUser?.email || ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            // === USERS TAB ===
            filteredItems.length === 0 ? (
              <div className="no-users-msg">No users found</div>
            ) : (
              filteredItems.map((user, idx) => {
                const isOnline = onlineUserIds.includes(user._id);
                return (
                  <div
                    key={user._id}
                    className="user-list-item"
                    onClick={() => openChatWithUser(user)}
                  >
                    <div className={`user-avatar ${getAvatarColor(idx)}`}>
                      {isOnline && <div className="online-dot"></div>}
                      {getInitials(user.username)}
                    </div>
                    <div className="user-item-info">
                      <div className="user-item-name">{user.username}</div>
                      <div className="user-item-email">{user.email}</div>
                    </div>
                    {isOnline && <span className="online-badge">Online</span>}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* ===== Main Chat ===== */}
      <div className="chat-main">
        {!selectedChat ? (
          <div className="chat-placeholder">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3>Welcome to Aura Spaces</h3>
            <p>Select a chat or user from the sidebar to start chatting</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <button className="mobile-back-btn" onClick={() => setMobileSidebarOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className={`chat-header-avatar ${getAvatarColor(
                selectedChat._id ? selectedChat._id.charCodeAt(0) : 0
              )}`}>
                {headerInfo.isGroup && (
                  <div className="header-group-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                {!headerInfo.isGroup && getInitials(headerInfo.name)}
                {headerInfo.isOnline && <div className="online-dot header-online-dot"></div>}
              </div>
              <div className="chat-header-info">
                <h3>{headerInfo.name}</h3>
                <span className={headerInfo.isOnline ? "online-text" : ""}>
                  {typingInfo && typingInfo.chatId === selectedChat._id
                    ? "typing..."
                    : headerInfo.subtitle}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {loadingMessages ? (
                <div className="chat-loading">
                  <div className="chat-spinner"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="no-messages">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <p>No messages yet. Say hello! 👋</p>
                </div>
              ) : (
                renderMessages()
              )}
              {typingInfo && typingInfo.chatId === selectedChat._id && (
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-area">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              <button className="send-btn" onClick={handleSend} disabled={!newMessage.trim()}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===== Create Group Modal ===== */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Group</h3>
              <button className="modal-close-btn" onClick={() => setShowGroupModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-input-group">
                <label>Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. Project Team, Friends..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="modal-input"
                />
              </div>

              {/* Selected users chips */}
              {selectedGroupUsers.length > 0 && (
                <div className="selected-chips">
                  {selectedGroupUsers.map((uid) => {
                    const u = users.find((x) => x._id === uid);
                    return (
                      <div key={uid} className="user-chip">
                        <span>{u?.username || uid}</span>
                        <button onClick={() => toggleGroupUser(uid)} className="chip-remove">×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="modal-input-group">
                <label>Add Members ({selectedGroupUsers.length} selected — min 2)</label>
                <input
                  type="text"
                  placeholder="Search users to add..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="modal-input"
                />
              </div>

              <div className="modal-user-list">
                {filteredGroupUsers.map((user, idx) => {
                  const isSelected = selectedGroupUsers.includes(user._id);
                  return (
                    <div
                      key={user._id}
                      className={`modal-user-item ${isSelected ? "selected" : ""}`}
                      onClick={() => toggleGroupUser(user._id)}
                    >
                      <div className="modal-checkbox">
                        {isSelected && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className={`user-avatar small ${getAvatarColor(idx)}`}>
                        {getInitials(user.username)}
                      </div>
                      <div className="modal-user-info">
                        <div className="modal-user-name">{user.username}</div>
                        <div className="modal-user-email">{user.email}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel-btn"
                onClick={() => setShowGroupModal(false)}
              >
                Cancel
              </button>
              <button
                className="modal-create-btn"
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedGroupUsers.length < 2 || creatingGroup}
              >
                {creatingGroup ? (
                  <div className="chat-spinner small"></div>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Group
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
