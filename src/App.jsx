import { useState, useEffect, useRef } from "react";
import {
  ArrowRight, Trophy, Mail, Lock, ShieldCheck, Trash2, Users, LogOut,
} from "lucide-react";
import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Photo pool
//
// The app counts whatever is in the PHOTOS array. N photos → N-1 rounds.
//
// Below is a small placeholder set so the app runs out of the box (in-chat
// preview, CodeSandbox, etc.). When you're ready to use your real photos in
// a Vite project, replace this whole block with the Vite loader — see
// SETUP.md, section "Plugging in your own photos".
// ---------------------------------------------------------------------------
const photoModules = import.meta.glob(
  "./assets/photos/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG,WEBP}",
  { eager: true, import: "default" }
);

const PHOTOS = Object.entries(photoModules)
  .sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  )
  .map(([path, url], i) => {
    const n = i + 1;
    return {
      id: `photo_${String(n).padStart(2, "0")}`,
      url,
      order: n,
      filename: path.split("/").pop(),
    };
  });

const TOTAL_PHOTOS = PHOTOS.length;

// ---------------------------------------------------------------------------
// Global font + theme styles. Committing to a warm editorial aesthetic:
// cream paper background, ink-black type, burnt-terracotta accent. Fraunces
// italic as the display voice (high contrast, characterful); Geist for UI.
// ---------------------------------------------------------------------------
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..800;1,9..144,300..800&family=Geist:wght@300..700&display=swap');

  .pd-root, .pd-root * {
    font-family: 'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .pd-serif {
    font-family: 'Fraunces', 'Cormorant Garamond', Georgia, serif;
    font-feature-settings: "ss01", "ss02";
  }
  .pd-serif-italic {
    font-family: 'Fraunces', 'Cormorant Garamond', Georgia, serif;
    font-style: italic;
    font-feature-settings: "ss01", "ss02";
  }

  /* Paper grain */
  .pd-grain {
    background-image:
      radial-gradient(rgba(26,23,20,0.035) 1px, transparent 1px),
      radial-gradient(rgba(26,23,20,0.025) 1px, transparent 1px);
    background-size: 3px 3px, 7px 7px;
    background-position: 0 0, 1px 2px;
  }

  /* Card animations */
  @keyframes pdPickedPulse {
    0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(200,68,30,0.0); }
    35%  { transform: scale(1.025);  box-shadow: 0 0 0 14px rgba(200,68,30,0.18); }
    100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(200,68,30,0.0); }
  }
  @keyframes pdRejectedFall {
    0%   { opacity: 1; transform: scale(1)    rotate(0deg)  translateY(0); filter: grayscale(0); }
    100% { opacity: 0; transform: scale(0.92) rotate(-2.5deg) translateY(24px); filter: grayscale(1); }
  }
  @keyframes pdEnter {
    0%   { opacity: 0; transform: scale(0.96) translateY(18px); }
    100% { opacity: 1; transform: scale(1)    translateY(0); }
  }
  @keyframes pdFadeUp {
    0%   { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes pdCrownSparkle {
    0%, 100% { transform: translateY(0) rotate(-4deg); }
    50%      { transform: translateY(-4px) rotate(-4deg); }
  }
  @keyframes pdVsWobble {
    0%, 100% { transform: rotate(-6deg); }
    50%      { transform: rotate(-3deg) scale(1.03); }
  }

  .pd-picked   { animation: pdPickedPulse 650ms cubic-bezier(.2,.8,.2,1) forwards; }
  .pd-rejected { animation: pdRejectedFall 600ms cubic-bezier(.4,0,.7,.2) forwards; }
  .pd-enter    { animation: pdEnter 520ms cubic-bezier(.2,.8,.2,1) both; }
  .pd-fade-up  { animation: pdFadeUp 520ms cubic-bezier(.2,.8,.2,1) both; }
  .pd-vs-wobble{ animation: pdVsWobble 3.6s ease-in-out infinite; transform-origin: center; }

  .pd-card {
    transition: transform 260ms cubic-bezier(.2,.8,.2,1),
                box-shadow 260ms cubic-bezier(.2,.8,.2,1),
                filter    260ms ease;
  }
  .pd-card:hover:not(.pd-locked) {
    transform: translateY(-6px);
    box-shadow: 0 24px 60px -20px rgba(26,23,20,0.28),
                0 2px 0 0 rgba(26,23,20,0.08);
  }
  .pd-card:active:not(.pd-locked) {
    transform: translateY(-2px) scale(0.995);
  }

  .pd-btn-primary {
    transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
  }
  .pd-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px -10px rgba(200,68,30,0.55);
  }
  .pd-btn-primary:active { transform: translateY(0); }

  .pd-input {
    transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
  }
  .pd-input:focus {
    border-color: #C8441E;
    box-shadow: 0 0 0 4px rgba(200,68,30,0.15);
    background: #fffdf8;
  }

  .pd-progress-fill {
    transition: width 620ms cubic-bezier(.2,.8,.2,1);
  }

  /* Confetti-ish flecks on winner screen */
  @keyframes pdFleckFall {
    0%   { transform: translateY(-20px) rotate(0deg);   opacity: 0; }
    10%  { opacity: 1; }
    100% { transform: translateY(120vh) rotate(540deg); opacity: 0; }
  }
  .pd-fleck {
    position: absolute;
    top: -20px;
    width: 8px; height: 14px;
    border-radius: 2px;
    animation: pdFleckFall linear forwards;
  }

  /* Saving indicator pulse */
  @keyframes pdSavingPulse {
    0%, 100% { opacity: 0.35; transform: scale(0.85); }
    50%      { opacity: 1;    transform: scale(1.1);  }
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const isValidEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());

// ---------------------------------------------------------------------------
// Access control.
//
// ⚠️  PRODUCTION WARNING: the admin password below lives in client code and
// will be visible to anyone who opens devtools. For a real deployment, move
// this check to a backend endpoint (Supabase Auth with a role, or a simple
// serverless function that validates the password and returns a short-lived
// session token).
// ---------------------------------------------------------------------------
const ADMIN_EMAIL    = "admin@onftech.com";
const ADMIN_PASSWORD = "Onftech.2025";

// Whitelist — only these emails can sign in.
const ALLOWED_EMAILS = new Set([
  "admin@onftech.com",
  "atopal@onftech.com",
  "agural@onftech.com",
  "abalturk@onftech.com",
  "asanal@onftech.com",
  "aeroglu@onftech.com",
  "agundogan@onftech.com",
  "bbustunel@onftech.com",
  "bdogan@onftech.com",
  "bozdemir@onftech.com",
  "cozturk@onftech.com",
  "ekaraca@onftech.com",
  "eyilmaz@onftech.com",
  "ebolukoglu@onftech.com",
  "eozdemir@onftech.com",
  "esalanzi@onftech.com",
  "fyildirim@onftech.com",
  "fjunaid@onftech.com",
  "gkabakci@onftech.com",
  "hozyer@onftech.com",
  "iozbey@onftech.com",
  "kkhan@onftech.com",
  "mmayez@onftech.com",
  "mqureshi@onftech.com",
  "mkhwaja@onftech.com",
  "nragheb@onftech.com",
  "njha@onftech.com",
  "nouriab@onftech.com",
  "bkarakaya@onftech.com",
  "otopal@onftech.com",
  "okatib@onftech.com",
  "rbirdal@onftech.com",
  "swasif@onftech.com",
  "sekinci@onftech.com",
  "sghamdi@onftech.com",
  "smoiz@onftech.com",
  "ttemurtas@onftech.com",
  "tgurler@onftech.com",
  "ugolcuk@onftech.com",
  "uertas@onftech.com",
  "vkaya@onftech.com",
  "yerdem@onftech.com",
]);

const isAllowedEmail = (v) =>
  ALLOWED_EMAILS.has((v || "").trim().toLowerCase());

const isAdminEmail = (v) =>
  (v || "").trim().toLowerCase() === ADMIN_EMAIL;

// ---------------------------------------------------------------------------
// Storage — persists to Supabase (Postgres).
//
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, plus
// the voted_emails / photo_tallies / vote_sessions tables + RPC helpers
// (increment_tally, decrement_tally, commit_session) created via the SQL
// migration.
//
// A tiny in-memory cache keeps the entry screens snappy. Admin calls
// invalidateCache() before reading so the dashboard is always fresh.
// ---------------------------------------------------------------------------

let _cache = { emails: null, tallies: null, sessions: null, at: 0 };
const CACHE_MS = 8000;

function invalidateCache() { _cache = { emails: null, tallies: null, sessions: null, at: 0 }; }

async function loadAll({ force = false } = {}) {
  if (!force && _cache.emails && Date.now() - _cache.at < CACHE_MS) return _cache;
  const [emails, tallies, sessions] = await Promise.all([
    supabase.from("voted_emails").select("email").order("created_at", { ascending: true }),
    supabase.from("photo_tallies").select("photo_id, wins"),
    supabase.from("vote_sessions")
      .select("email, started_at, completed_at, final_winner_photo_id, history")
      .order("created_at", { ascending: true }),
  ]);
  if (emails.error)   console.error("loadAll emails:",   emails.error);
  if (tallies.error)  console.error("loadAll tallies:",  tallies.error);
  if (sessions.error) console.error("loadAll sessions:", sessions.error);
  const talliesMap = {};
  for (const row of tallies.data || []) talliesMap[row.photo_id] = row.wins;
  _cache = {
    emails:   (emails.data || []).map((r) => r.email),
    tallies:  talliesMap,
    sessions: (sessions.data || []).map((s) => ({
      email: s.email,
      startedAt: s.started_at,
      completedAt: s.completed_at,
      finalWinnerPhotoId: s.final_winner_photo_id,
      history: s.history || [],
    })),
    at: Date.now(),
  };
  return _cache;
}

// --- Public API (same signatures as before) --------------------------------

async function hasEmailVoted(email) {
  const lower = email.toLowerCase();
  // Always fresh-check for this one — mis-allow would be bad.
  const { data, error } = await supabase
    .from("voted_emails").select("email").eq("email", lower).maybeSingle();
  if (error) { console.error("hasEmailVoted:", error); return false; }
  return !!data;
}

async function getTallies()  { return (await loadAll()).tallies; }
async function getSessions() { return (await loadAll()).sessions; }
async function getVoters()   { return (await loadAll()).emails; }

// Single round-trip atomic commit via server-side function.
async function commitCompletedSession({
  email, finalWinnerPhotoId, startedAt, completedAt, history,
}) {
  const { error } = await supabase.rpc("commit_session", {
    p_email: (email || "").toLowerCase(),
    p_final_winner_photo_id: finalWinnerPhotoId,
    p_started_at: startedAt,
    p_completed_at: completedAt,
    p_history: history || [],
  });
  if (error) { console.error("commit_session:", error); throw error; }
  invalidateCache();
}

// Kept for compatibility — admin reset paths still call these individually.
async function recordEmailVoted(email) {
  const { error } = await supabase
    .from("voted_emails").upsert({ email: email.toLowerCase() }, { onConflict: "email" });
  if (error) console.error("recordEmailVoted:", error);
  invalidateCache();
}

async function addToTallies(photoIds) {
  await Promise.all(photoIds.map((id) =>
    supabase.rpc("increment_tally", { p_photo_id: id }).then(({ error }) => {
      if (error) console.error("increment_tally:", error);
    })
  ));
  invalidateCache();
}

async function addSession(session) {
  const { error } = await supabase.from("vote_sessions").insert({
    email: (session.email || "").toLowerCase(),
    started_at: session.startedAt,
    completed_at: session.completedAt,
    final_winner_photo_id: session.finalWinnerPhotoId,
    history: session.history || [],
  });
  if (error) console.error("addSession:", error);
  invalidateCache();
}

// Admin-only: wipes every row from all three tables.
async function resetAllData() {
  await Promise.all([
    supabase.from("voted_emails").delete().neq("email", ""),
    supabase.from("photo_tallies").delete().neq("photo_id", ""),
    supabase.from("vote_sessions").delete().neq("email", ""),
  ]);
  invalidateCache();
}

// Admin-only: reset one user. Removes their email + sessions, and
// decrements the tally for each session final winner they had.
async function resetSingleUser(email) {
  const lower = email.toLowerCase();
  // 1) Grab their sessions to know what to decrement.
  const { data: sessions, error: sErr } = await supabase
    .from("vote_sessions").select("final_winner_photo_id").eq("email", lower);
  if (sErr) { console.error("resetSingleUser fetch:", sErr); return; }
  // 2) Decrement each winner.
  await Promise.all((
    sessions || []
  ).map((s) => supabase.rpc("decrement_tally", { p_photo_id: s.final_winner_photo_id })));
  // 3) Delete their email + sessions.
  await Promise.all([
    supabase.from("voted_emails").delete().eq("email", lower),
    supabase.from("vote_sessions").delete().eq("email", lower),
  ]);
  invalidateCache();
}

const COLORS = {
  cream: "#F5F0E6",
  creamDeep: "#EEE6D3",
  ink: "#1A1714",
  inkSoft: "#3A332B",
  muted: "#8A8170",
  accent: "#C8441E",
  accentDeep: "#A0351A",
  line: "#D9CFBD",
  card: "#FFFFFF",
};

// ---------------------------------------------------------------------------
// Entry screen — email gate
// ---------------------------------------------------------------------------
function EntryScreen({ onStart, onAlreadyVoted, onAdminEmailEntered }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (checking) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email to begin.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError("That doesn't look like a valid email.");
      return;
    }
    if (!isAllowedEmail(trimmed)) {
      setError("This email is not on the participant list.");
      return;
    }

    // Admin email → separate password step. Skip duplicate check.
    if (isAdminEmail(trimmed)) {
      onAdminEmailEntered(trimmed);
      return;
    }

    setChecking(true);
    const alreadyVoted = await hasEmailVoted(trimmed);
    setChecking(false);

    if (alreadyVoted) {
      onAlreadyVoted();
      return;
    }

    onStart(trimmed);
  };

  return (
    <div className="pd-fade-up min-h-screen w-full flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[360px]">
        {/* Tiny editorial eyebrow */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span
            className="text-[11px] tracking-[0.32em] uppercase"
            style={{ color: COLORS.muted }}
          >
            Photo Duel · Vol.01
          </span>
        </div>

        <h1
          className="pd-serif text-center leading-[0.95] mb-8"
          style={{
            color: COLORS.ink,
            fontSize: "clamp(32px, 7vw, 44px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          Pick the one
          <br />
          that{" "}
          <span className="pd-serif-italic" style={{ color: COLORS.accent }}>
            moves
          </span>{" "}
          you.
        </h1>

        {/* Prize callout */}
        <div
          className="rounded-xl px-4 py-4 mb-6"
          style={{
            background: COLORS.card,
            border: `1.5px solid ${COLORS.accent}`,
            boxShadow: "0 10px 28px -14px rgba(200,68,30,0.35)",
          }}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Trophy size={12} style={{ color: COLORS.accent }} />
            <span
              className="text-[10px] tracking-[0.32em] uppercase"
              style={{ color: COLORS.accent }}
            >
              The Prize
            </span>
          </div>
          <div
            className="pd-serif-italic text-[20px] text-center leading-tight"
            style={{ color: COLORS.ink, fontWeight: 400 }}
          >
            CEO for a day — April 23
          </div>
          <div
            className="text-[11px] text-center mt-1.5 leading-snug"
            style={{ color: COLORS.muted }}
          >
            The owner of the winning photograph will serve
            <br />
            as CEO of the company for one full day.
          </div>
        </div>

        {/* Email card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            boxShadow: "0 30px 60px -40px rgba(26,23,20,0.25)",
          }}
        >
          <label
            className="block text-[11px] tracking-[0.22em] uppercase mb-2"
            style={{ color: COLORS.muted }}
          >
            Your email
          </label>

          <div
            className="pd-input flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              border: `1.5px solid ${error ? COLORS.accent : COLORS.line}`,
              background: "#fdfaf2",
            }}
          >
            <Mail size={18} style={{ color: COLORS.muted }} />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@onftech.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="flex-1 bg-transparent outline-none text-[15px] min-w-0"
              style={{ color: COLORS.ink }}
            />
          </div>

          {error && (
            <div
              className="mt-2 text-[13px]"
              style={{ color: COLORS.accentDeep }}
            >
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={checking}
            className="pd-btn-primary mt-5 w-full rounded-xl py-3.5 text-[15px] font-medium flex items-center justify-center gap-2"
            style={{
              background: checking ? COLORS.inkSoft : COLORS.ink,
              color: COLORS.cream,
              letterSpacing: "0.01em",
              opacity: checking ? 0.85 : 1,
              cursor: checking ? "wait" : "pointer",
            }}
          >
            {checking ? "Checking…" : <>Start voting <ArrowRight size={17} /></>}
          </button>

          <div
            className="mt-3 text-[11px] text-center"
            style={{ color: COLORS.muted }}
          >
            Only invited Onftech team members can participate.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo card (used in voting + winner reveal)
// ---------------------------------------------------------------------------
function PhotoCard({
  photo,
  side,
  onPick,
  state,          // 'idle' | 'picked' | 'rejected'
  locked,
  entering,
  badge,
}) {
  const extra =
    state === "picked"    ? "pd-picked"   :
    state === "rejected"  ? "pd-rejected" :
    entering              ? "pd-enter"    : "";

  return (
    <button
      type="button"
      onClick={() => !locked && onPick?.(side)}
      disabled={locked}
      aria-label={`Choose ${side} photo`}
      className={`pd-card ${locked ? "pd-locked" : ""} ${extra} group relative rounded-2xl overflow-hidden w-full text-left`}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
        boxShadow: "0 18px 40px -24px rgba(26,23,20,0.28)",
        cursor: locked ? "default" : "pointer",
        aspectRatio: "3 / 4",
      }}
    >
      {/* Badge: "Left" / "Right" hint */}
      {badge && (
        <div
          className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-[10px] tracking-[0.22em] uppercase pd-serif-italic"
          style={{
            background: "rgba(255,253,247,0.9)",
            color: COLORS.inkSoft,
            backdropFilter: "blur(6px)",
            border: `1px solid ${COLORS.line}`,
          }}
        >
          {badge}
        </div>
      )}

      <img
        src={photo.url}
        alt={photo.id}
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Subtle gradient for hover hint */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "linear-gradient(to top, rgba(26,23,20,0.55) 0%, rgba(26,23,20,0.05) 40%, rgba(26,23,20,0) 100%)",
        }}
      />

      {/* Hover CTA */}
      <div
        className="absolute left-4 bottom-4 right-4 pointer-events-none opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300"
        style={{ color: "#fffdf7" }}
      >
        <div className="pd-serif-italic text-[18px] leading-none">
          Choose this →
        </div>
      </div>

      {/* Picked overlay */}
      {state === "picked" && (
        <div
          className="absolute inset-0 flex items-end justify-start p-4 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(200,68,30,0.35) 0%, rgba(200,68,30,0) 55%)",
          }}
        >
          <div
            className="pd-serif-italic text-[22px] leading-none"
            style={{ color: "#fffdf7", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
          >
            kept.
          </div>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Voting screen
// ---------------------------------------------------------------------------
function VotingScreen({ email, onDone }) {
  // Fisher-Yates shuffle — each session gets a fresh order, guaranteeing
  // every photo appears exactly once without duplicates.
  const deckRef = useRef(null);
  if (deckRef.current === null) {
    const deck = [...PHOTOS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    deckRef.current = deck;
  }
  const DECK = deckRef.current;

  const [leftIdx, setLeftIdx]       = useState(0);
  const [rightIdx, setRightIdx]     = useState(1);
  const [nextIdx, setNextIdx]       = useState(2);
  const [round, setRound]           = useState(1);
  const [picked, setPicked]         = useState(null);     // 'left' | 'right' | null
  const [leftEntering, setLeftEntering]   = useState(false);
  const [rightEntering, setRightEntering] = useState(false);
  const [locked, setLocked]         = useState(false);
  const [history, setHistory]       = useState([]);
  const startedAtRef                = useRef(new Date().toISOString());

  const totalRounds = TOTAL_PHOTOS - 1; // 44
  const progressPct = ((round - 1) / totalRounds) * 100;

  const handlePick = (side) => {
    if (locked) return;
    setPicked(side);
    setLocked(true);

    const leftPhoto    = DECK[leftIdx];
    const rightPhoto   = DECK[rightIdx];
    const selected     = side === "left" ? leftPhoto : rightPhoto;
    const rejected     = side === "left" ? rightPhoto : leftPhoto;
    const voteRecord   = {
      round,
      leftPhotoId:     leftPhoto.id,
      rightPhotoId:    rightPhoto.id,
      selectedPhotoId: selected.id,
      rejectedPhotoId: rejected.id,
      timestamp: new Date().toISOString(),
    };
    const nextHistory  = [...history, voteRecord];
    setHistory(nextHistory);

    // Is this the final round? We're out of photos if nextIdx >= TOTAL_PHOTOS.
    if (nextIdx >= TOTAL_PHOTOS) {
      setTimeout(() => {
        onDone({
          email,
          startedAt:   startedAtRef.current,
          completedAt: new Date().toISOString(),
          finalWinnerPhotoId: selected.id,
          finalWinnerIdx: side === "left" ? leftIdx : rightIdx,
          history: nextHistory,
        });
      }, 720);
      return;
    }

    // Advance: replace the rejected slot with the next challenger photo
    setTimeout(() => {
      if (side === "left") {
        setRightIdx(nextIdx);
        setRightEntering(true);
      } else {
        setLeftIdx(nextIdx);
        setLeftEntering(true);
      }
      setNextIdx((n) => n + 1);
      setRound((r) => r + 1);
      setPicked(null);

      // Clear the entering state on the next tick, unlock UI
      setTimeout(() => {
        setLeftEntering(false);
        setRightEntering(false);
        setLocked(false);
      }, 540);
    }, 620);
  };

  const leftPhoto  = DECK[leftIdx];
  const rightPhoto = DECK[rightIdx];

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 sm:px-6 py-6 sm:py-8">
      {/* Top bar: progress */}
      <div className="w-full max-w-[1180px] pd-fade-up">
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-baseline gap-3">
            <span
              className="pd-serif text-[22px] leading-none"
              style={{ color: COLORS.ink, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              Round
            </span>
            <span
              className="pd-serif-italic text-[34px] leading-none"
              style={{ color: COLORS.accent, fontWeight: 400 }}
            >
              {round}
            </span>
            <span
              className="text-[12px] tracking-[0.24em] uppercase"
              style={{ color: COLORS.muted }}
            >
              of {totalRounds}
            </span>
          </div>
          <div
            className="text-[11px] tracking-[0.28em] uppercase hidden sm:block"
            style={{ color: COLORS.muted }}
          >
            {TOTAL_PHOTOS - nextIdx > 0
              ? `${TOTAL_PHOTOS - nextIdx} left in the deck`
              : "Final round"}
          </div>
        </div>

        {/* Progress line */}
        <div
          className="relative h-[3px] rounded-full overflow-hidden"
          style={{ background: COLORS.creamDeep }}
        >
          <div
            className="pd-progress-fill absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentDeep})`,
            }}
          />
        </div>
      </div>

      {/* Duel area — always side by side */}
      <div className="w-full max-w-[1180px] mt-6 sm:mt-10 flex-1 flex items-center">
        <div className="w-full relative flex flex-row items-stretch gap-2 sm:gap-5 md:gap-6">
          {/* Left photo */}
          <div className="flex-1 min-w-0">
            <PhotoCard
              photo={leftPhoto}
              side="left"
              onPick={handlePick}
              state={
                picked === "left"  ? "picked"   :
                picked === "right" ? "rejected" : "idle"
              }
              locked={locked}
              entering={leftEntering}
              badge="A"
            />
          </div>

          {/* VS divider — absolutely centered on all sizes */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-none">
            <div
              className="pd-vs-wobble flex items-center justify-center rounded-full"
              style={{
                width: "clamp(52px, 9vw, 86px)",
                height: "clamp(52px, 9vw, 86px)",
                background: COLORS.ink,
                color: COLORS.cream,
                boxShadow:
                  "0 14px 40px -10px rgba(26,23,20,0.5), inset 0 0 0 1px rgba(245,240,230,0.08)",
              }}
            >
              <span
                className="pd-serif-italic"
                style={{ fontSize: "clamp(20px, 3.6vw, 32px)", lineHeight: 1, fontWeight: 400 }}
              >
                vs
              </span>
            </div>
          </div>

          {/* Right photo */}
          <div className="flex-1 min-w-0">
            <PhotoCard
              photo={rightPhoto}
              side="right"
              onPick={handlePick}
              state={
                picked === "right" ? "picked"   :
                picked === "left"  ? "rejected" : "idle"
              }
              locked={locked}
              entering={rightEntering}
              badge="B"
            />
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="mt-8 sm:mt-10 text-center">
        <div
          className="pd-serif-italic text-[18px] sm:text-[20px]"
          style={{ color: COLORS.inkSoft, fontWeight: 400 }}
        >
          Tap the one you prefer.
        </div>
        <div
          className="mt-1 text-[12px] tracking-[0.24em] uppercase"
          style={{ color: COLORS.muted }}
        >
          Your pick stays · the other is replaced
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Already-voted gate — shown when a user tries to sign in after finishing.
// Deliberately does NOT reveal their champion photo, since login is email-only
// (no password) and someone else could try their address.
// ---------------------------------------------------------------------------
function AlreadyVotedScreen({ onBack }) {
  return (
    <div className="pd-fade-up min-h-screen w-full flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <ShieldCheck size={13} style={{ color: COLORS.accent }} />
          <span
            className="text-[11px] tracking-[0.32em] uppercase"
            style={{ color: COLORS.accent }}
          >
            Already Recorded
          </span>
        </div>

        <h1
          className="pd-serif leading-[0.95] mb-5"
          style={{
            color: COLORS.ink,
            fontSize: "clamp(32px, 7vw, 46px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          Your vote is{" "}
          <span className="pd-serif-italic" style={{ color: COLORS.accent }}>
            already in.
          </span>
        </h1>

        <p
          className="leading-relaxed mb-8"
          style={{ color: COLORS.inkSoft, fontSize: 15 }}
        >
          This email has already completed the duel. Each person gets one vote,
          so you're all set.
        </p>

        {/* Contact info card */}
        <div
          className="rounded-xl px-5 py-4 mb-8 text-left"
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
          }}
        >
          <div
            className="text-[10px] tracking-[0.28em] uppercase mb-1.5"
            style={{ color: COLORS.muted }}
          >
            Think this is a mistake?
          </div>
          <div
            className="leading-relaxed"
            style={{ color: COLORS.inkSoft, fontSize: 14 }}
          >
            Please reach out to{" "}
            <a
              href="mailto:ebolukoglu@onftech.com"
              className="pd-serif-italic"
              style={{
                color: COLORS.accent,
                textDecorationLine: "underline",
                textDecorationColor: COLORS.accent + "60",
                textUnderlineOffset: "3px",
                fontSize: 16,
              }}
            >
              ebolukoglu@onftech.com
            </a>{" "}
            and they'll sort it out.
          </div>
        </div>

        <button
          onClick={onBack}
          className="text-[11px] tracking-[0.2em] uppercase"
          style={{ color: COLORS.muted }}
        >
          ← Use a different email
        </button>
      </div>
    </div>
  );
}


// Displays the photo they ended on as their personal pick. No community data,
// no rankings — just their answer to "which one stays?".
// ---------------------------------------------------------------------------
function PersonalWinnerScreen({ winnerPhoto, commitStatus = "idle" }) {
  // Confetti flecks for a small celebratory moment
  const flecks = Array.from({ length: 22 }).map((_, i) => {
    const palette = [COLORS.accent, COLORS.ink, "#E9A23B", "#4A6B5B", COLORS.accentDeep];
    return {
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.6}s`,
      duration: `${3.2 + Math.random() * 2.4}s`,
      color: palette[i % palette.length],
      rotate: `${Math.random() * 60 - 30}deg`,
    };
  });

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-5 py-10 overflow-hidden">
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {flecks.map((f, i) => (
          <span
            key={i}
            className="pd-fleck"
            style={{
              left: f.left,
              background: f.color,
              animationDelay: f.delay,
              animationDuration: f.duration,
              transform: `rotate(${f.rotate})`,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-[560px] pd-fade-up relative">
        {/* Eyebrow */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="h-px w-10 inline-block" style={{ background: COLORS.line }} />
          <span
            className="flex items-center gap-2 text-[11px] tracking-[0.32em] uppercase"
            style={{ color: COLORS.accent }}
          >
            <Trophy size={13} /> Your Pick
          </span>
          <span className="h-px w-10 inline-block" style={{ background: COLORS.line }} />
        </div>

        <h2
          className="pd-serif text-center leading-[0.95] mb-7"
          style={{
            color: COLORS.ink,
            fontSize: "clamp(34px, 6.5vw, 54px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          This is the one{" "}
          <span className="pd-serif-italic" style={{ color: COLORS.accent }}>
            you
          </span>{" "}
          kept.
        </h2>

        {/* Winner card */}
        <div
          className="relative mx-auto rounded-2xl overflow-hidden"
          style={{
            width: "min(360px, 86vw)",
            aspectRatio: "3 / 4",
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            boxShadow: "0 40px 80px -30px rgba(26,23,20,0.4)",
          }}
        >
          <img
            src={winnerPhoto.url}
            alt={winnerPhoto.id}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
          <div
            className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-[0.22em] uppercase"
            style={{
              background: COLORS.accent,
              color: "#fffdf7",
              boxShadow: "0 6px 20px -6px rgba(200,68,30,0.6)",
            }}
          >
            <Trophy size={11} /> Your Winner
          </div>
        </div>

        <div
          className="mt-10 text-center text-[13px] flex items-center justify-center gap-2"
          style={{ color: COLORS.muted }}
        >
          {commitStatus === "saving" && (
            <>
              <span
                className="inline-block rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  background: COLORS.accent,
                  animation: "pdSavingPulse 1.1s ease-in-out infinite",
                }}
              />
              <span>Saving your vote…</span>
            </>
          )}
          {commitStatus === "saved" && <span>Thanks for voting. See you on April 23.</span>}
          {commitStatus === "error" && (
            <span style={{ color: COLORS.accentDeep }}>
              Couldn't save — please refresh and try again.
            </span>
          )}
          {commitStatus === "idle" && <span>Thanks for voting. See you on April 23.</span>}
        </div>
      </div>
    </div>
  );
}


function PodiumCard({ photo, rank, highlight }) {
  const sizes = {
    1: { w: "min(200px, 32vw)" },
    2: { w: "min(148px, 25vw)" },
    3: { w: "min(148px, 25vw)" },
  };
  const medalBg =
    rank === 1 ? COLORS.accent :
    rank === 2 ? "#B8AE9A" : "#C4925E";

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          width: sizes[rank].w,
          aspectRatio: "3 / 4",
          background: COLORS.card,
          border: highlight ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.line}`,
          boxShadow: highlight
            ? "0 28px 60px -18px rgba(200,68,30,0.45)"
            : "0 14px 36px -20px rgba(26,23,20,0.3)",
        }}
      >
        <img
          src={photo.url}
          alt={photo.id}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        <div
          className="absolute top-2 left-2 rounded-full flex items-center justify-center pd-serif-italic"
          style={{
            width: rank === 1 ? 36 : 30,
            height: rank === 1 ? 36 : 30,
            background: medalBg,
            color: "#fffdf7",
            fontSize: rank === 1 ? 20 : 16,
            fontWeight: 400,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          }}
        >
          {rank}
        </div>
      </div>
      <div className="mt-3 text-center">
        <div
          className="pd-serif-italic leading-none"
          style={{
            color: COLORS.ink,
            fontSize: rank === 1 ? 30 : 22,
            fontWeight: 400,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {photo.votes}
        </div>
        <div
          className="text-[10px] tracking-[0.22em] uppercase mt-1.5"
          style={{ color: COLORS.muted }}
        >
          {photo.votes === 1 ? "vote" : "votes"}
        </div>
      </div>
    </div>
  );
}

function RankRow({ rank, photo, maxVotes }) {
  const pct = maxVotes > 0 ? (photo.votes / maxVotes) * 100 : 0;
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2"
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
      }}
    >
      <div
        className="text-[11px] tracking-[0.1em] flex-shrink-0"
        style={{
          color: COLORS.muted,
          width: 30,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        #{rank}
      </div>
      <div
        className="rounded-md overflow-hidden flex-shrink-0"
        style={{ width: 40, height: 52, background: COLORS.creamDeep }}
      >
        <img
          src={photo.url}
          alt={photo.id}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="h-[6px] rounded-full overflow-hidden"
          style={{ background: COLORS.creamDeep }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              minWidth: photo.votes > 0 ? 6 : 0,
              background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentDeep})`,
              transition: "width 700ms cubic-bezier(.2,.8,.2,1)",
            }}
          />
        </div>
      </div>
      <div
        className="pd-serif-italic flex-shrink-0 text-right"
        style={{
          color: COLORS.ink,
          fontSize: 16,
          fontVariantNumeric: "tabular-nums",
          width: 36,
        }}
      >
        {photo.votes}
      </div>
    </div>
  );
}



// ---------------------------------------------------------------------------
// Password step — gates the admin dashboard.
// ---------------------------------------------------------------------------
function PasswordScreen({ email, onVerify, onBack }) {
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [verifying, setVerifying] = useState(false);

  const submit = () => {
    if (verifying) return;
    if (!password) {
      setError("Please enter the password.");
      return;
    }
    setVerifying(true);
    // Tiny delay for UX — in production this would be a real backend call
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        onVerify();
      } else {
        setError("Incorrect password.");
        setPassword("");
        setVerifying(false);
      }
    }, 450);
  };

  return (
    <div className="pd-fade-up min-h-screen w-full flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[360px]">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <ShieldCheck size={13} style={{ color: COLORS.accent }} />
          <span
            className="text-[11px] tracking-[0.32em] uppercase"
            style={{ color: COLORS.accent }}
          >
            Admin Access
          </span>
        </div>

        <h1
          className="pd-serif text-center leading-[0.95] mb-8"
          style={{
            color: COLORS.ink,
            fontSize: "clamp(30px, 6vw, 40px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          One more{" "}
          <span className="pd-serif-italic" style={{ color: COLORS.accent }}>
            step.
          </span>
        </h1>

        <div
          className="rounded-2xl p-6"
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            boxShadow: "0 30px 60px -40px rgba(26,23,20,0.25)",
          }}
        >
          {/* Email read-only display */}
          <label
            className="block text-[11px] tracking-[0.22em] uppercase mb-2"
            style={{ color: COLORS.muted }}
          >
            Signed in as
          </label>
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
            style={{ background: COLORS.creamDeep, color: COLORS.inkSoft }}
          >
            <Mail size={16} style={{ color: COLORS.muted }} />
            <span className="text-[14px] truncate">{email}</span>
          </div>

          <label
            className="block text-[11px] tracking-[0.22em] uppercase mb-2"
            style={{ color: COLORS.muted }}
          >
            Password
          </label>
          <div
            className="pd-input flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              border: `1.5px solid ${error ? COLORS.accent : COLORS.line}`,
              background: "#fdfaf2",
            }}
          >
            <Lock size={18} style={{ color: COLORS.muted }} />
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="flex-1 bg-transparent outline-none text-[15px] min-w-0"
              style={{ color: COLORS.ink, letterSpacing: "0.15em" }}
            />
          </div>

          {error && (
            <div
              className="mt-2 text-[13px]"
              style={{ color: COLORS.accentDeep }}
            >
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={verifying}
            className="pd-btn-primary mt-5 w-full rounded-xl py-3.5 text-[15px] font-medium flex items-center justify-center gap-2"
            style={{
              background: verifying ? COLORS.inkSoft : COLORS.ink,
              color: COLORS.cream,
              opacity: verifying ? 0.85 : 1,
              cursor: verifying ? "wait" : "pointer",
            }}
          >
            {verifying ? "Verifying…" : <>Continue <ArrowRight size={17} /></>}
          </button>

          <button
            onClick={onBack}
            className="mt-3 w-full text-[12px] tracking-[0.12em] uppercase"
            style={{ color: COLORS.muted }}
          >
            ← Use a different email
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin dashboard — rankings + voter list + reset button.
// ---------------------------------------------------------------------------
function AdminScreen({ onLogout }) {
  const [loading, setLoading]         = useState(true);
  const [tallies, setTallies]         = useState({});
  const [sessions, setSessions]       = useState([]);
  const [voters, setVoters]           = useState([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting]     = useState(false);
  const [toast, setToast]             = useState("");

  const load = async () => {
    invalidateCache();
    const [t, s, v] = await Promise.all([getTallies(), getSessions(), getVoters()]);
    setTallies(t);
    setSessions(s);
    setVoters(v);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReset = async () => {
    setResetting(true);
    await resetAllData();
    setTallies({});
    setSessions([]);
    setVoters([]);
    setConfirmReset(false);
    setResetting(false);
    setToast("All voting data has been cleared.");
    setTimeout(() => setToast(""), 3000);
  };

  // Per-user reset — two-click confirmation per row
  const [confirmUserReset, setConfirmUserReset] = useState(null); // email | null
  const [resettingUser, setResettingUser]       = useState(null);

  const handleResetUser = async (voterEmail) => {
    setResettingUser(voterEmail);
    await resetSingleUser(voterEmail);
    // Refresh local state from storage
    await load();
    setConfirmUserReset(null);
    setResettingUser(null);
    setToast(`Cleared ${voterEmail}'s vote.`);
    setTimeout(() => setToast(""), 3000);
  };

  const ranked = PHOTOS
    .map((p) => ({ ...p, votes: tallies[p.id] || 0 }))
    .sort((a, b) => b.votes - a.votes || a.order - b.order);

  const maxVotes   = Math.max(1, ranked[0]?.votes || 0);
  const totalVotes = Object.values(tallies).reduce((s, n) => s + n, 0); // = champions crowned
  const totalDuels = sessions.reduce((s, sess) => s + (sess.history?.length || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-5">
        <div
          className="pd-serif-italic"
          style={{ color: COLORS.muted, fontSize: 22 }}
        >
          Loading admin data…
        </div>
      </div>
    );
  }

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="min-h-screen w-full px-4 sm:px-5 py-10">
      {/* Top bar */}
      <div className="max-w-[760px] mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} style={{ color: COLORS.accent }} />
          <span
            className="text-[11px] tracking-[0.32em] uppercase"
            style={{ color: COLORS.accent }}
          >
            Admin · Onftech
          </span>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase"
          style={{ color: COLORS.muted }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>

      <div className="max-w-[760px] mx-auto pd-fade-up">
        {/* Title */}
        <h1
          className="pd-serif leading-[0.95] mb-3"
          style={{
            color: COLORS.ink,
            fontSize: "clamp(36px, 6.5vw, 54px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          Voting{" "}
          <span className="pd-serif-italic" style={{ color: COLORS.accent }}>
            details.
          </span>
        </h1>
        <p
          className="mb-10 leading-relaxed"
          style={{ color: COLORS.inkSoft, fontSize: 14 }}
        >
          Live data across every session. Only you can see this view.
        </p>

        {/* Toast */}
        {toast && (
          <div
            className="pd-fade-up mb-8 rounded-xl px-4 py-3 text-[13px]"
            style={{
              background: "#E8F0E5",
              color: "#2F5A3A",
              border: "1px solid #C9DCC5",
            }}
          >
            ✓ {toast}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-12">
          <Stat label="Voters"      value={voters.length} mono />
          <Stat label="Champions"   value={totalVotes}    mono />
          <Stat label="Duels cast"  value={totalDuels}    mono />
        </div>

        {/* Rankings */}
        {voters.length > 0 ? (
          <>
            <SectionHeader title="Photo Rankings" />

            {/* Podium */}
            <div className="flex flex-row items-end justify-center gap-3 sm:gap-5 mb-10">
              {top3[1] && <PodiumCard photo={top3[1]} rank={2} />}
              {top3[0] && <PodiumCard photo={top3[0]} rank={1} highlight />}
              {top3[2] && <PodiumCard photo={top3[2]} rank={3} />}
            </div>

            <div className="space-y-2 mb-14">
              {rest.map((photo, i) => (
                <RankRow
                  key={photo.id}
                  rank={i + 4}
                  photo={photo}
                  maxVotes={maxVotes}
                />
              ))}
            </div>
          </>
        ) : (
          <div
            className="rounded-2xl p-8 text-center mb-12"
            style={{
              background: COLORS.card,
              border: `1px dashed ${COLORS.line}`,
              color: COLORS.muted,
            }}
          >
            <div className="pd-serif-italic text-[18px] mb-1">
              No votes yet.
            </div>
            <div className="text-[13px]">
              Share the link with the team to get things started.
            </div>
          </div>
        )}

        {/* Participants list — everyone on the whitelist, admin excluded */}
        {(() => {
          const participants = [...ALLOWED_EMAILS]
            .filter((e) => e !== ADMIN_EMAIL)
            .sort((a, b) => a.localeCompare(b));
          const votedSet = new Set(voters);
          const votedCount = participants.filter((e) => votedSet.has(e)).length;

          return (
            <>
              <SectionHeader
                title={`Participants (${votedCount}/${participants.length} voted)`}
                icon={Users}
              />
              <div
                className="rounded-2xl overflow-hidden mb-14"
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.line}`,
                }}
              >
                {participants.map((v, i) => {
                  const hasVoted = votedSet.has(v);
                  const session = hasVoted
                    ? sessions.find(
                        (s) => s.email && s.email.toLowerCase() === v
                      )
                    : null;
                  const winnerPhotoId = session?.finalWinnerPhotoId;
                  const isConfirming  = confirmUserReset === v;
                  const isResetting   = resettingUser === v;
                  return (
                    <div
                      key={v}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                      style={{
                        borderTop: i === 0 ? "none" : `1px solid ${COLORS.line}`,
                        background: isConfirming ? "#FDF3EF" : "transparent",
                        transition: "background 160ms ease",
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className="pd-serif-italic flex-shrink-0"
                          style={{
                            color: COLORS.muted,
                            fontSize: 14,
                            width: 28,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {i + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-[13px] truncate"
                            style={{
                              color: hasVoted ? COLORS.ink : COLORS.muted,
                            }}
                          >
                            {v}
                          </div>
                          {hasVoted && winnerPhotoId && (
                            <div
                              className="text-[11px] mt-0.5"
                              style={{ color: COLORS.muted }}
                            >
                              pick · {winnerPhotoId}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status column: voted badge OR empty/pending marker */}
                      <div className="flex-shrink-0 flex items-center gap-2.5">
                        {hasVoted ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] tracking-[0.16em] uppercase"
                            style={{
                              background: "#E8F0E5",
                              color: "#2F5A3A",
                              border: "1px solid #C9DCC5",
                            }}
                          >
                            ✓ Voted
                          </span>
                        ) : (
                          <span
                            className="text-[10px] tracking-[0.22em] uppercase"
                            style={{ color: COLORS.muted }}
                          >
                            — Pending
                          </span>
                        )}

                        {/* Per-user reset — only for voters */}
                        {hasVoted && !isConfirming && (
                          <button
                            onClick={() => setConfirmUserReset(v)}
                            title="Reset this voter"
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] tracking-[0.08em] uppercase"
                            style={{
                              background: "transparent",
                              color: COLORS.muted,
                              border: `1px solid ${COLORS.line}`,
                              transition: "all 160ms ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = COLORS.accent;
                              e.currentTarget.style.borderColor = COLORS.accent;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = COLORS.muted;
                              e.currentTarget.style.borderColor = COLORS.line;
                            }}
                          >
                            <Trash2 size={12} /> Reset
                          </button>
                        )}
                        {hasVoted && isConfirming && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleResetUser(v)}
                              disabled={isResetting}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] tracking-[0.08em] uppercase font-medium"
                              style={{
                                background: COLORS.accent,
                                color: "#fffdf7",
                                opacity: isResetting ? 0.7 : 1,
                                cursor: isResetting ? "wait" : "pointer",
                              }}
                            >
                              {isResetting ? "…" : "Confirm"}
                            </button>
                            <button
                              onClick={() => setConfirmUserReset(null)}
                              disabled={isResetting}
                              className="rounded-lg px-2.5 py-1.5 text-[11px] tracking-[0.08em] uppercase"
                              style={{
                                background: "transparent",
                                color: COLORS.inkSoft,
                                border: `1px solid ${COLORS.line}`,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* Danger zone */}
        <SectionHeader title="Danger Zone" dangerous />
        <div
          className="rounded-2xl p-5"
          style={{
            background: "#FDF3EF",
            border: `1px solid #F2C9BB`,
          }}
        >
          <div
            className="pd-serif text-[18px] mb-1"
            style={{ color: COLORS.accentDeep, fontWeight: 500 }}
          >
            Reset all voting data
          </div>
          <div
            className="text-[13px] mb-4 leading-relaxed"
            style={{ color: COLORS.inkSoft }}
          >
            Clears every vote, every voter, and every session. Anyone can then
            vote again with the same email. This cannot be undone.
          </div>

          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="pd-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-medium"
              style={{
                background: COLORS.accent,
                color: "#fffdf7",
              }}
            >
              <Trash2 size={15} /> Reset everything
            </button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="pd-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-medium"
                style={{
                  background: COLORS.accentDeep,
                  color: "#fffdf7",
                  opacity: resetting ? 0.7 : 1,
                  cursor: resetting ? "wait" : "pointer",
                }}
              >
                <Trash2 size={15} />
                {resetting ? "Clearing…" : "Yes, delete everything"}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="rounded-xl px-5 py-2.5 text-[14px]"
                style={{
                  background: "transparent",
                  color: COLORS.inkSoft,
                  border: `1px solid ${COLORS.line}`,
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon: Icon, dangerous }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="h-px flex-1" style={{ background: COLORS.line }} />
      <span
        className="flex items-center gap-1.5 text-[10px] tracking-[0.28em] uppercase"
        style={{ color: dangerous ? COLORS.accent : COLORS.muted }}
      >
        {Icon && <Icon size={12} />} {title}
      </span>
      <span className="h-px flex-1" style={{ background: COLORS.line }} />
    </div>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div
      className="rounded-xl px-3 py-3 text-center"
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
      }}
    >
      <div
        className="pd-serif-italic text-[28px] leading-none"
        style={{
          color: COLORS.ink,
          fontWeight: 400,
          fontFeatureSettings: mono ? '"tnum"' : undefined,
        }}
      >
        {value}
      </div>
      <div
        className="mt-1.5 text-[10px] tracking-[0.22em] uppercase"
        style={{ color: COLORS.muted }}
      >
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
function SetupNeededScreen() {
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div
        className="pd-root pd-grain min-h-screen w-full flex items-center justify-center px-5 py-10"
        style={{ background: COLORS.cream, color: COLORS.ink }}
      >
        <div className="w-full max-w-[420px] text-center">
          <div
            className="text-[11px] tracking-[0.32em] uppercase mb-6"
            style={{ color: COLORS.accent }}
          >
            Setup Needed
          </div>
          <h1
            className="pd-serif leading-[0.95] mb-5"
            style={{
              color: COLORS.ink,
              fontSize: "clamp(32px, 7vw, 44px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            Drop your photos{" "}
            <span className="pd-serif-italic" style={{ color: COLORS.accent }}>
              in.
            </span>
          </h1>
          <p
            className="mb-6 leading-relaxed"
            style={{ color: COLORS.inkSoft, fontSize: 14 }}
          >
            Add at least two image files (jpg, png, webp, etc.) into{" "}
            <code
              className="rounded px-1.5 py-0.5"
              style={{
                background: COLORS.creamDeep,
                color: COLORS.accentDeep,
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
              }}
            >
              src/assets/photos/
            </code>{" "}
            and the app will pick them up automatically on the next hot-reload.
          </p>
          <div
            className="rounded-xl px-4 py-3 text-left text-[12px] leading-relaxed"
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              color: COLORS.inkSoft,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            src/
            <br />
            &nbsp;&nbsp;assets/
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;photos/
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;photo-1.jpg
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;photo-2.jpg
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;…
          </div>
          <div
            className="mt-6 text-[11px] tracking-[0.2em] uppercase"
            style={{ color: COLORS.muted }}
          >
            Currently detected: {TOTAL_PHOTOS} photo
            {TOTAL_PHOTOS === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </>
  );
}

function AppMain() {
  // 'entry' | 'adminPassword' | 'voting' | 'personalWinner' | 'alreadyVoted' | 'admin'
  const [screen, setScreen]           = useState("entry");
  const [email, setEmail]             = useState("");
  const [pendingAdminEmail, setPendingAdminEmail] = useState("");
  const [personalWinnerPhoto, setPersonalWinnerPhoto] = useState(null);
  const [commitStatus, setCommitStatus] = useState("idle"); // 'idle' | 'saving' | 'saved' | 'error'

  const photoById = (id) => PHOTOS.find((p) => p.id === id) || null;

  const handleStart = (value) => {
    setEmail(value);
    setScreen("voting");
    // NOTE: we no longer record the email as voted here. If the user closes
    // the tab or refreshes mid-voting, they'll be allowed to start over on
    // the next login. The email is only marked "voted" once the session
    // completes (see handleDone).
  };

  const handleAlreadyVoted = () => {
    setScreen("alreadyVoted");
  };

  const handleAlreadyVotedBack = () => {
    setScreen("entry");
  };

  const handleAdminEmailEntered = (value) => {
    setPendingAdminEmail(value);
    setScreen("adminPassword");
  };

  const handleAdminVerified = () => {
    setEmail(pendingAdminEmail);
    setScreen("admin");
  };

  const handleAdminBack = () => {
    setPendingAdminEmail("");
    setScreen("entry");
  };

  const handleAdminLogout = () => {
    setEmail("");
    setPendingAdminEmail("");
    setScreen("entry");
  };

  const handleDone = async (res) => {
    // Optimistic UI: show the winner screen instantly so the user isn't
    // staring at a frozen voting screen while the network write completes.
    const photo = photoById(res.finalWinnerPhotoId) || PHOTOS[0] || null;
    setPersonalWinnerPhoto(photo);
    setCommitStatus("saving");
    setScreen("personalWinner");

    commitCompletedSession({
      email: res.email,
      finalWinnerPhotoId: res.finalWinnerPhotoId,
      startedAt: res.startedAt,
      completedAt: res.completedAt,
      history: res.history,
    })
      .then(() => setCommitStatus("saved"))
      .catch((err) => {
        console.error("commitCompletedSession failed:", err);
        setCommitStatus("error");
      });
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div
        className="pd-root pd-grain min-h-screen w-full"
        style={{
          background: COLORS.cream,
          color: COLORS.ink,
        }}
      >
        {screen === "entry" && (
          <EntryScreen
            onStart={handleStart}
            onAlreadyVoted={handleAlreadyVoted}
            onAdminEmailEntered={handleAdminEmailEntered}
          />
        )}
        {screen === "adminPassword" && (
          <PasswordScreen
            email={pendingAdminEmail}
            onVerify={handleAdminVerified}
            onBack={handleAdminBack}
          />
        )}
        {screen === "voting" && (
          <VotingScreen
            key={email}
            email={email}
            onDone={handleDone}
          />
        )}
        {screen === "personalWinner" && personalWinnerPhoto && (
          <PersonalWinnerScreen
            winnerPhoto={personalWinnerPhoto}
            commitStatus={commitStatus}
          />
        )}
        {screen === "alreadyVoted" && (
          <AlreadyVotedScreen onBack={handleAlreadyVotedBack} />
        )}
        {screen === "admin" && <AdminScreen onLogout={handleAdminLogout} />}
      </div>
    </>
  );
}

// Thin wrapper: bail out to setup screen if the photos folder is empty.
// This keeps AppMain's hooks unconditional and ESLint-friendly.
export default function App() {
  if (TOTAL_PHOTOS < 2) return <SetupNeededScreen />;
  return <AppMain />;
}