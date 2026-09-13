import { useState, useEffect, useRef, useMemo } from "react";
import {
  Home, Target, Repeat, CheckSquare, BookOpen, Sparkles, Settings, Sun, Moon,
  Play, Pause, Square, Flame, Plus, X, ChevronRight, Award,
  GraduationCap, Dumbbell, Utensils, Wallet, BarChart3, Send, Loader2,
  Check, ArrowRight, Trash2, RotateCcw, Bell, Droplet, DollarSign,
  TrendingUp, TrendingDown, Minus, Bot
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

/* ============================================================
   CONFIGURAÇÃO — troque o nome/identidade do produto aqui
   ============================================================ */
const CONFIG = {
  APP_NAME: "Nexora",
  TAGLINE: "O sistema operacional da sua evolução.",
  ACCENT: "#5EEAD4",
  ACCENT_DIM: "#0F766E",
};

const STORAGE_KEY = "nexora:state";

const LEVELS = [
  { min: 0, name: "Iniciante" },
  { min: 200, name: "Consistente" },
  { min: 600, name: "Disciplinado" },
  { min: 1400, name: "Executor" },
  { min: 3000, name: "Elite" },
];

const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];
const FIN_CATEGORIES = ["Alimentação", "Transporte", "Lazer", "Estudos", "Casa", "Saúde", "Assinaturas", "Outros"];
const FOOD_KCAL = {
  ovo: 78, banana: 90, pão: 120, arroz: 200, feijão: 130, frango: 220, salada: 40,
  batata: 160, leite: 100, café: 5, aveia: 150, iogurte: 90, maçã: 80, carne: 250,
  peixe: 200, queijo: 110, whey: 120, "pão integral": 100,
};

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const fmtMoney = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function weekKey(d = new Date()) {
  const c = new Date(d); const day = c.getDay(); c.setDate(c.getDate() - day);
  return c.toISOString().slice(0, 10);
}
function dateNDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function isoRange(days) { const out = []; for (let i = days - 1; i >= 0; i--) out.push(dateNDaysAgo(i)); return out; }

function levelFor(xp) {
  let lvl = LEVELS[0], idx = 0;
  LEVELS.forEach((l, i) => { if (xp >= l.min) { lvl = l; idx = i; } });
  const next = LEVELS[idx + 1];
  const progress = next ? (xp - lvl.min) / (next.min - lvl.min) : 1;
  return { name: lvl.name, index: idx + 1, progress, next };
}

function estimateKcal(items) {
  let total = 0;
  items.forEach((raw) => {
    const t = raw.toLowerCase().trim();
    const found = Object.keys(FOOD_KCAL).find((k) => t.includes(k));
    total += found ? FOOD_KCAL[found] : 150;
  });
  return total;
}

/* ============================================================
   ESTADO PADRÃO + MIGRAÇÃO (preserva dados já existentes)
   ============================================================ */
function defaultState() {
  return {
    onboarded: false,
    profile: { name: "", focus: "", vision: "", hoursPerDay: "", wake: "", sleep: "", studyTime: "19:00", workoutTime: "18:30", waterGoal: 2500, workoutDays: [] },
    theme: "dark",
    xp: 0,
    goals: [],
    habits: [],
    tasks: [],
    journal: [],
    study: { subjects: [], sessions: [], performance: [] },
    fitness: { workouts: [], schedule: {}, logs: [] },
    nutrition: { targets: { calories: 2300, protein: 160, carbs: 260, fat: 70, water: 2500 }, meals: [], water: {} },
    finance: { transactions: [], goals: [] },
    notifications: [],
    settings: {
      reminders: { study: true, water: true, workout: true, habits: true, tasks: true, goals: true, reviews: true, aiProactive: true },
      browserNotifications: false,
    },
    chat: [
      { role: "assistant", text: "Oi. Eu sou seu mentor aqui dentro do sistema. Posso analisar seu progresso, criar hábitos, montar seu plano de estudos, ajustar treinos e reorganizar sua semana — é só me pedir em linguagem natural. Por onde começamos?" }
    ],
  };
}

function migrateState(raw) {
  const def = defaultState();
  if (!raw || typeof raw !== "object") return def;
  const merged = { ...def, ...raw };
  merged.profile = { ...def.profile, ...(raw.profile || {}) };
  merged.study = { ...def.study, ...(raw.study || {}) };
  merged.fitness = { ...def.fitness, ...(raw.fitness || {}) };
  merged.nutrition = {
    targets: { ...def.nutrition.targets, ...(raw.nutrition?.targets || {}) },
    meals: raw.nutrition?.meals || [],
    water: raw.nutrition?.water || {},
  };
  merged.finance = { ...def.finance, ...(raw.finance || {}) };
  merged.settings = {
    reminders: { ...def.settings.reminders, ...(raw.settings?.reminders || {}) },
    browserNotifications: raw.settings?.browserNotifications || false,
  };
  merged.notifications = raw.notifications || [];
  merged.goals = (raw.goals || []).map((g) => ({ updatedAt: g.createdAt || todayISO(), ...g }));
  return merged;
}

/* ============================================================
   PERSISTÊNCIA
   ============================================================ */
function useLifeOSState() {
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setState(raw ? migrateState(JSON.parse(raw)) : defaultState());
    } catch {
      setState(defaultState());
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !state) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [state, loaded]);

  return [state, setState, loaded];
}

/* ============================================================
   ESTILO / TEMA
   ============================================================ */
const THEME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
  .los-root { font-family: 'Inter', -apple-system, sans-serif; }
  .los-num { font-family: 'Space Grotesk', 'Inter', sans-serif; font-feature-settings: "tnum"; }
  .los-root[data-theme="dark"] {
    --bg: #0B0D0F; --bg-elev: #131619; --bg-elev-2: #1A1E22;
    --border: rgba(255,255,255,0.08); --border-strong: rgba(255,255,255,0.14);
    --text: #EDEFF1; --text-dim: #8A9099; --text-faint: #565C64;
    --accent: ${CONFIG.ACCENT}; --accent-text: #06201C;
    --red: #F87171; --amber: #FBBF24;
  }
  .los-root[data-theme="light"] {
    --bg: #FAFAF9; --bg-elev: #FFFFFF; --bg-elev-2: #F2F2F1;
    --border: rgba(0,0,0,0.08); --border-strong: rgba(0,0,0,0.14);
    --text: #16181B; --text-dim: #676D75; --text-faint: #9CA1A8;
    --accent: ${CONFIG.ACCENT_DIM}; --accent-text: #FFFFFF;
    --red: #DC2626; --amber: #D97706;
  }
  .los-bg { background: var(--bg); color: var(--text); }
  .los-elev { background: var(--bg-elev); border: 1px solid var(--border); }
  .los-elev-2 { background: var(--bg-elev-2); }
  .los-border { border-color: var(--border) !important; }
  .los-text { color: var(--text); }
  .los-dim { color: var(--text-dim); }
  .los-faint { color: var(--text-faint); }
  .los-accent { color: var(--accent); }
  .los-accent-bg { background: var(--accent); color: var(--accent-text); }
  .los-input { background: var(--bg-elev-2); border: 1px solid var(--border); color: var(--text); }
  .los-input:focus { outline: none; border-color: var(--accent); }
  .los-btn-ghost:hover { background: var(--bg-elev-2); }
  .los-scroll::-webkit-scrollbar { width: 6px; }
  .los-scroll::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
  .los-transition { transition: all 0.15s ease; }
  .los-nav-active { background: var(--bg-elev-2); color: var(--text); }
  .los-red { color: var(--red); }
  .los-amber { color: var(--amber); }
