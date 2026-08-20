import React, { useState, useMemo, useRef } from "react";
import {
  Sprout, Leaf, CloudRain, MessageCircle, Camera, Image as ImageIcon,
  Home, User, ChevronRight, ArrowLeft, MapPin, Calendar, Phone,
  Settings, HelpCircle, LogOut, CheckCircle2, AlertTriangle, Sparkles,
  Ruler, Bug, Send, ScanLine, Pencil
} from "lucide-react";

/* ----------------------------------------------------------------
   CROP STAGE MODEL — simplified MVP classification for maize.
   Easy to extend later per-crop; swap this function when multi-crop
   support is added.
------------------------------------------------------------------- */
const MAIZE_STAGES = [
  { key: "germination", label: "Germination", min: 0, max: 7 },
  { key: "early_veg", label: "Early vegetative", min: 8, max: 21 },
  { key: "vegetative", label: "Vegetative", min: 22, max: 45 },
  { key: "tasseling", label: "Tasseling / flowering", min: 46, max: 65 },
  { key: "grain_filling", label: "Grain filling", min: 66, max: 90 },
  { key: "maturity", label: "Maturity / harvest", min: 91, max: Infinity },
];

function getStage(days) {
  return MAIZE_STAGES.find((s) => days >= s.min && days <= s.max) || MAIZE_STAGES[0];
}

