// web/src/components/LiveDealsFeed.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { useLiveDeals } from "../hooks/useLiveDeals"; // ✅ Firestore hook

import logoPng from "../assets/logo.png";
import iconPng from "../assets/icon.png";
import splashPng from "../assets/splash.png";

/* ───────────────────────── Types ───────────────────────── */
type FirestoreLikeTimestamp =
  | { seconds: number; nanoseconds?: number }
  | number
  | Date
  | undefined;

type Deal = {
  id: string;
  title?: string;
  store?: string;
  price?: number;
  originalPrice?: number;
  discountPct?: number;
  category?: string;
  image?: string;
  imgUrl?: string;
  rare?: boolean;
  isHot?: boolean;
  latitude?: number;
  longitude?: number;
  timestamp?: FirestoreLikeTimestamp;
  _distanceKm?: number | null;
};
/* ───────────────────────── Utilities ───────────────────────── */
function toDate(ts: FirestoreLikeTimestamp): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "object" && "seconds" in ts)
    return new Date(ts.seconds * 1000);
  return null;
}

function timeAgo(ts: FirestoreLikeTimestamp): string {
  const d = toDate(ts);
  if (!d) return "Unknown";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function isLive(ts: FirestoreLikeTimestamp, windowMins = 10): boolean {
  const d = toDate(ts);
  if (!d) return false;
  return Date.now() - d.getTime() <= windowMins * 60 * 1000;
}

function computeDiscountPct(deal: Deal): number | null {
  if (typeof deal.discountPct === "number") return deal.discountPct;
  if (deal.price != null && deal.originalPrice && deal.originalPrice > 0) {
    const pct =
      ((deal.originalPrice - deal.price) / deal.originalPrice) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }
  return null;
}

function kmDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistanceKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/* ───────────────────────── Component ───────────────────────── */
const LiveDealsFeed: React.FC = () => {
  const { deals = [], loading } = useLiveDeals();

  // ✅ Hooks (must always execute, even when loading)
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] =
    useState<"newest" | "price_low" | "price_high" | "discount">("newest");
  const [category, setCategory] = useState("all");
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [visibleCount, setVisibleCount] = useState(20);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Motion values (safe transform numbers)
  const scrollY = useMotionValue(0);
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.3]);
  const headerScale = useTransform(scrollY, [0, 100], [1, 0.97]);

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => {},
      { maximumAge: 60_000 }
    );
  }, []);

  // ❌ Removed: if (loading) return ...
  // ✅ Loading state will be rendered later inside the JSX

  // Category extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => d.category && set.add(d.category));
    return ["all", ...Array.from(set).sort()];
  }, [deals]);

  // Enrichment
  const enriched = useMemo(() => {
    return deals.map((d) => {
      const pct = computeDiscountPct(d);
      const hot = d.isHot ?? (typeof d.price === "number" && d.price < 10);
      const distance =
        coords && d.latitude != null && d.longitude != null
          ? kmDistance(coords, { lat: d.latitude, lng: d.longitude })
          : null;
      return {
        ...d,
        discountPct: pct ?? undefined,
        isHot: hot,
        _distanceKm: distance,
      };
    });
  }, [deals, coords]);

  // Filter + Sort
  const filteredSorted = useMemo(() => {
    const q = query.toLowerCase();
    let arr = enriched.filter((d) => {
      if (showFavOnly && !favorites.includes(d.id)) return false;
      if (
        category !== "all" &&
        (d.category ?? "").toLowerCase() !== category.toLowerCase()
      )
        return false;
      if (q) {
        const hay = `${d.title ?? ""} ${d.store ?? ""} ${d.category ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    switch (sortBy) {
      case "price_low":
        arr.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        break;
      case "price_high":
        arr.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
        break;
      case "discount":
        arr.sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0));
        break;
      default:
        arr.sort(
          (a, b) =>
            (toDate(b.timestamp)?.getTime() ?? 0) -
            (toDate(a.timestamp)?.getTime() ?? 0)
        );
    }
    return arr;
  }, [enriched, query, favorites, showFavOnly, category, sortBy]);

  // Infinite scroll
  const onScroll = useCallback(() => {
    scrollY.set(window.scrollY);
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 300
    ) {
      setVisibleCount((c) => Math.min(c + 20, filteredSorted.length));
    }
    setShowScrollTop(window.scrollY > 400);
  }, [filteredSorted.length, scrollY]);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const toggleFav = (id: string) =>
    setFavorites((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id]
    );

  // Theme
  const theme = {
    bg: "#0f1115",
    card: "#161b22",
    text: "#e6edf3",
    sub: "#9ba6b1",
    border: "#30363d",
    accent: "#FF6600",
    skeleton: "#1a1f2d",
  };

  /* ───────────── Deal Card ───────────── */
  const DealCard: React.FC<{ d: Deal }> = ({ d }) => {
    const img = d.image || d.imgUrl;
    const pct = computeDiscountPct(d);
    const live = isLive(d.timestamp);
    const fav = favorites.includes(d.id);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        whileHover={{ scale: 1.02 }}
        style={{
          border: `1px solid ${theme.border}`,
          background: theme.card,
          borderRadius: 14,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "120px 1fr",
          gap: 12,
          padding: 12,
        }}
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          style={{
            width: 120,
            height: 120,
            borderRadius: 10,
            overflow: "hidden",
            background: theme.skeleton,
          }}
        >
          {img ? (
            <img
              src={img}
              alt={d.title ?? ""}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                display: "grid",
                placeItems: "center",
                height: "100%",
                color: theme.sub,
                fontSize: 12,
              }}
            >
              No Image
            </div>
          )}
        </motion.div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700 }}>{d.title ?? "Untitled Deal"}</div>
            <motion.button
              whileHover={{
                scale: 1.1,
                textShadow: `0 0 8px ${theme.accent}`,
              }}
              whileTap={{ scale: 0.9 }}
              onClick={() => toggleFav(d.id)}
              style={{
                border: `1px solid ${fav ? theme.accent : theme.border}`,
                background: fav ? theme.accent : "transparent",
                color: fav ? "#fff" : theme.text,
                borderRadius: 10,
                padding: "4px 10px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {fav ? "♥" : "♡"} Save
            </motion.button>
          </div>

          <div style={{ color: theme.sub, fontSize: 14 }}>
            {d.store ?? "Unknown"} •{" "}
            {d.price != null ? `$${d.price.toFixed(2)}` : "N/A"} •{" "}
            {timeAgo(d.timestamp)}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {live && (
              <motion.span
                animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  background: "#10b981",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 12,
                }}
              >
                🟢 Live
              </motion.span>
            )}
            {d.isHot && (
              <span
                style={{
                  background: "#f97316",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 12,
                }}
              >
                🔥 Hot
              </span>
            )}
            {d.rare && (
              <span
                style={{
                  background: "#8b5cf6",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 12,
                }}
              >
                🦄 Rare
              </span>
            )}
            {d._distanceKm != null && (
              <span
                style={{
                  background: "#334155",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 12,
                }}
              >
                📍 {formatDistanceKm(d._distanceKm)}
              </span>
            )}
          </div>

          {pct != null && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1 }}
              style={{
                height: 8,
                borderRadius: 999,
                background: `linear-gradient(90deg, #22c55e, #f97316, #ef4444)`,
                marginTop: 10,
              }}
              title={`${pct}% off`}
            />
          )}
        </div>
      </motion.div>
    );
  };

  /* ─────────────── Render ─────────────── */
  return (
    <div
      ref={listRef}
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        padding: "0 16px 140px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif",
      }}
    >
      {/* HEADER */}
      <motion.div
        style={{
          position: "relative",
          height: 60,
          margin: "8px 0 12px",
          borderRadius: 10,
          overflow: "hidden",
          opacity: Number(headerOpacity.get()),
          transform: `scale(${Number(headerScale.get())})`,
          background: `url(${splashPng}) center/cover no-repeat`,
          border: `1px solid ${theme.border}`,
        }}
        onClick={scrollToTop}
        title="Back to top"
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.25 }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(15,17,21,.65), rgba(15,17,21,.25) 40%, rgba(15,17,21,.65))",
          }}
        />
        <div
          style={{
            position: "relative",
            height: "100%",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            gap: 8,
            fontWeight: 800,
            letterSpacing: 0.2,
          }}
        >
          <span style={{ fontSize: 18 }}>⚡ FlashRadar Live Deals</span>
        </div>
      </motion.div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          placeholder="Search deals, stores, categories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            border: `1px solid ${theme.border}`,
            background: theme.card,
            color: theme.text,
            borderRadius: 10,
            padding: "10px 12px",
            outline: "none",
          }}
        />
        <motion.select
          whileHover={{ scale: 1.03 }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            border: `1px solid ${theme.border}`,
            background: theme.card,
            color: theme.text,
            borderRadius: 10,
            padding: "10px 12px",
            outline: "none",
          }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All Categories" : c}
            </option>
          ))}
        </motion.select>
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(
              e.target.value as "newest" | "price_low" | "price_high" | "discount"
            )
          }
          style={{
            border: `1px solid ${theme.border}`,
            background: theme.card,
            color: theme.text,
            borderRadius: 10,
            padding: "10px 12px",
            outline: "none",
          }}
        >
          <option value="newest">Newest</option>
          <option value="price_low">Price Low → High</option>
          <option value="price_high">Price High → Low</option>
          <option value="discount">Best Discount</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={showFavOnly}
            onChange={(e) => setShowFavOnly(e.target.checked)}
          />
          Favorites
        </label>
      </div>
            {/* LOADING STATE */}
      {loading && (
        <div
          style={{
            color: "#fff",
            textAlign: "center",
            padding: 40,
            minHeight: "100vh",
            background: "#0f1115",
          }}
        >
          🔄 Loading live deals...
        </div>
      )}

            {/* Deals Grid */}
      {!loading && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.08 },
            },
          }}
          style={{
            display: "grid",
            gap: 12,
            paddingBottom: 120, // keeps space above the floating icons
          }}
        >
          {filteredSorted.map((d) => (
            <DealCard key={d.id} d={d} />
          ))}
        </motion.div>
      )}

      {/* Floating Scroll Top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 30 }}
            animate={{
              opacity: 1,
              y: [0, -5, 0],
              transition: {
                opacity: { duration: 0.4 },
                y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
              },
            }}
            exit={{ opacity: 0, y: 30 }}
            whileHover={{
              scale: 1.1,
              boxShadow: `0 0 15px ${theme.accent}`,
            }}
            onClick={scrollToTop}
            style={{
              position: "fixed",
              bottom: 96,
              right: 24,
              border: "none",
              background: theme.accent,
              color: "#fff",
              borderRadius: "50%",
              width: 56,
              height: 56,
              cursor: "pointer",
              fontSize: 24,
              display: "grid",
              placeItems: "center",
              zIndex: 100,
            }}
            aria-label="Back to top"
            title="Back to top"
          >
            ⬆️
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Social Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(22,27,34,0.9)",
          border: `1px solid ${theme.border}`,
          borderRadius: 14,
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          zIndex: 200,
          backdropFilter: "blur(6px)",
        }}
      >
        <a
          href="https://www.tiktok.com/@flashradar.app?_t=ZT-91031D8JrYV&_r=1"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "grid",
            justifyItems: "center",
            textDecoration: "none",
            color: theme.text,
            gap: 6,
          }}
          title="Open TikTok"
        >
          <motion.img
            src={logoPng}
            alt="TikTok"
            width={48}
            height={48}
            style={{ borderRadius: 10, display: "block" }}
            whileHover={{ scale: 1.08, rotate: 2 }}
            whileTap={{ scale: 0.95 }}
          />
          <span style={{ fontWeight: 800 }}>TikTok</span>
        </a>

        <a
          href="https://www.instagram.com/flashradar_app?igsh=MTUwcjBrNHI1a3J2ZA%3D%3D&utm_source=qr"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "grid",
            justifyItems: "center",
            textDecoration: "none",
            color: theme.text,
            gap: 6,
          }}
          title="Open Instagram"
        >
          <motion.img
            src={iconPng}
            alt="Instagram"
            width={48}
            height={48}
            style={{ borderRadius: 10, display: "block" }}
            whileHover={{ scale: 1.08, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
          />
          <span style={{ fontWeight: 800 }}>Instagram</span>
        </a>
      </div>
    </div>
  );
};

export default LiveDealsFeed;