`;

/* ============================================================
   ÁTOMOS DE UI
   ============================================================ */
function Bar({ value, className = "", color }) {
  return (
    <div className={`h-1.5 rounded-full los-elev-2 overflow-hidden ${className}`}>
      <div className="h-full rounded-full los-transition" style={{ width: `${Math.min(100, Math.max(0, value || 0))}%`, background: color || "var(--accent)" }} />
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="los-elev rounded-xl px-3 py-2.5 flex-1 min-w-[90px]">
      <p className="los-num text-lg font-semibold los-text leading-none">{value}</p>
      <p className="text-[11px] los-dim mt-1">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub, cta, onCta }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-12 h-12 rounded-xl los-elev flex items-center justify-center mb-4">
        <Icon size={20} className="los-dim" />
      </div>
      <p className="los-text font-medium mb-1">{title}</p>
      <p className="los-dim text-sm max-w-xs mb-5">{sub}</p>
      {cta && (
        <button onClick={onCta} className="los-accent-bg text-sm font-medium px-4 py-2 rounded-lg los-transition hover:opacity-90">{cta}</button>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-xs font-medium los-faint mb-2 uppercase tracking-wide">{children}</h2>;
}

function IconField({ icon: Icon, ...props }) {
  return (
    <div className="relative flex-1">
      <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 los-faint" />
      <input {...props} className="los-input w-full rounded-lg pl-8 pr-3 py-2 text-sm" />
    </div>
  );
}

/* ============================================================
   LIFE SCORE
   ============================================================ */
function computeLifeScore(state) {
  const last7 = isoRange(7);
  const domains = {};

  if (state.habits.length) {
    const total = state.habits.reduce((sum, h) => sum + last7.filter((d) => h.logs[d]).length, 0);
    domains.Hábitos = Math.round((total / (state.habits.length * 7)) * 100);
  }
  const tasksLast7 = state.tasks.filter((t) => last7.includes(t.scheduledFor));
  if (tasksLast7.length) {
    domains.Produtividade = Math.round((tasksLast7.filter((t) => t.done).length / tasksLast7.length) * 100);
  }
  if (state.study.subjects.length) {
    const sessions7 = state.study.sessions.filter((s) => last7.includes(s.date)).length;
    domains.Estudos = Math.min(100, Math.round((sessions7 / (state.study.subjects.length * 5)) * 100));
  }
  const scheduledDays = Object.values(state.fitness.schedule || {}).filter(Boolean).length;
  if (scheduledDays || state.fitness.logs.length) {
    const logs7 = state.fitness.logs.filter((l) => last7.includes(l.date)).length;
    domains.Fitness = Math.min(100, Math.round((logs7 / Math.max(1, scheduledDays)) * 100));
  }
  const goalProgresses = state.goals.map((g) => g.progress);
  if (goalProgresses.length) {
    domains.Disciplina = Math.round(goalProgresses.reduce((a, b) => a + b, 0) / goalProgresses.length);
  }
  if (state.finance.goals.length || state.finance.transactions.length) {
    const income = state.finance.transactions.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const expense = state.finance.transactions.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    const rate = income > 0 ? Math.max(0, Math.min(100, Math.round(((income - expense) / income) * 100))) : 50;
    domains.Finanças = rate;
  }

  const keys = Object.keys(domains);
  const total = keys.length ? Math.round(keys.reduce((a, k) => a + domains[k], 0) / keys.length) : 0;
  return { total, domains };
}

function computeSeries(state, days) {
  const range = isoRange(days);
  return range.map((date) => {
    let parts = [];
    if (state.habits.length) parts.push((state.habits.filter((h) => h.logs[date]).length / state.habits.length) * 100);
    const dayTasks = state.tasks.filter((t) => t.scheduledFor === date);
    if (dayTasks.length) parts.push((dayTasks.filter((t) => t.done).length / dayTasks.length) * 100);
    const score = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;
    return { date: date.slice(5), score };
  });
}

/* ============================================================
   NOTIFICAÇÕES — motor baseado em regras
   ============================================================ */
function generateNotifications(state) {
  const out = [];
  const today = todayISO();
  const wk = weekKey();
  const hour = new Date().getHours();
  const r = state.settings.reminders;
  const push = (id, type, title, message, category, actionView) => out.push({ id, type, title, message, category, actionView, time: new Date().toISOString() });

  if (r.tasks) {
    const todaysTasks = state.tasks.filter((t) => t.scheduledFor === today);
    const pending = todaysTasks.filter((t) => !t.done);
    if (todaysTasks.length && pending.length && hour >= 12) {
      push(`task-priority-${today}`, "task", "Prioridade do dia pendente", "Você ainda não concluiu sua prioridade de hoje.", "Produtividade", "tasks");
    }
  }

  if (r.habits) {
    state.habits.forEach((h) => {
      if (h.streak >= 3 && !h.logs[today] && hour >= 18) {
        push(`habit-risk-${h.id}-${today}`, "habit", "Sequência em risco", `Você está em uma sequência de ${h.streak} dias com "${h.name}". Não deixe hoje passar.`, "Hábitos", "habits");
      }
    });
  }

  if (r.goals) {
    state.goals.forEach((g) => {
      const days = Math.floor((Date.now() - new Date(g.updatedAt).getTime()) / 86400000);
      if (days >= 7 && g.progress < 100) {
        push(`goal-stalled-${g.id}-${wk}`, "goal", "Meta sem progresso", `Sua meta "${g.title}" não teve progresso nos últimos ${days} dias.`, "Metas", "goals");
      }
    });
  }

  if (r.water) {
    const ml = state.nutrition.water[today] || 0;
    const goal = state.profile.waterGoal || state.nutrition.targets.water || 2500;
    const expectedByNow = Math.min(goal, Math.round((Math.max(0, hour - 7) / 14) * goal));
    if (hour >= 9 && hour <= 21 && ml < expectedByNow - 300) {
      push(`water-${today}-${Math.floor(hour / 3)}`, "water", "Ritmo de hidratação baixo", `Você está abaixo do ritmo de hidratação de hoje. Que tal mais 250ml?`, "Nutrição", "nutrition");
    }
  }

  if (r.study && state.study.subjects.length) {
    const doneToday = state.study.sessions.some((s) => s.date === today);
    const [hh] = (state.profile.studyTime || "19:00").split(":").map(Number);
    if (!doneToday && hour >= hh) {
      push(`study-${today}`, "study", "Bloco de estudo", "Seu bloco de estudo de hoje ainda não começou.", "Estudos", "study");
    }
  }

  if (r.workout) {
    const weekday = new Date().getDay();
    const scheduled = state.fitness.schedule?.[weekday];
    const doneToday = state.fitness.logs.some((l) => l.date === today);
    const [hh] = (state.profile.workoutTime || "18:30").split(":").map(Number);
    if (scheduled && !doneToday && hour >= hh) {
      const w = state.fitness.workouts.find((w) => w.id === scheduled);
      push(`workout-${today}`, "workout", "Hora do treino", `Seu treino "${w?.name || ""}" está marcado para hoje.`, "Fitness", "fitness");
    }
  }

  if (r.reviews && new Date().getDay() === 0 && hour >= 18) {
    push(`review-week-${wk}`, "review", "Revisão semanal", "É hora de revisar sua semana e ajustar a rota.", "Revisão", "evolution");
  }

  if (r.aiProactive) {
    const s7 = computeSeries(state, 7);
    const s14 = computeSeries(state, 14);
    const avg7 = s7.reduce((a, b) => a + b.score, 0) / (s7.length || 1);
    const avgPrev7 = s14.slice(0, 7).reduce((a, b) => a + b.score, 0) / 7;
    if (avgPrev7 > 0 && avg7 < avgPrev7 - 12) {
      push(`insight-${wk}`, "ai", "Insight do Mentor", "Sua consistência caiu esta semana em relação à anterior. Vale conversar com o Mentor sobre o motivo.", "IA", "mentor");
    }
  }

  return out;
}

function useNotificationEngine(state, setState) {
  useEffect(() => {
    if (!state) return;
    const fresh = generateNotifications(state);
    const existingIds = new Set(state.notifications.map((n) => n.id));
    const toAdd = fresh.filter((n) => !existingIds.has(n.id));
    if (toAdd.length) {
      setState((s) => ({
        ...s,
        notifications: [...toAdd.map((n) => ({ ...n, read: false })), ...s.notifications].slice(0, 40),
      }));
      if (state.settings.browserNotifications && typeof Notification !== "undefined" && Notification.permission === "granted") {
        toAdd.forEach((n) => { try { new Notification(n.title, { body: n.message }); } catch {} });
      }
    }
    // eslint-disable-next-line
  }, [state?.tasks, state?.habits, state?.goals, state?.study, state?.fitness, state?.nutrition]);
}

const NOTIF_ICON = { task: CheckSquare, habit: Flame, goal: Target, water: Droplet, study: GraduationCap, workout: Dumbbell, review: BarChart3, ai: Sparkles };

function TopBar({ title, state, setState, setView }) {
  const [open, setOpen] = useState(false);
  const unread = state.notifications.filter((n) => !n.read).length;
  function markAllRead() { setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) })); }
  function openNotif(n) {
    setState((s) => ({ ...s, notifications: s.notifications.map((x) => x.id === n.id ? { ...x, read: true } : x) }));
    setView(n.actionView);
    setOpen(false);
  }
  return (
    <div className="sticky top-0 z-20 los-bg border-b los-border flex items-center justify-between px-6 py-3">
      <span className="text-sm font-medium los-dim">{title}</span>
      <div className="relative">
        <button onClick={() => setOpen((o) => !o)} className="relative los-dim hover:los-text p-2 rounded-lg los-btn-ghost los-transition">
          <Bell size={17} />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--red)" }} />}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-80 los-elev rounded-xl overflow-hidden z-30 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 border-b los-border">
              <span className="text-sm font-medium los-text">Notificações</span>
              {unread > 0 && <button onClick={markAllRead} className="text-xs los-accent">marcar tudo como lido</button>}
            </div>
            <div className="max-h-80 overflow-y-auto los-scroll">
              {state.notifications.length === 0 ? (
                <p className="text-sm los-dim text-center py-8">Tudo em dia por aqui.</p>
              ) : state.notifications.slice(0, 15).map((n) => {
                const Icon = NOTIF_ICON[n.type] || Bell;
                return (
                  <button key={n.id} onClick={() => openNotif(n)} className={`w-full text-left flex gap-3 px-4 py-3 border-b los-border los-transition los-btn-ghost ${n.read ? "opacity-50" : ""}`}>
                    <Icon size={14} className="los-accent mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm los-text font-medium leading-snug">{n.title}</p>
                      <p className="text-xs los-dim mt-0.5 leading-snug">{n.message}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ONBOARDING
   ============================================================ */
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name: "", focus: "", vision: "", hoursPerDay: "", wake: "", sleep: "", studyTime: "19:00", workoutTime: "18:30", waterGoal: 2500, workoutDays: [] });
  const focuses = ["Carreira", "Dinheiro", "Saúde", "Estudos", "Disciplina", "Relacionamentos", "Desenvolvimento pessoal"];

  const steps = [
    { title: "Vamos descobrir onde você quer chegar.", valid: data.name.trim().length > 0, body: (
      <input autoFocus className="los-input w-full rounded-lg px-4 py-3 text-lg" placeholder="Como você gostaria de ser chamado?" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
    )},
    { title: "Qual sua principal prioridade agora?", valid: !!data.focus, body: (
      <div className="grid grid-cols-2 gap-2">
        {focuses.map((f) => (
          <button key={f} onClick={() => setData({ ...data, focus: f })} className={`text-left px-4 py-3 rounded-lg text-sm los-transition ${data.focus === f ? "los-accent-bg" : "los-elev los-btn-ghost"}`}>{f}</button>
        ))}
      </div>
    )},
    { title: "Como você gostaria que sua vida estivesse daqui a 1 ano?", valid: data.vision.trim().length > 3, body: (
      <textarea autoFocus rows={4} className="los-input w-full rounded-lg px-4 py-3 resize-none" placeholder="Descreva em poucas frases..." value={data.vision} onChange={(e) => setData({ ...data, vision: e.target.value })} />
    )},
    { title: "Quanto tempo você consegue dedicar por dia?", valid: !!data.hoursPerDay, body: (
      <div className="grid grid-cols-3 gap-2">
        {["< 1h", "1–2h", "2–4h", "4h+"].map((h) => (
          <button key={h} onClick={() => setData({ ...data, hoursPerDay: h })} className={`px-4 py-3 rounded-lg text-sm los-transition ${data.hoursPerDay === h ? "los-accent-bg" : "los-elev los-btn-ghost"}`}>{h}</button>
        ))}
      </div>
    )},
    { title: "Vamos personalizar sua rotina? (opcional)", valid: true, body: (
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1"><label className="text-xs los-dim block mb-1">Acordar</label><input type="time" className="los-input w-full rounded-lg px-3 py-2 text-sm" value={data.wake} onChange={(e) => setData({ ...data, wake: e.target.value })} /></div>
          <div className="flex-1"><label className="text-xs los-dim block mb-1">Dormir</label><input type="time" className="los-input w-full rounded-lg px-3 py-2 text-sm" value={data.sleep} onChange={(e) => setData({ ...data, sleep: e.target.value })} /></div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1"><label className="text-xs los-dim block mb-1">Horário de estudo</label><input type="time" className="los-input w-full rounded-lg px-3 py-2 text-sm" value={data.studyTime} onChange={(e) => setData({ ...data, studyTime: e.target.value })} /></div>
          <div className="flex-1"><label className="text-xs los-dim block mb-1">Horário de treino</label><input type="time" className="los-input w-full rounded-lg px-3 py-2 text-sm" value={data.workoutTime} onChange={(e) => setData({ ...data, workoutTime: e.target.value })} /></div>
        </div>
        <div>
          <label className="text-xs los-dim block mb-1">Meta de água (ml)</label>
          <input type="number" step={250} className="los-input w-full rounded-lg px-3 py-2 text-sm" value={data.waterGoal} onChange={(e) => setData({ ...data, waterGoal: +e.target.value })} />
        </div>
        <div>
          <label className="text-xs los-dim block mb-1">Dias de treino</label>
          <div className="flex gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => (
              <button key={i} onClick={() => setData((p) => ({ ...p, workoutDays: p.workoutDays.includes(i) ? p.workoutDays.filter((x) => x !== i) : [...p.workoutDays, i] }))} className={`w-9 h-9 rounded-lg text-xs los-transition ${data.workoutDays.includes(i) ? "los-accent-bg" : "los-elev los-btn-ghost"}`}>{d}</button>
            ))}
          </div>
        </div>
      </div>
    )},
  ];

  const cur = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="min-h-screen los-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex gap-1.5 mb-10">
          {steps.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full los-elev-2 overflow-hidden">
              <div className="h-full los-transition" style={{ width: i <= step ? "100%" : "0%", background: "var(--accent)" }} />
            </div>
          ))}
        </div>
        <p className="los-faint text-xs mb-2 los-num">{String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</p>
        <h1 className="text-2xl font-semibold los-text mb-6 leading-snug">{cur.title}</h1>
        <div className="mb-8">{cur.body}</div>
        <button disabled={!cur.valid} onClick={() => (last ? onDone(data) : setStep(step + 1))} className="w-full los-accent-bg font-medium rounded-lg py-3 flex items-center justify-center gap-2 disabled:opacity-30 los-transition hover:opacity-90">
          {last ? "Criar meu plano" : "Continuar"} <ArrowRight size={16} />
        </button>
        {!last && step === steps.length - 2 && null}
        {last && <button onClick={() => onDone({ ...data })} className="w-full text-xs los-faint mt-3">pular personalização e usar padrões</button>}
      </div>
    </div>
  );
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
const NAV = [
  { id: "today", label: "Hoje", icon: Home },
  { id: "goals", label: "Metas", icon: Target },
  { id: "habits", label: "Hábitos", icon: Repeat },
  { id: "tasks", label: "Tarefas", icon: CheckSquare },
  { id: "journal", label: "Diário", icon: BookOpen },
  { id: "study", label: "Estudos", icon: GraduationCap },
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "nutrition", label: "Nutrição", icon: Utensils },
  { id: "finance", label: "Finanças", icon: Wallet },
  { id: "evolution", label: "Evolução", icon: BarChart3 },
  { id: "mentor", label: "Mentor IA", icon: Sparkles },
];

function Sidebar({ view, setView, xp }) {
  const lvl = levelFor(xp);
  return (
    <div className="hidden md:flex flex-col w-56 shrink-0 h-screen los-bg border-r los-border">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md los-accent-bg flex items-center justify-center text-[10px] font-bold">{CONFIG.APP_NAME[0]}</div>
          <span className="font-semibold los-text tracking-tight">{CONFIG.APP_NAME}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto los-scroll px-3 space-y-0.5">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setView(n.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm los-transition los-btn-ghost ${view === n.id ? "los-nav-active" : "los-dim"}`}>
            <n.icon size={16} />{n.label}
          </button>
        ))}
      </div>
      <div className="p-3 border-t los-border space-y-1">
        <button onClick={() => setView("settings")} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm los-transition los-btn-ghost ${view === "settings" ? "los-nav-active" : "los-dim"}`}>
          <Settings size={16} /> Configurações
        </button>
        <div className="px-3 py-2 rounded-lg los-elev mt-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs los-dim">Nível {lvl.index} · {lvl.name}</span>
            <span className="text-xs los-num los-accent">{xp} XP</span>
          </div>
          <Bar value={lvl.progress * 100} />
        </div>
      </div>
    </div>
  );
}

function MobileNav({ view, setView }) {
  const items = [NAV[0], NAV[1], NAV[3], NAV[5], { id: "mentor", label: "IA", icon: Sparkles }];
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 los-elev border-t los-border flex justify-around py-2 z-30">
      {items.map((n) => (
        <button key={n.id} onClick={() => setView(n.id)} className={`flex flex-col items-center gap-0.5 px-2 py-1 ${view === n.id ? "los-accent" : "los-faint"}`}>
          <n.icon size={18} /><span className="text-[10px]">{n.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   FOCUS MODE (genérico: tarefa, estudo ou treino)
   ============================================================ */
function FocusMode({ item, onFinish, onAbandon }) {
  const DURATIONS = [25, 50, 90];
  const [duration, setDuration] = useState(item.duration && DURATIONS.includes(item.duration) ? item.duration : 25);
  const [seconds, setSeconds] = useState(duration * 60);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => { if (!started) setSeconds(duration * 60); }, [duration, started]);
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => { if (s <= 1) { clearInterval(intervalRef.current); setRunning(false); return 0; } return s - 1; });
      }, 1000);
    } else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  const finished = seconds === 0;

  return (
    <div className="fixed inset-0 los-bg z-50 flex flex-col items-center justify-center p-6">
      <button onClick={onAbandon} className="absolute top-5 right-5 los-dim hover:los-text los-transition p-2"><X size={20} /></button>
      <p className="los-faint text-xs uppercase tracking-wide mb-1">{item.kindLabel}</p>
      <p className="los-dim text-sm mb-2">{item.title}</p>
      <div className="los-num text-7xl font-semibold los-text tracking-tight mb-8">{mins}:{secs}</div>
      {!started ? (
        <>
          <div className="flex gap-2 mb-8">
            {DURATIONS.map((d) => (
              <button key={d} onClick={() => setDuration(d)} className={`px-4 py-2 rounded-lg text-sm los-transition ${duration === d ? "los-accent-bg" : "los-elev los-btn-ghost"}`}>{d} min</button>
            ))}
          </div>
          <button onClick={() => { setStarted(true); setRunning(true); }} className="los-accent-bg rounded-full w-16 h-16 flex items-center justify-center hover:opacity-90 los-transition">
            <Play size={22} fill="currentColor" />
          </button>
        </>
      ) : finished ? (
        <div className="text-center">
          <p className="los-text font-medium mb-6">Você avançou mais um passo.</p>
          <button onClick={() => onFinish(duration)} className="los-accent-bg rounded-lg px-6 py-3 text-sm font-medium hover:opacity-90 los-transition">Concluir · +{duration} XP</button>
        </div>
      ) : (
        <div className="flex gap-3">
          <button onClick={() => setRunning((r) => !r)} className="los-elev rounded-full w-14 h-14 flex items-center justify-center los-btn-ghost los-transition">{running ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button>
          <button onClick={() => onFinish(duration)} className="los-elev rounded-full w-14 h-14 flex items-center justify-center los-btn-ghost los-transition"><Square size={16} /></button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   HOJE (DASHBOARD)
   ============================================================ */
function TodayView({ state, setState, setView, startFocus }) {
  const today = todayISO();
  const todaysTasks = state.tasks.filter((t) => t.scheduledFor === today);
  const doneCount = todaysTasks.filter((t) => t.done).length;
  const habitsDone = state.habits.filter((h) => h.logs[today]).length;
  const totalObjectives = todaysTasks.length + state.habits.length;
  const doneObjectives = doneCount + habitsDone;
  const pct = totalObjectives ? Math.round((doneObjectives / totalObjectives) * 100) : 0;
  const score = useMemo(() => computeLifeScore(state), [state]);
  const scoreLastWeek = useMemo(() => {
    const series = computeSeries(state, 14);
    const prev = series.slice(0, 7).reduce((a, b) => a + b.score, 0) / 7;
    return Math.round(prev);
  }, [state]);
  const scoreDelta = score.total - scoreLastWeek;

  const weekday = new Date().getDay();
  const scheduledWorkoutId = state.fitness.schedule?.[weekday];
  const scheduledWorkout = state.fitness.workouts.find((w) => w.id === scheduledWorkoutId);
  const workoutDoneToday = state.fitness.logs.some((l) => l.date === today);

  const events = [];
  todaysTasks.filter((t) => t.time && !t.done).forEach((t) => events.push({ time: t.time, label: t.title, view: "tasks" }));
  if (scheduledWorkout && !workoutDoneToday) events.push({ time: state.profile.workoutTime, label: `Treino: ${scheduledWorkout.name}`, view: "fitness" });
  if (state.study.subjects.length && !state.study.sessions.some((s) => s.date === today)) events.push({ time: state.profile.studyTime, label: "Bloco de estudo", view: "study" });
  events.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const insight = useMemo(() => {
    if (scoreDelta >= 8) return "Você está mais consistente que na semana passada. Continue no ritmo.";
    if (scoreDelta <= -8) return "Sua consistência caiu em relação à semana passada. Pode valer a pena revisar sua rotina com o Mentor.";
    if (todaysTasks.length && doneCount === 0 && new Date().getHours() >= 14) return "O dia está avançando e nenhuma prioridade foi concluída ainda. Que tal começar pela mais curta?";
    return "Seu ritmo está estável. Foco em manter o que já funciona.";
  }, [scoreDelta, todaysTasks, doneCount]);

  function toggleTask(id) {
    setState((s) => {
      const wasDone = s.tasks.find((t) => t.id === id)?.done;
      return { ...s, tasks: s.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t), xp: s.xp + (wasDone ? -15 : 15) };
    });
  }
  function toggleHabit(id) {
    setState((s) => {
      const habits = s.habits.map((h) => {
        if (h.id !== id) return h;
        const already = !!h.logs[today];
        const logs = { ...h.logs };
        if (already) delete logs[today]; else logs[today] = true;
        const streak = already ? Math.max(0, h.streak - 1) : h.streak + 1;
        return { ...h, logs, streak, bestStreak: Math.max(h.bestStreak, streak) };
      });
      const wasDone = !!s.habits.find((h) => h.id === id)?.logs[today];
      return { ...s, habits, xp: s.xp + (wasDone ? -10 : 10) };
    });
  }

  const sorted = [...todaysTasks].sort((a, b) => (a.priority || 9) - (b.priority || 9));

  const quickActions = [
    { label: "Nova tarefa", icon: Plus, view: "tasks" },
    { label: "Nova meta", icon: Target, view: "goals" },
    { label: "Registrar água", icon: Droplet, view: "nutrition" },
    { label: "Registrar refeição", icon: Utensils, view: "nutrition" },
    { label: "Iniciar estudo", icon: GraduationCap, view: "study" },
    { label: "Iniciar treino", icon: Dumbbell, view: "fitness" },
    { label: "Escrever diário", icon: BookOpen, view: "journal" },
    { label: "Falar com IA", icon: Sparkles, view: "mentor" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold los-text">Bom dia, {state.profile.name || "por aí"}.</h1>
        {state.profile.vision && <p className="los-dim text-sm mt-1 italic">"{state.profile.vision}"</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="los-elev rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-xs los-dim uppercase tracking-wide">Hoje</span>
            <span className="los-num text-2xl font-semibold los-text">{pct}%</span>
          </div>
          <Bar value={pct} className="h-2 mb-2" />
          <p className="los-dim text-xs">{doneObjectives}/{totalObjectives || 0} objetivos concluídos</p>
        </div>
        <div className="los-elev rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-xs los-dim uppercase tracking-wide">Life Score</span>
            <span className="los-num text-2xl font-semibold los-text">{score.total}</span>
          </div>
          <Bar value={score.total} className="h-2 mb-2" />
          <p className="text-xs flex items-center gap-1 los-dim">
            {scoreDelta > 0 ? <TrendingUp size={12} className="los-accent" /> : scoreDelta < 0 ? <TrendingDown size={12} className="los-red" /> : <Minus size={12} />}
            {scoreDelta > 0 ? "+" : ""}{scoreDelta} esta semana
          </p>
        </div>
      </div>

      <div className="los-elev rounded-xl p-4 flex gap-3 items-start">
        <Bot size={16} className="los-accent shrink-0 mt-0.5" />
        <p className="text-sm los-text leading-relaxed">{insight}</p>
      </div>

      <div>
        <SectionTitle>Foco de hoje</SectionTitle>
        {sorted.length === 0 ? (
          <div className="los-elev rounded-xl"><EmptyState icon={Target} title="Nenhuma prioridade definida para hoje" sub="Adicione tarefas ou peça ao Mentor IA para montar seu dia." cta="Adicionar tarefa" onCta={() => setView("tasks")} /></div>
        ) : (
          <div className="space-y-2">
            {sorted.map((t, i) => (
              <div key={t.id} className="los-elev rounded-xl px-4 py-3.5 flex items-center gap-3 los-transition">
                <button onClick={() => toggleTask(t.id)} className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 los-transition ${t.done ? "los-accent-bg border-transparent" : "los-border"}`}>{t.done && <Check size={12} strokeWidth={3} />}</button>
                <span className="los-faint text-xs los-num w-4">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm los-text ${t.done ? "line-through los-faint" : ""}`}>{t.title}</p>
                  <p className="text-xs los-dim">{t.time ? `${t.time} · ` : ""}{t.duration ? `${t.duration} min` : ""} {t.category ? `· ${t.category}` : ""}</p>
                </div>
                {!t.done && <button onClick={() => startFocus({ ...t, kindLabel: "Tarefa" }, "task")} className="text-xs px-3 py-1.5 rounded-lg los-elev-2 los-text los-transition hover:opacity-80">Começar</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {state.habits.length > 0 && (
        <div>
          <SectionTitle>Hábitos de hoje</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {state.habits.map((h) => {
              const done = !!h.logs[today];
              return (
                <button key={h.id} onClick={() => toggleHabit(h.id)} className={`los-elev rounded-xl px-4 py-3 text-left los-transition ${done ? "los-nav-active" : ""}`}>
                  <div className="flex items-center justify-between mb-1"><span className="text-sm los-text">{h.name}</span>{done && <Check size={14} className="los-accent" />}</div>
                  <span className="text-xs los-dim flex items-center gap-1"><Flame size={11} />{h.streak}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div>
          <SectionTitle>Próximos eventos</SectionTitle>
          <div className="los-elev rounded-xl divide-y los-border">
            {events.map((e, i) => (
              <button key={i} onClick={() => setView(e.view)} className="w-full flex items-center gap-3 px-4 py-3 text-left los-btn-ghost los-transition">
                <span className="los-num text-xs los-accent w-10">{e.time}</span>
                <span className="text-sm los-text">{e.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionTitle>Progresso</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(score.domains).map(([k, v]) => (
            <div key={k} className="los-elev rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5"><span className="text-xs los-dim">{k}</span><span className="text-xs los-num los-text">{v}</span></div>
              <Bar value={v} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Ações rápidas</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((q) => (
            <button key={q.label} onClick={() => setView(q.view)} className="los-elev rounded-xl py-3 flex flex-col items-center gap-1.5 los-btn-ghost los-transition">
              <q.icon size={15} className="los-accent" /><span className="text-[10px] los-dim text-center leading-tight">{q.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   METAS
   ============================================================ */
function NewGoalForm({ onCreate, onCancel }) {
  const [f, setF] = useState({ title: "", why: "", horizon: "Ano", category: "Carreira" });
  const horizons = ["Hoje", "Semana", "Mês", "Ano", "Longo prazo"];
  const cats = ["Carreira", "Dinheiro", "Saúde", "Estudos", "Disciplina", "Relacionamentos", "Projetos"];
  return (
    <div className="los-elev rounded-xl p-5 space-y-3">
      <input autoFocus className="los-input w-full rounded-lg px-3 py-2.5 text-sm" placeholder="O que você quer alcançar?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input className="los-input w-full rounded-lg px-3 py-2.5 text-sm" placeholder="Por que isso importa para você?" value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} />
      <div className="flex flex-wrap gap-2">{horizons.map((h) => (<button key={h} onClick={() => setF({ ...f, horizon: h })} className={`text-xs px-3 py-1.5 rounded-lg los-transition ${f.horizon === h ? "los-accent-bg" : "los-elev-2 los-dim"}`}>{h}</button>))}</div>
      <div className="flex flex-wrap gap-2">{cats.map((c) => (<button key={c} onClick={() => setF({ ...f, category: c })} className={`text-xs px-3 py-1.5 rounded-lg los-transition ${f.category === c ? "los-nav-active los-text" : "los-elev-2 los-dim"}`}>{c}</button>))}</div>
      <div className="flex gap-2 pt-1">
        <button disabled={!f.title.trim()} onClick={() => onCreate(f)} className="los-accent-bg text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-30 hover:opacity-90 los-transition">Criar meta</button>
        <button onClick={onCancel} className="text-sm px-4 py-2 rounded-lg los-dim los-btn-ghost los-transition">Cancelar</button>
      </div>
    </div>
  );
}

function breakdownMilestones(title) {
  return [
    { id: uid(), title: `Definir o plano para "${title}"`, done: false },
    { id: uid(), title: "Primeiros 30 dias de execução", done: false },
    { id: uid(), title: "Revisão de meio de percurso", done: false },
    { id: uid(), title: "Reta final", done: false },
  ];
}

function GoalsView({ state, setState }) {
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);

  function createGoal(f) {
    const goal = { id: uid(), ...f, progress: 0, milestones: breakdownMilestones(f.title), createdAt: todayISO(), updatedAt: todayISO() };
    setState((s) => ({ ...s, goals: [goal, ...s.goals] }));
    setCreating(false);
  }
  function toggleMilestone(goalId, msId) {
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const milestones = g.milestones.map((m) => m.id === msId ? { ...m, done: !m.done } : m);
        const progress = Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100);
        return { ...g, milestones, progress, updatedAt: todayISO() };
      }),
      xp: s.xp + 25,
    }));
  }
  function removeGoal(id) { setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })); }

  const groups = ["Hoje", "Semana", "Mês", "Ano", "Longo prazo"];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold los-text">Metas</h1><p className="los-dim text-sm mt-0.5">Sua direção, dividida em passos alcançáveis.</p></div>
        {!creating && <button onClick={() => setCreating(true)} className="los-accent-bg text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 hover:opacity-90 los-transition"><Plus size={15} /> Nova meta</button>}
      </div>
      {creating && <NewGoalForm onCreate={createGoal} onCancel={() => setCreating(false)} />}
      {state.goals.length === 0 && !creating ? (
        <div className="los-elev rounded-xl"><EmptyState icon={Target} title="Você ainda não definiu sua direção." sub="Toda grande mudança começa com uma meta clara." cta="Criar minha primeira meta" onCta={() => setCreating(true)} /></div>
      ) : groups.map((g) => {
        const goals = state.goals.filter((x) => x.horizon === g);
        if (!goals.length) return null;
        return (
          <div key={g}>
            <SectionTitle>{g}</SectionTitle>
            <div className="space-y-2">
              {goals.map((goal) => (
                <div key={goal.id} className="los-elev rounded-xl overflow-hidden">
                  <button onClick={() => setExpanded(expanded === goal.id ? null : goal.id)} className="w-full text-left px-4 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0"><p className="text-sm los-text font-medium">{goal.title}</p><p className="text-xs los-dim mt-0.5">{goal.category}{goal.why ? ` · ${goal.why}` : ""}</p></div>
                    <span className="text-xs los-num los-accent shrink-0">{goal.progress}%</span>
                    <ChevronRight size={15} className={`los-faint los-transition shrink-0 ${expanded === goal.id ? "rotate-90" : ""}`} />
                  </button>
                  <div className="px-4 pb-3"><Bar value={goal.progress} /></div>
                  {expanded === goal.id && (
                    <div className="px-4 pb-4 space-y-1.5 border-t los-border pt-3">
                      {goal.milestones.map((m) => (
                        <button key={m.id} onClick={() => toggleMilestone(goal.id, m.id)} className="w-full flex items-center gap-2.5 py-1.5 text-left los-transition">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${m.done ? "los-accent-bg border-transparent" : "los-border"}`}>{m.done && <Check size={10} strokeWidth={3} />}</div>
                          <span className={`text-sm ${m.done ? "los-faint line-through" : "los-text"}`}>{m.title}</span>
                        </button>
                      ))}
                      <button onClick={() => removeGoal(goal.id)} className="flex items-center gap-1.5 text-xs los-faint hover:text-red-400 los-transition mt-2"><Trash2 size={12} /> Remover meta</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   HÁBITOS
   ============================================================ */