function daysSince(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/* ----------------------------------------------------------------
   MOCKED RECOMMENDATION + AI LOGIC
   Structured so a real weather/AI API can be dropped in later
   without changing the screens that call these functions.
------------------------------------------------------------------- */
const STAGE_RECOMMENDATION = {
  germination: "Keep soil consistently moist. Avoid heavy fertilizer application until seedlings emerge.",
  early_veg: "Check emergence rate across the field and gap-fill any bare patches within the next week.",
  vegetative: "Inspect your maize leaves for early signs of pest damage before the expected rainfall.",
  tasseling: "Water stress now can reduce yield significantly — prioritize irrigation if rainfall is light this week.",
  grain_filling: "Monitor for stalk borer and ensure the crop isn't competing with weeds for nutrients.",
  maturity: "Begin planning harvest logistics and check grain moisture before drying and storage.",
};

function buildAIResponse(question, ctx) {
  const q = question.trim().toLowerCase();
  const stageLabel = ctx.stage.label.toLowerCase();

  if (q.length > 0 && q.length < 6) {
    return {
      insufficient: true,
      text: `I'd like to help, but I need a bit more detail. Could you describe what you're seeing on your ${ctx.crop.toLowerCase()} — for example, which part of the plant is affected and when you first noticed it?`,
    };
  }

  const isPest = /insect|pest|worm|bug|armyworm|caterpillar/.test(q);
  const isYellow = /yellow|discolor|pale/.test(q);
  const isGrowth = /not grow|isn.?t growing|stunt|slow|small/.test(q);
  const isFertilizer = /fertiliz|nutrient|feed/.test(q);

  if (isPest) {
    return {
      insufficient: false,
      whatMayBeHappening: `Visible insects on maize at the ${stageLabel} stage are often fall armyworm or stem borer, especially common in ${ctx.location.split(",")[0]} around this time of year.`,
      whatToCheck: [
        "Look for ragged holes or window-pane patches on younger leaves",
        "Check the whorl (center) of the plant for sawdust-like droppings (frass)",
        "Note how many plants out of 20 are affected, not just one",
      ],
      whatToDo: [
        "Isolate and inspect affected plants first thing in the morning, when pests are most active",
        "If more than 1 in 10 plants show damage, consider a locally approved control method",
        "Avoid broad spraying until the pest is confirmed — use the Scan Your Crop tool for a closer AI read",
      ],
      recommendation: "Use the crop scan tool on a damaged leaf now — pest identification from a photo is far more reliable than a description alone.",
      note: "This is a general guide, not a lab diagnosis. If damage is spreading fast, consult a local agricultural extension officer.",
    };
  }

  if (isYellow) {
    return {
      insufficient: false,
      whatMayBeHappening: `Yellowing on maize at the ${stageLabel} stage is commonly linked to nitrogen deficiency, waterlogging, or early nutrient stress — but a few different issues can look similar.`,
      whatToCheck: [
        "Is the yellowing on older (lower) leaves or new (upper) leaves?",
        "Has the field had unusually heavy rain or standing water recently?",
        "Is the yellowing in patches across the field, or on isolated plants?",
      ],
      whatToDo: [
        "If lower leaves are yellowing in a uniform pattern, this often points to nitrogen deficiency — a split fertilizer application can help",
        "If it's patchy after heavy rain, check drainage before adding more fertilizer",
        "Take a clear photo of an affected leaf for a more specific read",
      ],
      recommendation: `Given your farm is on ${ctx.size} at the ${stageLabel} stage, a light nitrogen top-dressing is usually reasonable — but confirm the pattern above first.`,
      note: "Nutrient issues and early disease can look alike from a description. Scan a leaf photo if the yellowing continues to spread.",
    };
  }

  if (isFertilizer) {
    return {
      insufficient: false,
      whatMayBeHappening: `Fertilizer timing depends on your maize's current stage — you're at ${stageLabel}, which is a meaningful point in the nutrient cycle.`,
      whatToCheck: [
        "Has any fertilizer been applied since planting?",
        "What was used at planting — organic manure, NPK, or none?",
        "Is the soil currently moist enough to absorb applied nutrients?",
      ],
      whatToDo: [
        "At vegetative to tasseling stages, nitrogen top-dressing typically gives the strongest response",
        "Split your fertilizer into two applications rather than one large dose, to reduce waste and leaching",
        "Apply shortly before light rain where possible, not during heavy downpours",
      ],
      recommendation: `For a ${ctx.size} farm at the ${stageLabel} stage, a nitrogen-focused top-dressing timed with the coming rain is the most useful next step.`,
      note: "Exact rates vary by soil type — a local soil test will sharpen this recommendation over time.",
    };
  }

  if (isGrowth) {
    return {
      insufficient: false,
      whatMayBeHappening: `Slow growth at the ${stageLabel} stage is usually tied to soil nutrients, spacing, water availability, or early pest pressure — rarely just one cause.`,
      whatToCheck: [
        "Compare plant height across different parts of the field — uniform or patchy?",
        "Check spacing: overcrowded plants compete for light and nutrients",
        "Look at leaf color — pale green can signal a nutrient issue alongside slow growth",
      ],
      whatToDo: [
        "If growth is patchy, look for a shared cause in that area — waterlogging, poor soil, or shade",
        "If it's field-wide, review your fertilizer plan against the current growth stage",
        "Rule out pests by inspecting the base of a few slow plants",
      ],
      recommendation: "Compare 5 slow plants against 5 healthy ones side by side — the difference usually points straight to the cause.",
      note: "This is a starting checklist, not a diagnosis. Persistent field-wide stunting is worth a visit from a local extension officer.",
    };
  }

  return {
    insufficient: false,
    whatMayBeHappening: `Based on your maize being at the ${stageLabel} stage on a ${ctx.size} farm in ${ctx.location}, here's a general read on your question.`,
    whatToCheck: [
      "Which part of the plant or field is involved",
      "When you first noticed the issue",
      "Whether it's spreading, staying the same, or improving",
    ],
    whatToDo: [
      "Monitor the affected area daily for the next few days",
      "Compare against unaffected plants nearby to isolate the cause",
      "Use the crop scan tool if the issue is visible on a leaf, stem, or fruit",
    ],
    recommendation: STAGE_RECOMMENDATION[ctx.stage.key],
    note: "For a more specific answer, try one of the quick questions or add more detail — YIELD gets more precise with more context.",
  };
}

/* ----------------------------------------------------------------
   REAL AI INTEGRATION LAYER (frontend side)

   This is the seam that replaces mocked reasoning with a real
   Claude-powered backend. The browser NEVER holds an Anthropic API
   key and NEVER calls the Anthropic API directly — it only talks to
   our own server route, /api/yield-ai, which is responsible for
   calling Claude securely and returning a response in the same
   structured shape the AI screen already renders.

   See /mnt/user-data/outputs/server/yield-ai-server-reference.js for
   the reference backend implementation (system prompt included) —
   that file is documentation/reference only and is not executed by
   this prototype.
------------------------------------------------------------------- */

// Builds the farmContext payload sent to the backend on every question.
// Kept as a single function so the shape only has to change in one place.
function buildFarmContext(farmer, farm) {
  const days = daysSince(farm.plantingDate);
  const stage = getStage(days);
  return {
    farmerName: farmer.name,
    location: farm.location,
    farmSize: farm.size,
    crop: "Maize",
    plantingDate: farm.plantingDate,
    cropAgeDays: days,
    growthStage: stage.label,
    growthStageKey: stage.key,
  };
}

// askYieldAI(question, farmContext)
// POSTs to /api/yield-ai and resolves to { source: "live" | "mock", res, backendError? }
// `res` always matches the structured shape the existing AI screen renders:
// { insufficient, whatMayBeHappening, whatToCheck[], whatToDo[], recommendation, note }
// or { insufficient: true, text } when more information is needed.
//
// If the backend route doesn't exist yet, is unreachable, or returns something
// malformed, this transparently falls back to the local mock logic (buildAIResponse)
// so the AI screen stays fully testable without a server. Remove the catch block's
// fallback once the real backend is live and this should always throw/surface errors
// instead of silently mocking.
function toMockCtx(farmContext) {
  return {
    crop: farmContext.crop,
    location: farmContext.location,
    size: farmContext.farmSize,
    stage: { key: farmContext.growthStageKey, label: farmContext.growthStage },
  };
}

// Live YIELD AI backend (deployed on Render). The Anthropic API key lives
// only on that server — never here.
const YIELD_AI_ENDPOINT = "https://yield-ai-backend.onrender.com/api/yield-ai";

async function askYieldAI(question, farmContext) {
  let response;

  try {
    response = await fetch(YIELD_AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, farmContext }),
    });
  } catch (networkErr) {
    // The route isn't deployed / reachable yet — expected while there's no
    // backend running. Fall back to mock reasoning so the AI screen stays
    // testable during this phase, rather than surfacing a hard error.
    return { source: "mock", res: buildAIResponse(question, toMockCtx(farmContext)), backendError: networkErr.message };
  }

  if (response.status === 404) {
    // Same "not deployed yet" case, just surfaced as a 404 instead of a
    // network exception (e.g. static hosting with no /api routes at all).
    return { source: "mock", res: buildAIResponse(question, toMockCtx(farmContext)), backendError: "No /api/yield-ai route found (404)" };
  }

  if (!response.ok) {
    // The backend exists and was reached, but it failed — this is a real
    // error worth surfacing to the farmer (with a retry) rather than
    // silently mocking, since a live backend should be reliable.
    throw new Error(`YIELD backend returned an error (status ${response.status})`);
  }

  const data = await response.json();
  const looksValid =
    data && (data.insufficient === true || (typeof data.whatMayBeHappening === "string" && Array.isArray(data.whatToCheck)));

  if (!looksValid) {
    throw new Error("Backend returned an unexpected response shape");
  }

  return { source: "live", res: data };
}

