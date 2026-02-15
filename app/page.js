"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const isValidUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

// 🧠 SYSTEM DESIGN: Metadata Cache
const metadataCache = new Map();

const fetchPageMetadata = async (url) => {
  if (metadataCache.has(url)) {
    console.log("✅ Cache hit for:", url);
    return metadataCache.get(url);
  }

  try {
    const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
    if (response.ok) {
      const data = await response.json();
      metadataCache.set(url, data);
      console.log("💾 Cached metadata for:", url);
      return data;
    }
  } catch (error) {
    console.error("Failed to fetch metadata:", error);
  }
  return null;
};

// 🧠 SYSTEM DESIGN: Debounce Hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// 🧠 SESSION HANDLING: Safely get user or refresh token
const getUserSafe = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) return user;

    const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn("⚠️ Refresh token invalid or expired", refreshError.message);
      return null;
    }

    return sessionData?.user || null;
  } catch (err) {
    console.error("Auth fetch failed:", err);
    return null;
  }
};

let lastSaveTime = 0;
const PAGE_SIZE = 6;

export default function Home() {
  const router = useRouter();
  const channelRef = useRef(null);

  const [user, setUser] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [search, setSearch] = useState("");
  const [webSearch, setWebSearch] = useState("");
  const [webResults, setWebResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [dark, setDark] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showWebSearch, setShowWebSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [page, setPage] = useState(1);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  // 🧠 SYSTEM DESIGN: Debounced search
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🧠 INIT: User + bookmarks with safe session handling
  useEffect(() => {
    const init = async () => {
      const currentUser = await getUserSafe();
      if (!currentUser) {
        toast.error("Session expired. Redirecting to login...");
        router.push("/login");
        return;
      }
      setUser(currentUser);

      const { data } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });
      setBookmarks(data || []);
    };
    init();
  }, [router]);

  // Real-time sync (simple and reliable)
  useEffect(() => {
    if (!user) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`bookmarks-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          setBookmarks((prev) => {
            if (eventType === "INSERT") {
              if (prev.find((b) => b.id === newRecord.id)) return prev;
              return [newRecord, ...prev];
            }
            if (eventType === "UPDATE") {
              return prev.map((b) => (b.id === newRecord.id ? newRecord : b));
            }
            if (eventType === "DELETE") {
              return prev.filter((b) => b.id !== oldRecord.id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [user]);

  const handleUrlChange = async (newUrl) => {
    setUrl(newUrl);
    
    if (newUrl && isValidUrl(newUrl) && !editingId && !title) {
      setFetchingMetadata(true);
      const metadata = await fetchPageMetadata(newUrl);
      if (metadata && metadata.title) {
        setTitle(metadata.title);
      }
      setFetchingMetadata(false);
    }
  };

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setUrl("");
    setShowForm(false);
  }, []);

  const handleSave = async () => {
    if (!title.trim() || !url.trim()) {
      toast.error("Fill all fields");
      return;
    }
    if (!isValidUrl(url)) {
      toast.error("Invalid URL");
      return;
    }
    const now = Date.now();
    if (now - lastSaveTime < 1200) {
      toast.error("Too fast — slow down");
      return;
    }
    lastSaveTime = now;

    if (editingId) {
      const { error } = await supabase
        .from("bookmarks")
        .update({ title, url })
        .eq("id", editingId);
      if (error) toast.error("Update failed");
      else {
        toast.success("Updated!");
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from("bookmarks")
        .insert([{ title, url, user_id: user.id }]);
      if (error) toast.error("Add failed");
      else {
        toast.success("Added!");
        resetForm();
      }
    }
  };

  const handleWebSearch = async () => {
    if (!webSearch.trim()) {
      toast.error("Enter a search term");
      return;
    }

    setIsSearching(true);
    setWebResults([]); // Clear previous results
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(webSearch)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        setWebResults(data.results);
        toast.success(`Found ${data.results.length} results`);
      } else {
        toast.error("No results found");
        setWebResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error(error.message || "Search failed - check console for details");
    } finally {
      setIsSearching(false);
    }
  };

  const addFromSearch = async (result) => {
    const { error } = await supabase
      .from("bookmarks")
      .insert([{ 
        title: result.title, 
        url: result.url, 
        user_id: user.id 
      }]);
    
    if (error) {
      console.error("Add error:", error);
      toast.error("Failed to add bookmark");
    } else {
      toast.success("Bookmark added!");
      setWebResults(webResults.filter(r => r.url !== result.url));
    }
  };

  const startEdit = useCallback((bookmark) => {
    setEditingId(bookmark.id);
    setTitle(bookmark.title);
    setUrl(bookmark.url);
    setShowForm(true);
    setShowWebSearch(false);
  }, []);

  const deleteBookmark = async (id) => {
    const { error } = await supabase.from("bookmarks").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else toast.success("Deleted");
  };

  const copyLink = useCallback((url) => {
    navigator.clipboard.writeText(url);
    toast.success("Copied!");
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleAddManuallyClick = useCallback(() => {
    if (showForm) {
      resetForm();
    } else {
      setShowForm(true);
      setShowWebSearch(false);
    }
  }, [showForm, resetForm]);

  const handleSearchWebClick = useCallback(() => {
    setShowWebSearch(prev => !prev);
    setShowForm(false);
    setWebResults([]);
  }, []);

  // 🔥 PERFORMANCE FIX: Optimize dark mode toggle with useCallback
  const toggleDarkMode = useCallback(() => {
    setDark(prev => !prev);
  }, []);

  // 🔥 CRITICAL: All hooks must be called BEFORE any conditional returns
  // Use debounced search for filtering (client-side)
  const filtered = useMemo(() => 
    bookmarks.filter((b) =>
      b.title.toLowerCase().includes(debouncedSearch.toLowerCase())
    ),
    [bookmarks, debouncedSearch]
  );

  const paginated = useMemo(() => 
    filtered.slice(0, page * PAGE_SIZE),
    [filtered, page]
  );

  // Early return AFTER all hooks
  if (!user) return null;

  return (
    <div
      className={`${dark ? 'dark' : ''} min-h-screen flex justify-center p-6`}
      // 🔥 PERFORMANCE FIX: Move background to separate layer to prevent repaints
      style={{
        background: dark
          ? 'linear-gradient(to bottom right, rgb(30 27 75), rgb(88 28 135), rgb(15 23 42))'
          : 'linear-gradient(to bottom right, rgb(239 246 255), rgb(224 231 255), rgb(243 232 255))'
      }}
    >
      <div
        className="w-full max-w-6xl h-[92vh] rounded-3xl backdrop-blur-xl
        bg-white/75 dark:bg-gray-900/80
        border border-white/40 dark:border-gray-700/70
        shadow-2xl p-8 overflow-y-auto
        transition-colors duration-300"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md">
              {user.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {user.email}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            {/* 🔥 PERFORMANCE FIX: Simplified button with optimized transitions */}
            <button
              onClick={toggleDarkMode}
              className={`
                px-5 py-2 rounded-full text-sm font-medium flex items-center gap-2
                shadow-sm hover:shadow-md active:scale-95
                transition-all duration-200
                ${dark 
                  ? "bg-gray-700/90 text-gray-100 hover:bg-gray-600 border border-gray-600/50" 
                  : "bg-gray-200/90 text-gray-800 hover:bg-gray-300 border border-gray-300"}`}
            >
              {dark ? <>☀️ Light</> : <>🌙 Dark</>}
            </button>

            <button
              onClick={logout}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Search with debounce indicator */}
        <div className="relative mb-6">
          <input
            placeholder="Search bookmarks (debounced 300ms)..."
            className="w-full md:w-1/2 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:ring-4 focus:ring-blue-400/30 focus:border-blue-500 outline-none transition-colors text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search !== debouncedSearch && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 md:right-auto md:left-[calc(50%+0.5rem)]">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <button
            onClick={handleSearchWebClick}
            className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 hover:shadow-xl transition text-white"
          >
            {showWebSearch ? "Cancel Search" : "🔍 Search Web"}
          </button>

          {!isMobile && (
            <button
              onClick={handleAddManuallyClick}
              className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 hover:shadow-xl transition text-white"
            >
              {showForm ? "Cancel" : "➕ Add Manually"}
            </button>
          )}
        </div>

        {/* Web Search Section */}
        <AnimatePresence>
          {showWebSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 bg-white/60 dark:bg-gray-800/85 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
            >
              <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                Search the Web
              </h3>
              
              <div className="flex gap-3 mb-4">
                <input
                  placeholder="Search for websites to bookmark..."
                  className="flex-1 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-4 focus:ring-emerald-400/30 outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  value={webSearch}
                  onChange={(e) => setWebSearch(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleWebSearch()}
                />
                <button
                  onClick={handleWebSearch}
                  disabled={isSearching}
                  className="px-8 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 transition disabled:opacity-50"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>

              {webResults.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300">
                    Results ({webResults.length})
                  </h4>
                  {webResults.map((result, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-start gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {result.title}
                        </h5>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {result.url}
                        </a>
                        {result.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                            {result.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => addFromSearch(result)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition whitespace-nowrap"
                      >
                        + Add
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Add Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 mb-8 bg-white/60 dark:bg-gray-800/85 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Bookmark" : "Add New Bookmark"}
              </h3>
              
              <input
                placeholder="Title"
                className="w-full p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-4 focus:ring-indigo-400/30 outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="relative">
                <input
                  placeholder="https://example.com"
                  className="w-full p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-4 focus:ring-indigo-400/30 outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                />
                {fetchingMetadata && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 transition"
                >
                  {editingId ? "Update" : "Add"}
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 py-3 rounded-xl bg-gray-500 hover:bg-gray-600 text-white transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bookmark Grid */}
        <div className={`grid gap-6 ${isMobile ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {paginated.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group p-6 rounded-2xl backdrop-blur-lg bg-white/80 dark:bg-gray-800/90 border border-white/40 dark:border-gray-700 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row justify-between gap-4"
            >
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <p className="font-semibold text-lg text-gray-900 dark:text-white">{b.title}</p>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm break-all"
                >
                  {b.url}
                </a>
              </div>

              <div className="flex sm:flex-col gap-2 text-sm whitespace-nowrap">
                <button
                  onClick={() => startEdit(b)}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => copyLink(b.url)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                >
                  Copy
                </button>
                <button
                  onClick={() => deleteBookmark(b.id)}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Load More */}
        {paginated.length < filtered.length && (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="mt-10 w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg hover:brightness-110 transition"
          >
            Load More ({paginated.length} of {filtered.length})
          </button>
        )}

        {/* Mobile Floating Buttons */}
        {isMobile && (
          <div className="fixed bottom-8 right-6 flex flex-col gap-3">
            <button
              onClick={handleSearchWebClick}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white w-16 h-16 rounded-full text-2xl shadow-2xl flex items-center justify-center transition transform hover:scale-110"
            >
              🔍
            </button>
            <button
              onClick={handleAddManuallyClick}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white w-16 h-16 rounded-full text-4xl shadow-2xl flex items-center justify-center transition transform hover:scale-110"
            >
              {showForm ? "×" : "+"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}