function NewHabitForm({ onCreate, onCancel }) {
  const [name, setName] = useState("");
  return (
    <div className="los-elev rounded-xl p-4 flex gap-2">
      <input autoFocus className="los-input flex-1 rounded-lg px-3 py-2 text-sm" placeholder="Ex: beber água, treinar, ler 10 páginas..." value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate(name)} />
      <button disabled={!name.trim()} onClick={() => onCreate(name)} className="los-accent-bg text-sm px-3 py-2 rounded-lg disabled:opacity-30">Criar</button>
      <button onClick={onCancel} className="los-dim text-sm px-3 py-2 rounded-lg los-btn-ghost">Cancelar</button>
    </div>
  );
}

function HabitsView({ state, setState }) {
  const [creating, setCreating] = useState(false);
  const days = isoRange(7);
  const today = todayISO();

  function createHabit(name) { setState((s) => ({ ...s, habits: [{ id: uid(), name, streak: 0, bestStreak: 0, logs: {} }, ...s.habits] })); setCreating(false); }
  function toggleDay(id, date) {
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) => {
        if (h.id !== id) return h;
        const logs = { ...h.logs };
        if (logs[date]) delete logs[date]; else logs[date] = true;
        let streak = 0;
        for (let i = days.length - 1; i >= 0; i--) { if (logs[days[i]]) streak++; else break; }
        return { ...h, logs, streak, bestStreak: Math.max(h.bestStreak, streak) };
      }),
    }));
  }
  function removeHabit(id) { setState((s) => ({ ...s, habits: s.habits.filter((h) => h.id !== id) })); }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold los-text">Hábitos</h1><p className="los-dim text-sm mt-0.5">Pequenas ações repetidas criam grandes mudanças.</p></div>
        {!creating && <button onClick={() => setCreating(true)} className="los-accent-bg text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 hover:opacity-90 los-transition"><Plus size={15} /> Novo hábito</button>}
      </div>
      {creating && <NewHabitForm onCreate={createHabit} onCancel={() => setCreating(false)} />}
      {state.habits.length === 0 && !creating ? (
        <div className="los-elev rounded-xl"><EmptyState icon={Repeat} title="Nenhum hábito criado ainda" sub="Comece pequeno — a consistência importa mais que a intensidade." cta="Criar hábito" onCta={() => setCreating(true)} /></div>
      ) : (
        <div className="space-y-2">
          {state.habits.map((h) => (
            <div key={h.id} className="los-elev rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div><p className="text-sm los-text font-medium">{h.name}</p><p className="text-xs los-dim flex items-center gap-1 mt-0.5"><Flame size={11} className="los-accent" />{h.streak} atual · melhor {h.bestStreak}</p></div>
                <button onClick={() => removeHabit(h.id)} className="los-faint hover:text-red-400 los-transition"><Trash2 size={14} /></button>
              </div>
              <div className="flex gap-1.5">
                {days.map((d) => {
                  const on = !!h.logs[d];
                  return (
                    <button key={d} onClick={() => toggleDay(h.id, d)} className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-[10px] los-faint">{WEEKDAY_SHORT[new Date(d + "T00:00:00").getDay()]}</span>
                      <div className={`w-full h-8 rounded-md los-transition ${on ? "los-accent-bg" : "los-elev-2"}`} style={d === today ? { boxShadow: `inset 0 0 0 1px var(--border-strong)` } : {}} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAREFAS
   ============================================================ */
function NewTaskForm({ onCreate, onCancel }) {
  const [f, setF] = useState({ title: "", duration: 30, category: "Geral", scheduledFor: todayISO(), time: "" });
  return (
    <div className="los-elev rounded-xl p-4 space-y-2.5">
      <input autoFocus className="los-input w-full rounded-lg px-3 py-2 text-sm" placeholder="O que precisa ser feito?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <div className="flex flex-wrap gap-2">
        <input type="number" className="los-input w-20 rounded-lg px-3 py-2 text-sm" value={f.duration} onChange={(e) => setF({ ...f, duration: +e.target.value })} />
        <span className="los-dim text-xs self-center">min</span>
        <input className="los-input flex-1 min-w-[100px] rounded-lg px-3 py-2 text-sm" placeholder="Categoria" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <input type="date" className="los-input rounded-lg px-3 py-2 text-sm" value={f.scheduledFor} onChange={(e) => setF({ ...f, scheduledFor: e.target.value })} />
        <input type="time" className="los-input rounded-lg px-3 py-2 text-sm" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
      </div>
      <div className="flex gap-2 pt-1">
        <button disabled={!f.title.trim()} onClick={() => onCreate(f)} className="los-accent-bg text-sm px-4 py-2 rounded-lg disabled:opacity-30">Adicionar</button>
        <button onClick={onCancel} className="los-dim text-sm px-4 py-2 rounded-lg los-btn-ghost">Cancelar</button>
      </div>
    </div>
  );
}

function TasksView({ state, setState, startFocus }) {
  const [creating, setCreating] = useState(false);
  function createTask(f) {
    const priority = state.tasks.filter((t) => t.scheduledFor === f.scheduledFor).length + 1;
    setState((s) => ({ ...s, tasks: [{ id: uid(), ...f, done: false, priority }, ...s.tasks] }));
    setCreating(false);
  }
  function toggle(id) {
    setState((s) => {
      const wasDone = s.tasks.find((t) => t.id === id)?.done;
      return { ...s, tasks: s.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t), xp: s.xp + (wasDone ? -15 : 15) };
    });
  }
  function remove(id) { setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })); }

  const upcoming = [...state.tasks].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold los-text">Tarefas</h1>
        {!creating && <button onClick={() => setCreating(true)} className="los-accent-bg text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 hover:opacity-90 los-transition"><Plus size={15} /> Nova tarefa</button>}
      </div>
      {creating && <NewTaskForm onCreate={createTask} onCancel={() => setCreating(false)} />}
      {upcoming.length === 0 && !creating ? (
        <div className="los-elev rounded-xl"><EmptyState icon={CheckSquare} title="Nenhuma tarefa planejada" sub="Clareza começa com uma lista simples do que precisa ser feito." cta="Adicionar tarefa" onCta={() => setCreating(true)} /></div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((t) => (
            <div key={t.id} className="los-elev rounded-xl px-4 py-3 flex items-center gap-3">
              <button onClick={() => toggle(t.id)} className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 los-transition ${t.done ? "los-accent-bg border-transparent" : "los-border"}`}>{t.done && <Check size={12} strokeWidth={3} />}</button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm los-text ${t.done ? "line-through los-faint" : ""}`}>{t.title}</p>
                <p className="text-xs los-dim">{t.scheduledFor}{t.time ? ` · ${t.time}` : ""} · {t.duration}min {t.category ? `· ${t.category}` : ""}</p>
              </div>
              {!t.done && <button onClick={() => startFocus({ ...t, kindLabel: "Tarefa" }, "task")} className="text-xs px-3 py-1.5 rounded-lg los-elev-2 los-transition hover:opacity-80">Começar</button>}
              <button onClick={() => remove(t.id)} className="los-faint hover:text-red-400 los-transition"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   DIÁRIO
   ============================================================ */
function JournalView({ state, setState }) {
  const [text, setText] = useState("");
  const [mood, setMood] = useState(3);
  const moods = ["😞", "😕", "😐", "🙂", "😄"];
  function save() {
    if (!text.trim()) return;
    setState((s) => ({ ...s, journal: [{ id: uid(), date: todayISO(), mood, text }, ...s.journal], xp: s.xp + 15 }));
    setText("");
  }
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div><h1 className="text-xl font-semibold los-text">Diário</h1><p className="los-dim text-sm mt-0.5">Como foi seu dia?</p></div>
      <div className="los-elev rounded-xl p-4 space-y-3">
        <div className="flex gap-2">{moods.map((m, i) => (<button key={i} onClick={() => setMood(i)} className={`text-lg w-9 h-9 rounded-lg los-transition ${mood === i ? "los-nav-active" : "los-btn-ghost"}`}>{m}</button>))}</div>
        <textarea rows={5} className="los-input w-full rounded-lg px-3 py-2.5 text-sm resize-none" placeholder="O que aconteceu hoje? O que você realizou, o que não deu, o que aprendeu..." value={text} onChange={(e) => setText(e.target.value)} />
        <button disabled={!text.trim()} onClick={save} className="los-accent-bg text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-30 hover:opacity-90 los-transition">Salvar entrada</button>
      </div>
      {state.journal.length === 0 ? (
        <div className="los-elev rounded-xl"><EmptyState icon={BookOpen} title="Nenhuma entrada ainda" sub="Registrar seus dias ajuda a IA a identificar padrões reais na sua rotina." /></div>
      ) : (
        <div className="space-y-2">
          {state.journal.map((j) => (
            <div key={j.id} className="los-elev rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5"><span>{moods[j.mood]}</span><span className="text-xs los-faint">{j.date}</span></div>
              <p className="text-sm los-text leading-relaxed">{j.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ESTUDOS
   ============================================================ */
function StudyView({ state, setState, startFocus }) {
  const [addingSubject, setAddingSubject] = useState(false);
  const [subjForm, setSubjForm] = useState({ name: "", goal: "", priority: "Média", deadline: "" });
  const [expanded, setExpanded] = useState(null);
  const [perfForm, setPerfForm] = useState(null);
  const today = todayISO();
  const week = isoRange(7), month = isoRange(30);

  const minutesIn = (range) => state.study.sessions.filter((s) => range.includes(s.date)).reduce((a, b) => a + b.duration, 0);
  const hoursToday = Math.round((minutesIn([today]) / 60) * 10) / 10;
  const hoursWeek = Math.round((minutesIn(week) / 60) * 10) / 10;
  const hoursMonth = Math.round((minutesIn(month) / 60) * 10) / 10;
  const sessionDays = new Set(state.study.sessions.map((s) => s.date));
  let streak = 0;
  for (let i = 0; i < 60; i++) { if (sessionDays.has(dateNDaysAgo(i))) streak++; else break; }

  function addSubject() {
    if (!subjForm.name.trim()) return;
    setState((s) => ({ ...s, study: { ...s.study, subjects: [{ id: uid(), ...subjForm }, ...s.study.subjects] } }));
    setSubjForm({ name: "", goal: "", priority: "Média", deadline: "" });
    setAddingSubject(false);
  }
  function removeSubject(id) { setState((s) => ({ ...s, study: { ...s.study, subjects: s.study.subjects.filter((x) => x.id !== id) } })); }
  function finishSession(subject, duration) {
    setState((s) => ({ ...s, study: { ...s.study, sessions: [{ id: uid(), subjectId: subject.id, topic: subject._topic || "", duration, date: today }, ...s.study.sessions] }, xp: s.xp + duration }));
  }
  function logPerformance(subjectId, correct, wrong) {
    setState((s) => ({ ...s, study: { ...s.study, performance: [{ id: uid(), subjectId, correct, wrong, date: today }, ...s.study.performance] } }));
    setPerfForm(null);
  }
  function planWithAI(subject) {
    const topics = ["Fundamentos", "Prática guiada", "Exercícios", "Simulado", "Revisão"];
    const tasks = topics.map((topic, i) => ({
      id: uid(), title: `${subject.name}: ${topic}`, duration: 50, category: "Estudos",
      scheduledFor: dateNDaysAgo(-((i + 1) * 2)), done: false, priority: i + 1,
    }));
    setState((s) => ({ ...s, tasks: [...tasks, ...s.tasks] }));
  }

  const accuracy = (subjectId) => {
    const rows = state.study.performance.filter((p) => p.subjectId === subjectId);
    if (!rows.length) return null;
    const c = rows.reduce((a, b) => a + b.correct, 0), w = rows.reduce((a, b) => a + b.wrong, 0);
    return Math.round((c / (c + w || 1)) * 100);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold los-text">Estudos</h1><p className="los-dim text-sm mt-0.5">Seu plano de aprendizado, organizado.</p></div>
        {!addingSubject && <button onClick={() => setAddingSubject(true)} className="los-accent-bg text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 hover:opacity-90 los-transition"><Plus size={15} /> Matéria</button>}
      </div>

      <div className="flex gap-2 flex-wrap">
        <StatChip label="Hoje" value={`${hoursToday}h`} />
        <StatChip label="Semana" value={`${hoursWeek}h`} />
        <StatChip label="Mês" value={`${hoursMonth}h`} />
        <StatChip label="Sequência" value={streak} />
      </div>

      {addingSubject && (
        <div className="los-elev rounded-xl p-4 space-y-2.5">
          <input autoFocus className="los-input w-full rounded-lg px-3 py-2 text-sm" placeholder="Nome da matéria" value={subjForm.name} onChange={(e) => setSubjForm({ ...subjForm, name: e.target.value })} />
          <input className="los-input w-full rounded-lg px-3 py-2 text-sm" placeholder="Objetivo (ex: ENEM, concurso...)" value={subjForm.goal} onChange={(e) => setSubjForm({ ...subjForm, goal: e.target.value })} />
          <div className="flex gap-2">
            {["Baixa", "Média", "Alta"].map((p) => (<button key={p} onClick={() => setSubjForm({ ...subjForm, priority: p })} className={`text-xs px-3 py-1.5 rounded-lg los-transition ${subjForm.priority === p ? "los-accent-bg" : "los-elev-2 los-dim"}`}>{p} prioridade</button>))}
            <input type="date" className="los-input rounded-lg px-3 py-1.5 text-xs ml-auto" value={subjForm.deadline} onChange={(e) => setSubjForm({ ...subjForm, deadline: e.target.value })} />
          </div>
          <div className="flex gap-2"><button disabled={!subjForm.name.trim()} onClick={addSubject} className="los-accent-bg text-sm px-4 py-2 rounded-lg disabled:opacity-30">Adicionar</button><button onClick={() => setAddingSubject(false)} className="los-dim text-sm px-4 py-2 rounded-lg los-btn-ghost">Cancelar</button></div>
        </div>
      )}

      {state.study.subjects.length === 0 && !addingSubject ? (
        <div className="los-elev rounded-xl"><EmptyState icon={GraduationCap} title="Nenhuma matéria cadastrada" sub="Diga ao Mentor IA seu objetivo (ex: 'quero passar no ENEM') e ele monta o plano, ou adicione manualmente." cta="Adicionar matéria" onCta={() => setAddingSubject(true)} /></div>
      ) : (
        <div className="space-y-2">
          {state.study.subjects.map((subj) => {
            const acc = accuracy(subj.id);
            const subjMinutes = state.study.sessions.filter((s) => s.subjectId === subj.id).reduce((a, b) => a + b.duration, 0);
            return (
              <div key={subj.id} className="los-elev rounded-xl overflow-hidden">
                <button onClick={() => setExpanded(expanded === subj.id ? null : subj.id)} className="w-full text-left px-4 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm los-text font-medium">{subj.name}</p>
                    <p className="text-xs los-dim mt-0.5">{subj.priority} prioridade{subj.goal ? ` · ${subj.goal}` : ""}{subj.deadline ? ` · prova ${subj.deadline}` : ""}</p>
                  </div>
                  {acc !== null && <span className={`text-xs los-num ${acc >= 70 ? "los-accent" : "los-amber"}`}>{acc}%</span>}
                  <ChevronRight size={15} className={`los-faint los-transition shrink-0 ${expanded === subj.id ? "rotate-90" : ""}`} />
                </button>
                {expanded === subj.id && (
                  <div className="px-4 pb-4 border-t los-border pt-3 space-y-3">
                    <p className="text-xs los-dim">{Math.round(subjMinutes / 60 * 10) / 10}h estudadas no total</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => startFocus({ id: subj.id, title: subj.name, kindLabel: "Estudo", duration: 50 }, "study", subj)} className="text-xs los-elev-2 los-text px-3 py-2 rounded-lg los-btn-ghost los-transition">Iniciar sessão</button>
                      <button onClick={() => planWithAI(subj)} className="text-xs los-accent-bg px-3 py-2 rounded-lg los-transition hover:opacity-90 flex items-center gap-1"><Sparkles size={12} /> Montar plano com IA</button>
                      <button onClick={() => setPerfForm(subj.id)} className="text-xs los-elev-2 los-text px-3 py-2 rounded-lg los-btn-ghost los-transition">Registrar desempenho</button>
                      <button onClick={() => removeSubject(subj.id)} className="text-xs los-faint hover:text-red-400 px-3 py-2 los-transition">Remover</button>
                    </div>
                    {perfForm === subj.id && <PerfMiniForm onSave={(c, w) => logPerformance(subj.id, c, w)} onCancel={() => setPerfForm(null)} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PerfMiniForm({ onSave, onCancel }) {
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  return (
    <div className="los-elev-2 rounded-lg p-3 flex flex-wrap items-end gap-2">
      <div><label className="text-[10px] los-dim block mb-1">Acertos</label><input type="number" min={0} className="los-input w-16 rounded px-2 py-1 text-sm" value={correct} onChange={(e) => setCorrect(+e.target.value)} /></div>
      <div><label className="text-[10px] los-dim block mb-1">Erros</label><input type="number" min={0} className="los-input w-16 rounded px-2 py-1 text-sm" value={wrong} onChange={(e) => setWrong(+e.target.value)} /></div>
      <button onClick={() => onSave(correct, wrong)} className="los-accent-bg text-xs px-3 py-1.5 rounded-lg">Salvar</button>
      <button onClick={onCancel} className="los-dim text-xs px-3 py-1.5 rounded-lg los-btn-ghost">Cancelar</button>
    </div>
  );
}

/* ============================================================
   FITNESS
   ============================================================ */
function FitnessView({ state, setState, startFocus }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", muscle: "", exercises: [{ name: "", sets: 4, reps: 10, load: "" }] });
  const today = todayISO();
  const week = isoRange(7), month = isoRange(30);

  const workoutsWeek = state.fitness.logs.filter((l) => week.includes(l.date)).length;
  const workoutsMonth = state.fitness.logs.filter((l) => month.includes(l.date)).length;
  const logDays = new Set(state.fitness.logs.map((l) => l.date));
  let streak = 0;
  for (let i = 0; i < 60; i++) { if (logDays.has(dateNDaysAgo(i))) streak++; else break; }

  function addExerciseRow() { setForm((f) => ({ ...f, exercises: [...f.exercises, { name: "", sets: 4, reps: 10, load: "" }] })); }
  function updateExercise(i, field, val) { setForm((f) => ({ ...f, exercises: f.exercises.map((e, idx) => idx === i ? { ...e, [field]: val } : e) })); }
  function saveWorkout() {
    if (!form.name.trim()) return;
    setState((s) => ({ ...s, fitness: { ...s.fitness, workouts: [{ id: uid(), ...form }, ...s.fitness.workouts] } }));
    setForm({ name: "", muscle: "", exercises: [{ name: "", sets: 4, reps: 10, load: "" }] });
    setCreating(false);
  }
  function removeWorkout(id) { setState((s) => ({ ...s, fitness: { ...s.fitness, workouts: s.fitness.workouts.filter((w) => w.id !== id), schedule: Object.fromEntries(Object.entries(s.fitness.schedule).filter(([, v]) => v !== id)) } })); }
  function setScheduleDay(day, workoutId) { setState((s) => ({ ...s, fitness: { ...s.fitness, schedule: { ...s.fitness.schedule, [day]: workoutId || undefined } } })); }
  function finishWorkout(workout, duration) { setState((s) => ({ ...s, fitness: { ...s.fitness, logs: [{ id: uid(), workoutId: workout.id, date: today, duration }, ...s.fitness.logs] }, xp: s.xp + duration })); }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold los-text">Fitness</h1><p className="los-dim text-sm mt-0.5">Consistência constrói corpo e disciplina.</p></div>
        {!creating && <button onClick={() => setCreating(true)} className="los-accent-bg text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 hover:opacity-90 los-transition"><Plus size={15} /> Treino</button>}
      </div>

      <div className="flex gap-2 flex-wrap">
        <StatChip label="Esta semana" value={workoutsWeek} />
        <StatChip label="Este mês" value={workoutsMonth} />
        <StatChip label="Sequência" value={streak} />
      </div>

      <div>
        <SectionTitle>Programação semanal</SectionTitle>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_SHORT.map((d, i) => {
            const wid = state.fitness.schedule?.[i];
            const w = state.fitness.workouts.find((x) => x.id === wid);
            return (
              <div key={i} className="los-elev rounded-lg p-2 text-center">
                <p className="text-[10px] los-faint mb-1">{d}</p>
                <select value={wid || ""} onChange={(e) => setScheduleDay(i, e.target.value)} className="los-input w-full text-[10px] rounded px-1 py-1">
                  <option value="">—</option>
                  {state.fitness.workouts.map((w) => (<option key={w.id} value={w.id}>{w.name.slice(0, 8)}</option>))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {creating && (
        <div className="los-elev rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <input autoFocus className="los-input flex-1 rounded-lg px-3 py-2 text-sm" placeholder="Nome do treino (ex: Treino A)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="los-input flex-1 rounded-lg px-3 py-2 text-sm" placeholder="Grupo muscular" value={form.muscle} onChange={(e) => setForm({ ...form, muscle: e.target.value })} />
          </div>
          <div className="space-y-2">
            {form.exercises.map((ex, i) => (
              <div key={i} className="flex gap-2">
                <input className="los-input flex-1 rounded-lg px-2 py-1.5 text-xs" placeholder="Exercício" value={ex.name} onChange={(e) => updateExercise(i, "name", e.target.value)} />
                <input type="number" className="los-input w-14 rounded-lg px-2 py-1.5 text-xs" placeholder="séries" value={ex.sets} onChange={(e) => updateExercise(i, "sets", +e.target.value)} />
                <input type="number" className="los-input w-14 rounded-lg px-2 py-1.5 text-xs" placeholder="reps" value={ex.reps} onChange={(e) => updateExercise(i, "reps", +e.target.value)} />
                <input className="los-input w-16 rounded-lg px-2 py-1.5 text-xs" placeholder="carga" value={ex.load} onChange={(e) => updateExercise(i, "load", e.target.value)} />
              </div>
            ))}
            <button onClick={addExerciseRow} className="text-xs los-accent flex items-center gap-1"><Plus size={12} /> Adicionar exercício</button>
          </div>
          <div className="flex gap-2"><button onClick={saveWorkout} className="los-accent-bg text-sm px-4 py-2 rounded-lg">Salvar treino</button><button onClick={() => setCreating(false)} className="los-dim text-sm px-4 py-2 rounded-lg los-btn-ghost">Cancelar</button></div>
        </div>
      )}

      {state.fitness.workouts.length === 0 && !creating ? (
        <div className="los-elev rounded-xl"><EmptyState icon={Dumbbell} title="Nenhum treino cadastrado" sub="Crie seus treinos e programe os dias da semana." cta="Criar treino" onCta={() => setCreating(true)} /></div>
      ) : (
        <div className="space-y-2">
          {state.fitness.workouts.map((w) => (
            <div key={w.id} className="los-elev rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div><p className="text-sm los-text font-medium">{w.name}</p><p className="text-xs los-dim">{w.muscle}</p></div>
                <div className="flex gap-2">
                  <button onClick={() => startFocus({ id: w.id, title: w.name, kindLabel: "Treino", duration: 50 }, "workout", w)} className="text-xs los-elev-2 px-3 py-1.5 rounded-lg los-btn-ghost los-transition">Começar treino</button>
                  <button onClick={() => removeWorkout(w.id)} className="los-faint hover:text-red-400 los-transition"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="space-y-1">
                {w.exercises.filter((e) => e.name).map((e, i) => (<p key={i} className="text-xs los-dim">{e.name} — {e.sets}x{e.reps}{e.load ? ` · ${e.load}` : ""}</p>))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   NUTRIÇÃO
   ============================================================ */
function NutritionView({ state, setState }) {
  const today = todayISO();
  const [mealName, setMealName] = useState("Café da manhã");
  const [itemsText, setItemsText] = useState("");
  const todaysMeals = state.nutrition.meals.filter((m) => m.date === today);
  const kcalToday = todaysMeals.reduce((a, b) => a + b.kcal, 0);
  const t = state.nutrition.targets;
  const waterToday = state.nutrition.water[today] || 0;

  function addMeal() {
    const items = itemsText.split(",").map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const kcal = estimateKcal(items);
    setState((s) => ({ ...s, nutrition: { ...s.nutrition, meals: [{ id: uid(), date: today, name: mealName, items, kcal }, ...s.nutrition.meals] }, xp: s.xp + 5 }));
    setItemsText("");
  }
  function removeMeal(id) { setState((s) => ({ ...s, nutrition: { ...s.nutrition, meals: s.nutrition.meals.filter((m) => m.id !== id) } })); }
  function addWater(ml) { setState((s) => ({ ...s, nutrition: { ...s.nutrition, water: { ...s.nutrition.water, [today]: (s.nutrition.water[today] || 0) + ml } } })); }
  function updateTarget(field, val) { setState((s) => ({ ...s, nutrition: { ...s.nutrition, targets: { ...s.nutrition.targets, [field]: val } } })); }

  const waterGoal = state.profile.waterGoal || t.water;
  const waterMissing = Math.max(0, waterGoal - waterToday);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div><h1 className="text-xl font-semibold los-text">Nutrição</h1><p className="los-dim text-sm mt-0.5">Estimativas simples para te ajudar a manter o padrão — não substituem acompanhamento nutricional.</p></div>

      <div className="grid grid-cols-2 gap-3">
        {[["Calorias", kcalToday, t.calories, "kcal"], ["Proteína", todaysMeals.length ? Math.round(kcalToday * 0.001) : 0, t.protein, "g (estimado)"]].map(([label, val, target]) => (
          <div key={label} className="los-elev rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2"><span className="text-xs los-dim">{label}</span><span className="text-xs los-num los-text">{val} / {target}</span></div>
            <Bar value={(val / target) * 100} />
          </div>
        ))}
      </div>

      <div className="los-elev rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5"><Droplet size={14} className="los-accent" /><span className="text-sm los-text font-medium">Água</span></div>
          <span className="text-xs los-num los-text">{(waterToday / 1000).toFixed(2)}L / {(waterGoal / 1000).toFixed(2)}L</span>
        </div>
        <Bar value={(waterToday / waterGoal) * 100} className="mb-2" />
        <p className="text-xs los-dim mb-3">{waterMissing > 0 ? `Você está a ${waterMissing}ml da sua meta.` : "Meta de hoje atingida."}</p>
        <div className="flex gap-2"><button onClick={() => addWater(250)} className="text-xs los-elev-2 px-3 py-1.5 rounded-lg los-btn-ghost los-transition">+250ml</button><button onClick={() => addWater(500)} className="text-xs los-elev-2 px-3 py-1.5 rounded-lg los-btn-ghost los-transition">+500ml</button></div>
      </div>

      <div className="los-elev rounded-xl p-4 space-y-2.5">
        <p className="text-sm los-text font-medium">Registrar refeição</p>
        <div className="flex flex-wrap gap-2">{["Café da manhã", "Almoço", "Lanche", "Jantar"].map((m) => (<button key={m} onClick={() => setMealName(m)} className={`text-xs px-3 py-1.5 rounded-lg los-transition ${mealName === m ? "los-accent-bg" : "los-elev-2 los-dim"}`}>{m}</button>))}</div>
        <input className="los-input w-full rounded-lg px-3 py-2 text-sm" placeholder="Itens separados por vírgula (ex: arroz, feijão, frango, salada)" value={itemsText} onChange={(e) => setItemsText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMeal()} />
        <button disabled={!itemsText.trim()} onClick={addMeal} className="los-accent-bg text-sm px-4 py-2 rounded-lg disabled:opacity-30">Adicionar</button>
        <p className="text-[11px] los-faint">As calorias são estimativas automáticas e podem conter erros.</p>
      </div>

      {todaysMeals.length > 0 && (
        <div className="space-y-2">
          {todaysMeals.map((m) => (
            <div key={m.id} className="los-elev rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0"><p className="text-sm los-text font-medium">{m.name}</p><p className="text-xs los-dim">{m.items.join(", ")}</p></div>
              <span className="text-xs los-num los-dim">{m.kcal} kcal</span>
              <button onClick={() => removeMeal(m.id)} className="los-faint hover:text-red-400 los-transition"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   FINANÇAS
   ============================================================ */
function FinanceView({ state, setState }) {
  const [txForm, setTxForm] = useState({ type: "expense", amount: "", category: "Alimentação", desc: "" });
  const [goalForm, setGoalForm] = useState(null);
  const thisMonth = todayISO().slice(0, 7);
  const monthTx = state.finance.transactions.filter((t) => t.date.slice(0, 7) === thisMonth);
  const income = monthTx.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
  const saldo = income - expense;

  function addTx() {
    const amount = parseFloat(txForm.amount);
    if (!amount) return;
    setState((s) => ({ ...s, finance: { ...s.finance, transactions: [{ id: uid(), ...txForm, amount, date: todayISO() }, ...s.finance.transactions] } }));
    setTxForm({ ...txForm, amount: "", desc: "" });
  }
  function removeTx(id) { setState((s) => ({ ...s, finance: { ...s.finance, transactions: s.finance.transactions.filter((t) => t.id !== id) } })); }
  function addGoal(f) { setState((s) => ({ ...s, finance: { ...s.finance, goals: [{ id: uid(), title: f.title, target: +f.target, saved: 0, deadline: f.deadline }, ...s.finance.goals] } })); setGoalForm(null); }
  function addSaving(id, amount) { setState((s) => ({ ...s, finance: { ...s.finance, goals: s.finance.goals.map((g) => g.id === id ? { ...g, saved: g.saved + amount } : g) } })); }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold los-text">Finanças</h1>

      <div className="grid grid-cols-3 gap-2">
        <StatChip label="Receita (mês)" value={fmtMoney(income)} />
        <StatChip label="Despesas (mês)" value={fmtMoney(expense)} />
        <StatChip label="Saldo" value={fmtMoney(saldo)} />
      </div>

      <div className="los-elev rounded-xl p-4 space-y-2.5">
        <div className="flex gap-2">
          <button onClick={() => setTxForm({ ...txForm, type: "income" })} className={`flex-1 text-xs py-2 rounded-lg los-transition ${txForm.type === "income" ? "los-accent-bg" : "los-elev-2 los-dim"}`}>Receita</button>
          <button onClick={() => setTxForm({ ...txForm, type: "expense" })} className={`flex-1 text-xs py-2 rounded-lg los-transition ${txForm.type === "expense" ? "los-accent-bg" : "los-elev-2 los-dim"}`}>Despesa</button>
        </div>
        <div className="flex gap-2">
          <input type="number" className="los-input w-28 rounded-lg px-3 py-2 text-sm" placeholder="R$" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} />
          <select className="los-input flex-1 rounded-lg px-3 py-2 text-sm" value={txForm.category} onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}>{FIN_CATEGORIES.map((c) => (<option key={c}>{c}</option>))}</select>
        </div>
        <input className="los-input w-full rounded-lg px-3 py-2 text-sm" placeholder="Descrição (opcional)" value={txForm.desc} onChange={(e) => setTxForm({ ...txForm, desc: e.target.value })} />
        <button disabled={!txForm.amount} onClick={addTx} className="los-accent-bg text-sm px-4 py-2 rounded-lg disabled:opacity-30">Adicionar</button>
      </div>

      {monthTx.length > 0 && (
        <div className="space-y-1.5">
          {monthTx.slice(0, 8).map((t) => (
            <div key={t.id} className="los-elev rounded-lg px-4 py-2.5 flex items-center gap-3">
              <span className={`text-xs los-num w-20 ${t.type === "income" ? "los-accent" : "los-red"}`}>{t.type === "income" ? "+" : "-"}{fmtMoney(t.amount)}</span>
              <span className="text-sm los-text flex-1 min-w-0 truncate">{t.desc || t.category}</span>
              <span className="text-xs los-faint">{t.category}</span>
              <button onClick={() => removeTx(t.id)} className="los-faint hover:text-red-400 los-transition"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <SectionTitle>Metas financeiras</SectionTitle>
        {!goalForm && <button onClick={() => setGoalForm({ title: "", target: "", deadline: "" })} className="text-xs los-accent flex items-center gap-1"><Plus size={12} /> Nova</button>}
      </div>
      {goalForm && (
        <div className="los-elev rounded-xl p-4 space-y-2">
          <input autoFocus className="los-input w-full rounded-lg px-3 py-2 text-sm" placeholder="Ex: Juntar R$10.000" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} />
          <div className="flex gap-2"><input type="number" className="los-input flex-1 rounded-lg px-3 py-2 text-sm" placeholder="Valor alvo" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} /><input type="date" className="los-input rounded-lg px-3 py-2 text-sm" value={goalForm.deadline} onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })} /></div>
          <div className="flex gap-2"><button disabled={!goalForm.title || !goalForm.target} onClick={() => addGoal(goalForm)} className="los-accent-bg text-sm px-4 py-2 rounded-lg disabled:opacity-30">Criar</button><button onClick={() => setGoalForm(null)} className="los-dim text-sm px-4 py-2 rounded-lg los-btn-ghost">Cancelar</button></div>
        </div>
      )}
      {state.finance.goals.length === 0 && !goalForm ? (
        <div className="los-elev rounded-xl"><EmptyState icon={Wallet} title="Nenhuma meta financeira" sub="Defina quanto quer juntar e acompanhe o progresso." /></div>
      ) : (
        <div className="space-y-2">
          {state.finance.goals.map((g) => {
            const pct = Math.round((g.saved / g.target) * 100);
            const months = g.deadline ? Math.max(1, Math.ceil((new Date(g.deadline) - new Date()) / (30 * 86400000))) : null;
            const perMonth = months ? Math.max(0, (g.target - g.saved) / months) : null;
            return (
              <div key={g.id} className="los-elev rounded-xl p-4">
                <div className="flex items-center justify-between mb-1"><span className="text-sm los-text font-medium">{g.title}</span><span className="text-xs los-num los-accent">{pct}%</span></div>
                <Bar value={pct} className="mb-2" />
                <p className="text-xs los-dim">{fmtMoney(g.saved)} / {fmtMoney(g.target)}{perMonth ? ` · guarde ${fmtMoney(perMonth)}/mês para chegar no prazo` : ""}</p>
                <div className="flex gap-2 mt-2"><button onClick={() => addSaving(g.id, 100)} className="text-xs los-elev-2 px-2.5 py-1 rounded-lg los-btn-ghost">+R$100</button><button onClick={() => addSaving(g.id, 500)} className="text-xs los-elev-2 px-2.5 py-1 rounded-lg los-btn-ghost">+R$500</button></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   EVOLUÇÃO
   ============================================================ */
function EvolutionView({ state, setState }) {
  const [range, setRange] = useState(30);
  const score = useMemo(() => computeLifeScore(state), [state]);
  const series = useMemo(() => computeSeries(state, range), [state, range]);
  const week = isoRange(7);
  const habitsPct = state.habits.length ? Math.round((state.habits.reduce((s, h) => s + week.filter((d) => h.logs[d]).length, 0) / (state.habits.length * 7)) * 100) : null;
  const tasksWeek = state.tasks.filter((t) => week.includes(t.scheduledFor));
  const tasksPct = tasksWeek.length ? Math.round((tasksWeek.filter((t) => t.done).length / tasksWeek.length) * 100) : null;
  const worked = [];
  const toChange = [];
  if (habitsPct !== null) (habitsPct >= 70 ? worked : toChange).push(`Hábitos: ${habitsPct}% de consistência nos últimos 7 dias.`);
  if (tasksPct !== null) (tasksPct >= 70 ? worked : toChange).push(`Tarefas: ${tasksPct}% concluídas nos últimos 7 dias.`);
  state.goals.filter((g) => { const d = Math.floor((Date.now() - new Date(g.updatedAt).getTime()) / 86400000); return d >= 7; }).forEach((g) => toChange.push(`Meta "${g.title}" está parada.`));
  if (!worked.length && !toChange.length) { worked.push("Ainda não há dados suficientes para uma leitura completa da semana."); }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold los-text">Evolução</h1>

      <div className="los-elev rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-3"><span className="text-xs los-dim uppercase tracking-wide">Life Score</span><span className="los-num text-3xl font-semibold los-text">{score.total}<span className="text-sm los-faint">/100</span></span></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
          {Object.entries(score.domains).map(([k, v]) => (
            <div key={k}><div className="flex items-center justify-between mb-1"><span className="text-xs los-dim">{k}</span><span className="text-xs los-num los-text">{v}</span></div><Bar value={v} /></div>
          ))}
        </div>
      </div>

      <div className="los-elev rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium los-text">Consistência ao longo do tempo</span>
          <div className="flex gap-1">{[7, 30, 90, 365].map((r) => (<button key={r} onClick={() => setRange(r)} className={`text-xs px-2.5 py-1 rounded-lg los-transition ${range === r ? "los-accent-bg" : "los-elev-2 los-dim"}`}>{r}d</button>))}</div>
        </div>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--text-faint)" fontSize={10} interval={Math.ceil(series.length / 8)} />
              <YAxis stroke="var(--text-faint)" fontSize={10} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke={CONFIG.ACCENT} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="los-elev rounded-xl p-5">
        <p className="text-sm font-medium los-text mb-3">Sua semana</p>
        {worked.length > 0 && (<div className="mb-3"><p className="text-xs los-dim mb-1.5">O que funcionou</p>{worked.map((w, i) => (<p key={i} className="text-sm los-text mb-1">✓ {w}</p>))}</div>)}
        {toChange.length > 0 && (<div><p className="text-xs los-dim mb-1.5">O que precisa mudar</p>{toChange.map((w, i) => (<p key={i} className="text-sm los-amber mb-1">→ {w}</p>))}</div>)}
      </div>
    </div>
  );
}

/* ============================================================
   MENTOR IA
   ============================================================ */
function buildContext(state) {
  const today = todayISO();
  return {
    nome: state.profile.name,
    foco_declarado: state.profile.focus,
    visao_1_ano: state.profile.vision,
    metas: state.goals.map((g) => ({ titulo: g.title, horizonte: g.horizon, progresso: g.progress, categoria: g.category, atualizada_ha_dias: Math.floor((Date.now() - new Date(g.updatedAt).getTime()) / 86400000) })),
    habitos: state.habits.map((h) => ({ nome: h.name, sequencia_atual: h.streak, melhor_sequencia: h.bestStreak, feito_hoje: !!h.logs[today] })),
    tarefas_hoje: state.tasks.filter((t) => t.scheduledFor === today).map((t) => ({ titulo: t.title, feita: t.done, duracao_min: t.duration })),
    materias: state.study.subjects.map((s) => ({ nome: s.name, prioridade: s.priority, prazo: s.deadline })),
    treinos: state.fitness.workouts.map((w) => w.name),
    agua_hoje_ml: state.nutrition.water[today] || 0,
    financas_resumo: { transacoes_mes: state.finance.transactions.length, metas: state.finance.goals.map((g) => ({ titulo: g.title, saved: g.saved, target: g.target })) },
    entradas_diario_recentes: state.journal.slice(0, 5).map((j) => ({ data: j.date, humor: j.mood, texto: j.text })),
    life_score: computeLifeScore(state).total,
    xp: state.xp,
  };
}

const AI_SYSTEM_PROMPT = `Você é o Mentor IA dentro do ${CONFIG.APP_NAME}, um sistema pessoal de desenvolvimento e execução. Sua personalidade: inteligente, direta, estratégica, honesta e encorajadora — nunca infantil, nunca excessivamente motivacional, nunca humilhante. Você não faz diagnóstico médico nem prescrição nutricional — apenas estimativas e sugestões gerais.

Seu papel: analisar → planejar → acompanhar → corrigir → cobrar → adaptar. Você conhece o contexto do usuário (metas, hábitos, tarefas, estudos, treinos, água, finanças, diário) fornecido abaixo em JSON.

Ações disponíveis (execute quando o pedido do usuário implicar criar/alterar dados; NUNCA diga que fez algo sem incluir a action):
- create_habit { name }
- create_task { title, duration, category, scheduledFor (YYYY-MM-DD), time (HH:MM opcional) }
- create_goal { title, why, horizon (Hoje|Semana|Mês|Ano|Longo prazo), category }
- log_journal { text, mood (0-4) }
- create_study_subject { name, goal, priority (Baixa|Média|Alta), deadline }
- log_water { ml }
- log_meal { name (Café da manhã|Almoço|Lanche|Jantar), items: [string] }
- create_workout { name, muscle, exercises: [{name, sets, reps, load}] }
- add_transaction { type (income|expense), amount, category, desc }
- create_financial_goal { title, target, deadline }
- complete_task { titleMatch } — marca como concluída a primeira tarefa cujo título contenha titleMatch
- reschedule_task { titleMatch, scheduledFor, time }

Responda SEMPRE em JSON puro, sem markdown, sem crases, no formato exato:
{"reply": "sua resposta em português, curta e direta (2-5 frases)", "actions": [{"type": "create_habit", "payload": {...}}]}

Se nenhuma ação for necessária, "actions" deve ser um array vazio.`;

function MentorView({ state, setState }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state.chat, loading]);

  function applyActions(actions) {
    if (!actions || !actions.length) return;
    setState((s) => {
      let next = { ...s, study: { ...s.study }, fitness: { ...s.fitness }, nutrition: { ...s.nutrition }, finance: { ...s.finance } };
      actions.forEach((a) => {
        const p = a.payload || {};
        if (a.type === "create_habit" && p.name) next.habits = [{ id: uid(), name: p.name, streak: 0, bestStreak: 0, logs: {} }, ...next.habits];
        if (a.type === "create_task" && p.title) next.tasks = [{ id: uid(), title: p.title, duration: p.duration || 30, category: p.category || "Geral", scheduledFor: p.scheduledFor || todayISO(), time: p.time || "", done: false, priority: next.tasks.length + 1 }, ...next.tasks];
        if (a.type === "create_goal" && p.title) next.goals = [{ id: uid(), title: p.title, why: p.why || "", category: p.category || "Geral", horizon: p.horizon || "Ano", progress: 0, milestones: breakdownMilestones(p.title), createdAt: todayISO(), updatedAt: todayISO() }, ...next.goals];
        if (a.type === "log_journal" && p.text) next.journal = [{ id: uid(), date: todayISO(), mood: p.mood ?? 3, text: p.text }, ...next.journal];
        if (a.type === "create_study_subject" && p.name) next.study.subjects = [{ id: uid(), name: p.name, goal: p.goal || "", priority: p.priority || "Média", deadline: p.deadline || "" }, ...next.study.subjects];
        if (a.type === "log_water" && p.ml) { const today = todayISO(); next.nutrition.water = { ...next.nutrition.water, [today]: (next.nutrition.water[today] || 0) + p.ml }; }
        if (a.type === "log_meal" && p.items) next.nutrition.meals = [{ id: uid(), date: todayISO(), name: p.name || "Refeição", items: p.items, kcal: estimateKcal(p.items) }, ...next.nutrition.meals];
        if (a.type === "create_workout" && p.name) next.fitness.workouts = [{ id: uid(), name: p.name, muscle: p.muscle || "", exercises: p.exercises || [] }, ...next.fitness.workouts];
        if (a.type === "add_transaction" && p.amount) next.finance.transactions = [{ id: uid(), type: p.type || "expense", amount: +p.amount, category: p.category || "Outros", desc: p.desc || "", date: todayISO() }, ...next.finance.transactions];
        if (a.type === "create_financial_goal" && p.title) next.finance.goals = [{ id: uid(), title: p.title, target: +p.target, saved: 0, deadline: p.deadline || "" }, ...next.finance.goals];
        if (a.type === "complete_task" && p.titleMatch) { const t = next.tasks.find((t) => t.title.toLowerCase().includes(p.titleMatch.toLowerCase()) && !t.done); if (t) next.tasks = next.tasks.map((x) => x.id === t.id ? { ...x, done: true } : x); }
        if (a.type === "reschedule_task" && p.titleMatch) { const t = next.tasks.find((t) => t.title.toLowerCase().includes(p.titleMatch.toLowerCase())); if (t) next.tasks = next.tasks.map((x) => x.id === t.id ? { ...x, scheduledFor: p.scheduledFor || x.scheduledFor, time: p.time ?? x.time } : x); }
      });
      return next;
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput(""); setError("");
    const userMsg = { role: "user", text };
    setState((s) => ({ ...s, chat: [...s.chat, userMsg] }));
    setLoading(true);
    try {
      const context = buildContext(state);
      const history = [...state.chat, userMsg].slice(-10).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: AI_SYSTEM_PROMPT, context, messages: history }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Erro HTTP ${response.status}`);
      }
      const raw = (data.content || []).map((c) => c.text || "").join("").trim();
      const clean = raw.replace(/^```json/i, "").replace(/```$/, "").trim();
      let parsed;
      try { parsed = JSON.parse(clean); } catch { parsed = { reply: raw || "Não consegui processar isso agora.", actions: [] }; }
      setState((s) => ({ ...s, chat: [...s.chat, { role: "assistant", text: parsed.reply }] }));
      applyActions(parsed.actions);
    } catch (e) {
      console.error("Nexora Mentor error:", e);
      setError(e?.message || "Não consegui conectar ao mentor agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col h-[calc(100vh-2rem)]">
      <div className="mb-4"><h1 className="text-xl font-semibold los-text flex items-center gap-2"><Sparkles size={18} className="los-accent" /> Mentor IA</h1><p className="los-dim text-sm mt-0.5">Analisa seu progresso e pode agir por você — é só pedir.</p></div>
      <div className="flex-1 overflow-y-auto los-scroll space-y-3 pb-4">
        {state.chat.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "los-accent-bg" : "los-elev los-text"}`}>{m.text}</div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="los-elev rounded-xl px-4 py-2.5 flex items-center gap-2 los-dim text-sm"><Loader2 size={13} className="animate-spin" /> pensando...</div></div>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div ref={scrollRef} />
      </div>
      <div className="flex gap-2 pt-2 border-t los-border">
        <input className="los-input flex-1 rounded-lg px-3 py-2.5 text-sm" placeholder="Ex: quero passar no ENEM, monte meu plano de estudos" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button onClick={send} disabled={loading || !input.trim()} className="los-accent-bg rounded-lg w-10 h-10 flex items-center justify-center disabled:opacity-30 hover:opacity-90 los-transition shrink-0"><Send size={15} /></button>
      </div>
    </div>
  );
}

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */
function SettingsView({ state, setState }) {
  const r = state.settings.reminders;
  function toggleReminder(key) { setState((s) => ({ ...s, settings: { ...s.settings, reminders: { ...s.settings.reminders, [key]: !s.settings.reminders[key] } } })); }
  async function enableBrowserNotif() {
    try {
      const perm = await Notification.requestPermission();
      setState((s) => ({ ...s, settings: { ...s.settings, browserNotifications: perm === "granted" } }));
    } catch { setState((s) => ({ ...s, settings: { ...s.settings, browserNotifications: false } })); }
  }
  const reminderLabels = { study: "Estudos", water: "Água", workout: "Treino", habits: "Hábitos", tasks: "Tarefas", goals: "Metas", reviews: "Revisões", aiProactive: "IA proativa" };

  return (
    <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold los-text">Configurações</h1>

      <div className="los-elev rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium los-text">Perfil</p>
        <input className="los-input w-full rounded-lg px-3 py-2 text-sm" value={state.profile.name} onChange={(e) => setState((s) => ({ ...s, profile: { ...s.profile, name: e.target.value } }))} />
        <div className="flex gap-2">
          <div className="flex-1"><label className="text-xs los-dim block mb-1">Horário de estudo</label><input type="time" className="los-input w-full rounded-lg px-3 py-2 text-sm" value={state.profile.studyTime} onChange={(e) => setState((s) => ({ ...s, profile: { ...s.profile, studyTime: e.target.value } }))} /></div>
          <div className="flex-1"><label className="text-xs los-dim block mb-1">Horário de treino</label><input type="time" className="los-input w-full rounded-lg px-3 py-2 text-sm" value={state.profile.workoutTime} onChange={(e) => setState((s) => ({ ...s, profile: { ...s.profile, workoutTime: e.target.value } }))} /></div>
        </div>
        <div><label className="text-xs los-dim block mb-1">Meta de água (ml)</label><input type="number" step={250} className="los-input w-full rounded-lg px-3 py-2 text-sm" value={state.profile.waterGoal} onChange={(e) => setState((s) => ({ ...s, profile: { ...s.profile, waterGoal: +e.target.value } }))} /></div>
      </div>

      <div className="los-elev rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium los-text">Aparência</p>
        <div className="flex gap-2">
          {[{ id: "light", icon: Sun, label: "Claro" }, { id: "dark", icon: Moon, label: "Escuro" }].map((t) => (
            <button key={t.id} onClick={() => setState((s) => ({ ...s, theme: t.id }))} className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg los-transition ${state.theme === t.id ? "los-nav-active" : "los-elev-2 los-dim"}`}><t.icon size={16} /><span className="text-xs">{t.label}</span></button>
          ))}
        </div>
      </div>

      <div className="los-elev rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium los-text">Notificações</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(reminderLabels).map((key) => (
            <button key={key} onClick={() => toggleReminder(key)} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs los-transition ${r[key] ? "los-nav-active los-text" : "los-elev-2 los-dim"}`}>
              {reminderLabels[key]}
              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${r[key] ? "los-accent-bg border-transparent" : "los-border"}`}>{r[key] && <Check size={9} strokeWidth={4} />}</div>
            </button>
          ))}
        </div>
        <div className="pt-2 border-t los-border">
          <button onClick={enableBrowserNotif} className="text-xs los-accent flex items-center gap-1.5"><Bell size={12} /> {state.settings.browserNotifications ? "Notificações do navegador ativas" : "Ativar notificações do navegador"}</button>
        </div>
      </div>

      <div className="los-elev rounded-xl p-4">
        <p className="text-sm font-medium los-text mb-1">Sobre os dados</p>
        <p className="text-xs los-dim leading-relaxed">Seus dados ficam salvos localmente neste dispositivo. O Mentor IA usa uma rota segura no servidor para falar com a Anthropic; a chave da API nunca é enviada ao navegador. O Nexora é instalável como PWA e está preparado para notificações do sistema.</p>
      </div>

      <button onClick={() => { if (confirm("Isso vai apagar todos os seus dados neste app. Continuar?")) setState({ ...defaultState() }); }} className="flex items-center gap-1.5 text-xs los-faint hover:text-red-400 los-transition"><RotateCcw size={12} /> Reiniciar dados</button>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
const NAV_TITLES = { today: "Hoje", goals: "Metas", habits: "Hábitos", tasks: "Tarefas", journal: "Diário", study: "Estudos", fitness: "Fitness", nutrition: "Nutrição", finance: "Finanças", evolution: "Evolução", mentor: "Mentor IA", settings: "Configurações" };

export default function App() {
  const [state, setState, loaded] = useLifeOSState();
  const [view, setView] = useState("today");
  const [focusItem, setFocusItem] = useState(null);
  const [focusKind, setFocusKind] = useState(null);
  const [focusRef, setFocusRef] = useState(null);

  useNotificationEngine(state, setState);

  if (!loaded || !state) {
    return (<div className="min-h-screen flex items-center justify-center los-bg los-root" data-theme="dark"><style>{THEME_CSS}</style><Loader2 className="animate-spin los-dim" size={20} /></div>);
  }

  if (!state.onboarded) {
    return (
      <div className="los-root" data-theme={state.theme}><style>{THEME_CSS}</style>
        <Onboarding onDone={(data) => setState((s) => ({
          ...s, onboarded: true, profile: { ...s.profile, ...data },
          goals: [{ id: uid(), title: data.vision.slice(0, 60), why: "Definido no onboarding", category: data.focus, horizon: "Ano", progress: 0, milestones: breakdownMilestones(data.vision.slice(0, 60)), createdAt: todayISO(), updatedAt: todayISO() }],
          habits: [{ id: uid(), name: "Revisar prioridades do dia", streak: 0, bestStreak: 0, logs: {} }],
        }))} />
      </div>
    );
  }

  function startFocus(item, kind, ref) { setFocusItem(item); setFocusKind(kind); setFocusRef(ref); }
  function finishFocus(duration) {
    if (focusKind === "task") setState((s) => ({ ...s, tasks: s.tasks.map((t) => t.id === focusItem.id ? { ...t, done: true } : t), xp: s.xp + duration }));
    if (focusKind === "study") setState((s) => ({ ...s, study: { ...s.study, sessions: [{ id: uid(), subjectId: focusRef.id, topic: "", duration, date: todayISO() }, ...s.study.sessions] }, xp: s.xp + duration }));
    if (focusKind === "workout") setState((s) => ({ ...s, fitness: { ...s.fitness, logs: [{ id: uid(), workoutId: focusRef.id, date: todayISO(), duration }, ...s.fitness.logs] }, xp: s.xp + duration }));
    setFocusItem(null); setFocusKind(null); setFocusRef(null);
  }

  const views = {
    today: <TodayView state={state} setState={setState} setView={setView} startFocus={startFocus} />,
    goals: <GoalsView state={state} setState={setState} />,
    habits: <HabitsView state={state} setState={setState} />,
    tasks: <TasksView state={state} setState={setState} startFocus={startFocus} />,
    journal: <JournalView state={state} setState={setState} />,
    study: <StudyView state={state} setState={setState} startFocus={startFocus} />,
    fitness: <FitnessView state={state} setState={setState} startFocus={startFocus} />,
    nutrition: <NutritionView state={state} setState={setState} />,
    finance: <FinanceView state={state} setState={setState} />,
    evolution: <EvolutionView state={state} setState={setState} />,
    mentor: <MentorView state={state} setState={setState} />,
    settings: <SettingsView state={state} setState={setState} />,
  };

  return (
    <div className="los-root los-bg min-h-screen flex" data-theme={state.theme}>
      <style>{THEME_CSS}</style>
      <Sidebar view={view} setView={setView} xp={state.xp} />
      <div className="flex-1 overflow-y-auto los-scroll pb-16 md:pb-0">
        <TopBar title={NAV_TITLES[view]} state={state} setState={setState} setView={setView} />
        {views[view]}
      </div>
      <MobileNav view={view} setView={setView} />
      {focusItem && <FocusMode item={focusItem} onFinish={finishFocus} onAbandon={() => { setFocusItem(null); setFocusKind(null); setFocusRef(null); }} />}
    </div>
  );
}