/* ---------------------------------------------------------------- */

const GREEN = {
  darkest: "#0F2E1F",
  dark: "#154D32",
  mid: "#1E6B45",
  bright: "#3E9469",
};

function Logo({ size = "md" }) {
  const dims = size === "lg" ? "w-16 h-16" : "w-9 h-9";
  const text = size === "lg" ? "text-4xl" : "text-xl";
  return (
    <div className="flex items-center gap-2">
      <div className={`${dims} rounded-2xl flex items-center justify-center`} style={{ backgroundColor: GREEN.dark }}>
        <Sprout className={size === "lg" ? "w-9 h-9 text-white" : "w-5 h-5 text-white"} strokeWidth={2.2} />
      </div>
      <span className={`${text} font-extrabold tracking-tight`} style={{ color: GREEN.darkest }}>YIELD</span>
    </div>
  );
}

/* ---------------- Signature element: growth stage tracker ---------------- */
function GrowthTracker({ currentKey, compact = false }) {
  const idx = MAIZE_STAGES.findIndex((s) => s.key === currentKey);
  return (
    <div className="w-full">
      <div className="flex items-center">
        {MAIZE_STAGES.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center" style={{ width: compact ? 22 : 28 }}>
              <div
                className={`rounded-full flex items-center justify-center border-2 ${compact ? "w-5 h-5" : "w-7 h-7"}`}
                style={{
                  backgroundColor: i <= idx ? GREEN.mid : "#fff",
                  borderColor: i <= idx ? GREEN.mid : "#D6D3C7",
                }}
              >
                {i <= idx ? <Leaf className={compact ? "w-2.5 h-2.5 text-white" : "w-3.5 h-3.5 text-white"} /> : null}
              </div>
            </div>
            {i < MAIZE_STAGES.length - 1 && (
              <div className="flex-1 h-0.5 -mx-1" style={{ backgroundColor: i < idx ? GREEN.mid : "#E4E1D6" }} />
            )}
          </React.Fragment>
        ))}
      </div>
      {!compact && (
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-stone-400 w-14">Germination</span>
          <span className="text-[10px] text-stone-400 w-14 text-right">Maturity</span>
        </div>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick, icon: Icon, type = "button", full = true, disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${full ? "w-full" : ""} flex items-center justify-center gap-2 rounded-2xl py-4 font-semibold text-white text-base shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50`}
      style={{ backgroundColor: GREEN.dark }}
    >
      {Icon && <Icon className="w-5 h-5" />}
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, icon: Icon, full = true }) {
  return (
    <button
      onClick={onClick}
      className={`${full ? "w-full" : ""} flex items-center justify-center gap-2 rounded-2xl py-4 font-semibold text-base border-2 active:scale-[0.98] transition-transform`}
      style={{ borderColor: GREEN.dark, color: GREEN.dark, backgroundColor: "white" }}
    >
      {Icon && <Icon className="w-5 h-5" />}
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold text-stone-600 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-stone-300 px-4 py-3 text-base text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:border-transparent";

/* =========================== SCREENS =========================== */

function WelcomeScreen({ onGetStarted, onHaveAccount }) {
  return (
    <div className="flex flex-col h-full px-6" style={{ background: `linear-gradient(180deg, #F6F4ED 0%, #EAF0E6 100%)` }}>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-lg" style={{ backgroundColor: GREEN.dark }}>
          <Sprout className="w-14 h-14 text-white" strokeWidth={2} />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight mb-3" style={{ color: GREEN.darkest }}>YIELD</h1>
        <p className="text-xl font-semibold text-stone-700 leading-snug">
          Grow Smarter.<br />Harvest Better.
        </p>
        <p className="text-stone-500 mt-4 text-base max-w-xs">
          AI-powered intelligence for your farm.
        </p>
      </div>
      <div className="pb-10 pt-4 space-y-3">
        <PrimaryButton onClick={onGetStarted} icon={ChevronRight}>Get Started</PrimaryButton>
        <button onClick={onHaveAccount} className="w-full text-center py-2 font-semibold" style={{ color: GREEN.dark }}>
          I already have an account
        </button>
      </div>
    </div>
  );
}

function OnboardingScreen({ initial, onSubmit, onBack, editing }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    const req = ["name", "phone", "location", "size", "plantingDate"];
    const errs = {};
    req.forEach((k) => { if (!form[k] || !String(form[k]).trim()) errs[k] = true; });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit(form);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 pt-6 pb-4 flex items-center gap-3">
        {editing && (
          <button onClick={onBack} className="p-1 -ml-1"><ArrowLeft className="w-5 h-5 text-stone-600" /></button>
        )}
        <div>
          <h1 className="text-2xl font-extrabold text-stone-800">{editing ? "Edit your farm" : "Let's set up your farm"}</h1>
          <p className="text-stone-500 text-sm mt-1">Tell YIELD a little about your farm so we can personalize your recommendations.</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <Field label="Full Name">
          <input className={inputClass} style={{ borderColor: errors.name ? "#DC2626" : undefined }}
            placeholder="e.g. John Farmer" value={form.name} onChange={(e) => update("name", e.target.value)} />
        </Field>
        <Field label="Phone Number">
          <input className={inputClass} style={{ borderColor: errors.phone ? "#DC2626" : undefined }}
            placeholder="e.g. 080 1234 5678" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </Field>
        <Field label="Farm Location">
          <input className={inputClass} style={{ borderColor: errors.location ? "#DC2626" : undefined }}
            placeholder="e.g. Ilorin, Kwara State" value={form.location} onChange={(e) => update("location", e.target.value)} />
        </Field>
        <Field label="Farm Size">
          <input className={inputClass} style={{ borderColor: errors.size ? "#DC2626" : undefined }}
            placeholder="e.g. 2 hectares" value={form.size} onChange={(e) => update("size", e.target.value)} />
        </Field>
        <Field label="Crop">
          <div className="flex items-center justify-between rounded-xl border border-stone-300 px-4 py-3 bg-stone-50">
            <span className="text-base text-stone-800">🌽 Maize</span>
            <span className="text-xs text-stone-400 font-medium">More crops coming soon</span>
          </div>
        </Field>
        <Field label="Planting Date">
          <input type="date" className={inputClass} style={{ borderColor: errors.plantingDate ? "#DC2626" : undefined }}
            value={form.plantingDate} onChange={(e) => update("plantingDate", e.target.value)} />
        </Field>
      </div>
      <div className="px-6 pb-8 pt-2 border-t border-stone-100">
        <PrimaryButton onClick={handleSubmit} icon={ChevronRight}>{editing ? "Save Changes" : "Continue"}</PrimaryButton>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex-1 bg-white rounded-2xl p-3.5 border border-stone-100">
      <Icon className="w-4 h-4 mb-2" style={{ color: GREEN.mid }} />
      <p className="text-[11px] text-stone-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-stone-800 mt-0.5 leading-tight">{value}</p>
    </div>
  );
}

function DashboardScreen({ farmer, farm, onAskAI, onScan, onOpenFarm }) {
  const days = daysSince(farm.plantingDate);
  const stage = getStage(days);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const rec = STAGE_RECOMMENDATION[stage.key];

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4 bg-stone-50">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-stone-500 text-sm">{greeting},</p>
          <h1 className="text-2xl font-extrabold text-stone-800">{farmer.name.split(" ")[0]} 👋</h1>
        </div>
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: GREEN.dark }}>
          {farmer.name.charAt(0)}
        </div>
      </div>

      <button onClick={onOpenFarm} className="w-full text-left rounded-3xl p-5 mb-4 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${GREEN.dark}, ${GREEN.darkest})` }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-lg font-bold">🌽 {farm.farmName}</p>
          <ChevronRight className="w-4 h-4 opacity-70" />
        </div>
        <div className="flex items-center gap-1 text-white/70 text-xs mb-4">
          <MapPin className="w-3 h-3" /> {farm.location}
        </div>
        <GrowthTracker currentKey={stage.key} />
        <p className="text-xs text-white/70 mt-2">{stage.label} · Day {days} of growth</p>
      </button>

      <div className="flex gap-3 mb-4">
        <StatCard icon={Ruler} label="Farm size" value={farm.size} />
        <StatCard icon={Leaf} label="Crop stage" value={stage.label} />
      </div>

      <div className="bg-white rounded-2xl p-4 mb-4 border border-stone-100">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-4 h-4" style={{ color: GREEN.mid }} />
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Farm status</p>
        </div>
        <p className="font-bold text-stone-800">Good</p>
        <p className="text-sm text-stone-500">No critical issues reported.</p>
      </div>

      <div className="rounded-2xl p-4 mb-4 border border-amber-200 bg-amber-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">Weather</p>
            <p className="text-2xl font-extrabold text-stone-800">🌦️ 28°C</p>
            <p className="text-sm text-stone-600 mt-0.5">Rain expected tomorrow.</p>
          </div>
        </div>
        <p className="text-[11px] text-amber-700/70 mt-2">Placeholder data — live weather coming soon.</p>
      </div>

      <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: "#EAF3EC" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-4 h-4" style={{ color: GREEN.dark }} />
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GREEN.dark }}>YIELD recommends</p>
        </div>
        <p className="text-sm text-stone-700 leading-relaxed">{rec}</p>
      </div>

      <div className="space-y-3">
        <PrimaryButton onClick={onAskAI} icon={MessageCircle}>Ask YIELD AI</PrimaryButton>
        <SecondaryButton onClick={onScan} icon={ScanLine}>Scan Your Crop</SecondaryButton>
      </div>
    </div>
  );
}

function StructuredAnswer({ res }) {
  if (res.insufficient) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-stone-200">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Need more detail</p>
        </div>
        <p className="text-sm text-stone-700 leading-relaxed">{res.text}</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1">What may be happening</p>
        <p className="text-sm text-stone-700 leading-relaxed">{res.whatMayBeHappening}</p>
      </div>
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1.5">What to check</p>
        <ul className="space-y-1.5">
          {res.whatToCheck.map((c, i) => (
            <li key={i} className="text-sm text-stone-700 flex gap-2"><span className="text-stone-300">•</span>{c}</li>
          ))}
        </ul>
      </div>
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1.5">What to do now</p>
        <ul className="space-y-1.5">
          {res.whatToDo.map((c, i) => (
            <li key={i} className="text-sm text-stone-700 flex gap-2"><span className="text-stone-300">•</span>{c}</li>
          ))}
        </ul>
      </div>
      <div className="p-4" style={{ backgroundColor: "#EAF3EC" }}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-3.5 h-3.5" style={{ color: GREEN.dark }} />
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GREEN.dark }}>YIELD recommendation</p>
        </div>
        <p className="text-sm text-stone-800 leading-relaxed font-medium">{res.recommendation}</p>
      </div>
      {res.note && (
        <div className="p-3.5 bg-stone-50">
          <p className="text-[11px] text-stone-400 leading-relaxed">{res.note}</p>
        </div>
      )}
    </div>
  );
}

function AIScreen({ farm, farmer, onScan }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // { question, message } | null

  const quickQuestions = [
    "My maize isn't growing well",
    "I see insects on my crop",
    "When should I apply fertilizer?",
    "Why are my leaves turning yellow?",
  ];

  const ask = async (q) => {
    const question = q.trim();
    if (!question || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const farmContext = buildFarmContext(farmer, farm);
      const { res, source } = await askYieldAI(question, farmContext);
      setMessages((m) => [...m, { question, res, source }]);
    } catch (err) {
      setError({ question, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    if (error) ask(error.question);
  };

  return (
    <div className="flex-1 flex flex-col bg-stone-50 overflow-hidden">
      <div className="px-5 pt-6 pb-3 bg-white border-b border-stone-100">
        <h1 className="text-xl font-extrabold text-stone-800">YIELD AI</h1>
        <p className="text-sm text-stone-500">Your intelligent farming assistant.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: "#EAF3EC" }}>
              <Sparkles className="w-7 h-7" style={{ color: GREEN.dark }} />
            </div>
            <p className="text-sm text-stone-400 max-w-[220px] mx-auto">Ask a question about your maize, or tap a suggestion below to get started.</p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i}>
              <div className="flex justify-end mb-2">
                <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] text-white text-sm font-medium" style={{ backgroundColor: GREEN.dark }}>
                  {m.question}
                </div>
              </div>
              <StructuredAnswer res={m.res} />
              {m.source === "mock" && (
                <p className="text-[10px] text-stone-300 mt-1.5 ml-1">Offline demo logic — live AI backend not connected yet.</p>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 px-1">
              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${GREEN.mid} transparent ${GREEN.mid} ${GREEN.mid}` }} />
              <p className="text-sm text-stone-400 font-medium">YIELD is thinking...</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <p className="text-sm font-semibold text-red-600">YIELD couldn't reach the AI right now. Please try again.</p>
              </div>
              <button onClick={retry} className="mt-2 text-sm font-semibold" style={{ color: GREEN.dark }}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-2 pt-2 bg-white border-t border-stone-100">
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {quickQuestions.map((q) => (
            <button key={q} onClick={() => ask(q)} disabled={loading}
              className="flex-shrink-0 rounded-full border border-stone-200 px-3.5 py-2 text-xs font-medium text-stone-600 bg-stone-50 active:bg-stone-100 whitespace-nowrap disabled:opacity-40">
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pb-2">
          <input
            className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 disabled:bg-stone-50"
            style={{ "--tw-ring-color": GREEN.mid }}
            placeholder="Ask anything about your farm..."
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
          />
          <button onClick={() => ask(input)} disabled={loading} className="rounded-xl px-4 flex items-center justify-center disabled:opacity-50" style={{ backgroundColor: GREEN.dark }}>
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <button onClick={onScan} className="flex items-center justify-center gap-1.5 w-full py-1 text-xs font-semibold" style={{ color: GREEN.dark }}>
          <Camera className="w-3.5 h-3.5" /> Scan Your Crop instead
        </button>
      </div>
    </div>
  );
}

function DiagnosisScreen({ onBack, onAskAI }) {
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | analyzing | done
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    setStatus("analyzing");
    setTimeout(() => setStatus("done"), 1800);
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3 border-b border-stone-100">
        <button onClick={onBack} className="p-1 -ml-1"><ArrowLeft className="w-5 h-5 text-stone-600" /></button>
        <div>
          <h1 className="text-xl font-extrabold text-stone-800">Scan Your Crop</h1>
          <p className="text-sm text-stone-500">Take a clear photo of an affected leaf, fruit, stem or plant.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!image && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-full aspect-square rounded-3xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center bg-stone-50">
              <ScanLine className="w-10 h-10 text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">No photo yet</p>
            </div>
            <div className="w-full space-y-3">
              <PrimaryButton icon={Camera} onClick={() => fileRef.current?.click()}>Take Photo</PrimaryButton>
              <SecondaryButton icon={ImageIcon} onClick={() => fileRef.current?.click()}>Upload Photo</SecondaryButton>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            </div>
          </div>
        )}

        {image && (
          <div>
            <img src={image} alt="Crop" className="w-full aspect-square object-cover rounded-3xl mb-4 border border-stone-200" />
            {status === "analyzing" && (
              <div className="flex flex-col items-center py-8">
                <div className="w-8 h-8 border-2 rounded-full animate-spin mb-3" style={{ borderColor: `${GREEN.mid} transparent ${GREEN.mid} ${GREEN.mid}` }} />
                <p className="text-sm text-stone-500 font-medium">Analyzing your crop...</p>
              </div>
            )}
            {status === "done" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-stone-200 overflow-hidden">
                  <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">Possible issue</p>
                      <p className="text-lg font-extrabold text-stone-800 flex items-center gap-2"><Bug className="w-5 h-5 text-amber-600" /> Fall Armyworm</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-stone-400 font-medium">Confidence</p>
                      <p className="text-xl font-extrabold text-stone-800">87%</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1.5">Why YIELD thinks so</p>
                    <ul className="space-y-1.5 text-sm text-stone-700">
                      <li className="flex gap-2"><span className="text-stone-300">•</span>Leaf feeding damage detected</li>
                      <li className="flex gap-2"><span className="text-stone-300">•</span>Damage pattern is consistent with pest activity</li>
                      <li className="flex gap-2"><span className="text-stone-300">•</span>Maize is currently at a susceptible growth stage</li>
                    </ul>
                  </div>
                  <div className="p-4" style={{ backgroundColor: "#EAF3EC" }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: GREEN.dark }}>Recommended action</p>
                    <p className="text-sm text-stone-800 font-medium">Inspect surrounding plants and follow an appropriate locally approved control method.</p>
                  </div>
                </div>
                <p className="text-[11px] text-stone-400 text-center leading-relaxed px-2">AI assessment — not a substitute for professional agricultural advice.</p>
                <PrimaryButton icon={MessageCircle} onClick={onAskAI}>Ask YIELD AI</PrimaryButton>
                <button onClick={() => { setImage(null); setStatus("idle"); }} className="w-full text-center py-1 text-sm font-semibold text-stone-400">
                  Scan another photo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FarmScreen({ farm, onEdit }) {
  const days = daysSince(farm.plantingDate);
  const stage = getStage(days);
  const rows = [
    { icon: Sprout, label: "Farm name", value: farm.farmName },
    { icon: MapPin, label: "Location", value: farm.location },
    { icon: Ruler, label: "Farm size", value: farm.size },
    { icon: Leaf, label: "Crop", value: "🌽 Maize" },
    { icon: Calendar, label: "Planting date", value: new Date(farm.plantingDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
    { icon: Calendar, label: "Crop age", value: `${days} days` },
  ];
  return (
    <div className="flex-1 overflow-y-auto bg-stone-50 px-5 pt-6 pb-4">
      <h1 className="text-2xl font-extrabold text-stone-800 mb-4">Your Farm</h1>
      <div className="bg-white rounded-2xl p-5 mb-4 border border-stone-100">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-3">Current crop stage</p>
        <GrowthTracker currentKey={stage.key} />
        <p className="text-sm font-semibold text-stone-700 mt-3">{stage.label}</p>
        <p className="text-[11px] text-stone-400 mt-1">Simplified MVP model based on days since planting.</p>
      </div>
      <div className="bg-white rounded-2xl border border-stone-100 divide-y divide-stone-100 mb-5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3.5">
            <r.icon className="w-4 h-4 text-stone-400" />
            <span className="text-sm text-stone-500 flex-1">{r.label}</span>
            <span className="text-sm font-semibold text-stone-800">{r.value}</span>
          </div>
        ))}
      </div>
      <SecondaryButton icon={Pencil} onClick={onEdit}>Edit Farm</SecondaryButton>
    </div>
  );
}

function ProfileScreen({ farmer, onEdit, onOpenFarm, onLogout }) {
  const items = [
    { icon: Pencil, label: "Edit Profile", action: onEdit },
    { icon: Settings, label: "Farm Settings", action: onOpenFarm },
    { icon: HelpCircle, label: "Help", action: () => {} },
  ];
  return (
    <div className="flex-1 overflow-y-auto bg-stone-50 px-5 pt-6 pb-4">
      <h1 className="text-2xl font-extrabold text-stone-800 mb-4">Profile</h1>
      <div className="bg-white rounded-2xl p-5 mb-5 border border-stone-100 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: GREEN.dark }}>
          {farmer.name.charAt(0)}
        </div>
        <div>
          <p className="font-bold text-stone-800">{farmer.name}</p>
          <p className="text-sm text-stone-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {farmer.phone}</p>
          <p className="text-sm text-stone-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {farmer.location}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-stone-100 divide-y divide-stone-100 mb-5">
        {items.map((it) => (
          <button key={it.label} onClick={it.action} className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-stone-50">
            <it.icon className="w-4 h-4 text-stone-400" />
            <span className="text-sm font-semibold text-stone-700 flex-1">{it.label}</span>
            <ChevronRight className="w-4 h-4 text-stone-300" />
          </button>
        ))}
      </div>
      <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-red-500 rounded-2xl border border-red-100 bg-red-50">
        <LogOut className="w-4 h-4" /> Log Out
      </button>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { key: "home", label: "Home", icon: Home },
    { key: "farm", label: "Farm", icon: Leaf },
    { key: "ai", label: "AI", icon: MessageCircle },
    { key: "profile", label: "Profile", icon: User },
  ];
  return (
    <div className="flex items-stretch border-t border-stone-100 bg-white">
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <button key={it.key} onClick={() => setTab(it.key)} className="flex-1 flex flex-col items-center gap-1 py-2.5">
            <it.icon className="w-5 h-5" style={{ color: active ? GREEN.dark : "#B8B4A6" }} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[10px] font-semibold" style={{ color: active ? GREEN.dark : "#B8B4A6" }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================== APP SHELL =========================== */

const DEMO_FARMER = { name: "John Farmer", phone: "080 1234 5678", location: "Ilorin, Kwara State, Nigeria" };
const DEMO_FARM = { farmName: "John's Maize Farm", location: "Ilorin, Kwara State, Nigeria", size: "2 hectares", plantingDate: isoDaysAgo(32) };

export default function App() {
  const [route, setRoute] = useState("welcome"); // welcome | onboarding | app
  const [tab, setTab] = useState("home");
  const [screenOverlay, setScreenOverlay] = useState(null); // "diagnosis" | "editFarm" | "editProfile" | null
  const [farmer, setFarmer] = useState(DEMO_FARMER);
  const [farm, setFarm] = useState(DEMO_FARM);

  const goApp = () => { setRoute("app"); setTab("home"); };

  const handleOnboardingSubmit = (form) => {
    setFarmer({ name: form.name, phone: form.phone, location: form.location });
    setFarm({ farmName: `${form.name.split(" ")[0]}'s Maize Farm`, location: form.location, size: form.size, plantingDate: form.plantingDate });
    goApp();
  };

  const handleEditFarmSubmit = (form) => {
    setFarmer((f) => ({ ...f, name: form.name, phone: form.phone, location: form.location }));
    setFarm({ farmName: farm.farmName, location: form.location, size: form.size, plantingDate: form.plantingDate });
    setScreenOverlay(null);
  };

  let body;
  if (route === "welcome") {
    body = <WelcomeScreen onGetStarted={() => setRoute("onboarding")} onHaveAccount={goApp} />;
  } else if (route === "onboarding") {
    body = (
      <OnboardingScreen
        initial={{ name: "", phone: "", location: "", size: "", plantingDate: isoDaysAgo(0) }}
        onSubmit={handleOnboardingSubmit}
        onBack={() => setRoute("welcome")}
        editing={false}
      />
    );
  } else if (screenOverlay === "diagnosis") {
    body = <DiagnosisScreen onBack={() => setScreenOverlay(null)} onAskAI={() => { setScreenOverlay(null); setTab("ai"); }} />;
  } else if (screenOverlay === "editFarm") {
    body = (
      <OnboardingScreen
        initial={{ name: farmer.name, phone: farmer.phone, location: farm.location, size: farm.size, plantingDate: farm.plantingDate }}
        onSubmit={handleEditFarmSubmit}
        onBack={() => setScreenOverlay(null)}
        editing={true}
      />
    );
  } else {
    if (tab === "home") body = <DashboardScreen farmer={farmer} farm={farm} onAskAI={() => setTab("ai")} onScan={() => setScreenOverlay("diagnosis")} onOpenFarm={() => setTab("farm")} />;
    else if (tab === "farm") body = <FarmScreen farm={farm} onEdit={() => setScreenOverlay("editFarm")} />;
    else if (tab === "ai") body = <AIScreen farm={farm} farmer={farmer} onScan={() => setScreenOverlay("diagnosis")} />;
    else body = <ProfileScreen farmer={farmer} onEdit={() => setScreenOverlay("editFarm")} onOpenFarm={() => setTab("farm")} onLogout={() => { setRoute("welcome"); setScreenOverlay(null); }} />;
  }

  const showNav = route === "app" && !screenOverlay;

  return (
    <div className="w-full h-full flex items-center justify-center bg-stone-200 font-sans" style={{ minHeight: "100vh" }}>
      <div className="w-full max-w-sm bg-white flex flex-col overflow-hidden shadow-xl" style={{ height: "100vh", maxHeight: 900 }}>
        <div className="flex-1 flex flex-col overflow-hidden">{body}</div>
        {showNav && <BottomNav tab={tab} setTab={setTab} />}
      </div>
    </div>
  );
}
