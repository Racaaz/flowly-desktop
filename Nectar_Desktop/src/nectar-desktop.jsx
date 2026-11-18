import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { api } from "./api.js";
import { formatIDR, formatCompact, formatDate, todayStr, toDateStr, daysAgo } from "./lib/format.js";
import { parseMoneyInput, parseCommandLine } from "./lib/parser.js";
import { getCycleRange } from "./lib/period.js";
import {
  Search, Plus, ArrowLeftRight, Wallet, LayoutDashboard, Receipt as ReceiptIcon,
  CreditCard, FileBarChart, Settings, X, Upload, TrendingUp, TrendingDown,
  Calendar, Target, Download, Trash2, PiggyBank,
  AlertCircle, CheckCircle2, Clock, Terminal, Banknote, Landmark, Smartphone, HandCoins, Image as ImageIcon,
  Sun, Moon
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar
} from "recharts";

/* ============================================================
   DESIGN TOKENS
   Base: slate-950/900 surfaces, emerald-500 accent (#10b981)
   Display/data: JetBrains-style mono for numbers & command syntax
   Body: system humanist sans for prose/labels
   ============================================================ */

/* ============================================================
   THEME PALETTES
   Rekomendasi Tema UI — navy gelap profesional untuk aplikasi
   keuangan, dengan aksen emerald untuk positif dan rose untuk
   negatif. Kontras disesuaikan per mode agar tetap aksesibel.
   Exposed as CSS custom properties on the app root so every
   component (including inline chart colors) reads from the
   same source of truth.
   ============================================================ */

const THEMES = {
  dark: {
    "--bg-app": "#0F172A",
    "--bg-panel": "#1E293B",
    "--bg-panel-hover": "#24344a",
    "--bg-input": "#223349",
    "--border": "#334155",
    "--border-strong": "#475569",
    "--text-primary": "#F8FAFC",
    "--text-secondary": "#94A3B8",
    "--text-muted": "#64748B",
    "--text-faint": "#475569",
    "--accent": "#10B981",
    "--accent-hover": "#34d399",
    "--accent-on": "#0F172A",
    "--accent-text": "#34d399",
    "--accent-soft-bg": "#0d2b22",
    "--overlay": "rgba(15,23,42,0.75)",
    "--positive": "#10B981",
    "--positive-soft-bg": "#0d2b22",
    "--negative": "#F43F5E",
    "--negative-soft-bg": "#3a1620",
    "--warning": "#f59e0b",
  },
  light: {
    "--bg-app": "#F8FAFC",
    "--bg-panel": "#FFFFFF",
    "--bg-panel-hover": "#F1F5F9",
    "--bg-input": "#F1F5F9",
    "--border": "#E2E8F0",
    "--border-strong": "#CBD5E1",
    "--text-primary": "#0F172A",
    "--text-secondary": "#64748B",
    "--text-muted": "#94A3B8",
    "--text-faint": "#CBD5E1",
    "--accent": "#059669",
    "--accent-hover": "#047857",
    "--accent-on": "#FFFFFF",
    "--accent-text": "#059669",
    "--accent-soft-bg": "#ECFDF5",
    "--overlay": "rgba(15,23,42,0.45)",
    "--positive": "#059669",
    "--positive-soft-bg": "#ECFDF5",
    "--negative": "#E11D48",
    "--negative-soft-bg": "#FFF1F2",
    "--warning": "#D97706",
  },
};

/* ============================================================
   MOCK DATA
   ============================================================ */

const ACCOUNT_ICONS = { cash: Banknote, bank: Landmark, ewallet: Smartphone, debt: HandCoins };

/* ============================================================
   REUSABLE UI ATOMS
   ============================================================ */

function MonoAmount({ value, className = "", sign = false, colorByType = null }) {
  let color = "";
  if (colorByType === "income") color = "text-[var(--accent-text)]";
  else if (colorByType === "expense") color = "text-[var(--negative)]";
  const prefix = sign ? (value >= 0 ? "+" : "") : "";
  return (
    <span className={`font-mono tabular-nums ${color} ${className}`}>
      {prefix}
      {formatIDR(value)}
    </span>
  );
}

function IconBadge({ Icon, color, size = 34 }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg shrink-0"
      style={{ width: size, height: size, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </div>
  );
}

function NavItem({ Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
        active
          ? "bg-[var(--accent-soft-bg)] text-[var(--accent-text)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)]"
      }`}
    >
      <Icon size={17} strokeWidth={2} className={active ? "text-[var(--accent-text)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"} />
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-secondary)]">{badge}</span>
      ) : null}
    </button>
  );
}

/* ============================================================
   SIDEBAR
   ============================================================ */

function Sidebar({ accounts, activeTab, setActiveTab, totalBalance, onOpenCommand, theme, onToggleTheme }) {
  const nav = [
    { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { key: "transactions", label: "Transaksi", Icon: ReceiptIcon },
    { key: "accounts", label: "Akun", Icon: Wallet },
    { key: "debts", label: "Utang & Cicilan", Icon: CreditCard },
    { key: "budget", label: "Anggaran", Icon: Target },
    { key: "reports", label: "Laporan", Icon: FileBarChart },
  ];

  return (
    <aside className="w-64 shrink-0 h-full bg-[var(--bg-app)] border-r border-[var(--border)] flex flex-col">
      <div className="px-4 pt-5 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center font-mono font-bold text-[var(--accent-on)] text-sm">
            R
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--text-primary)] leading-none">Flowly</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Save More, Track Better</div>
          </div>
          <button
            onClick={onToggleTheme}
            title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-panel-hover)] transition-colors shrink-0"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      <button
        onClick={onOpenCommand}
        className="mx-4 mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] text-xs hover:border-[var(--accent)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Catat transaksi...</span>
        <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-strong)] text-[var(--text-secondary)]">
          ⌘K
        </kbd>
      </button>
      <div className="mx-4 mt-1.5 flex items-center gap-1.5 px-1 text-[10px] text-[var(--text-faint)]">
        <TrendingUp size={11} className="text-[var(--accent-text)]" />
        <span className="flex-1">Pemasukan cepat</span>
        <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-muted)]">⌘M</kbd>
      </div>

      <nav className="flex-1 px-3 mt-5 space-y-0.5 overflow-y-auto">
        {nav.map((n) => (
          <NavItem key={n.key} Icon={n.Icon} label={n.label} active={activeTab === n.key} onClick={() => setActiveTab(n.key)} />
        ))}
        <div className="pt-3 mt-3 border-t border-[var(--border)]">
          <NavItem Icon={Settings} label="Pengaturan" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
        </div>
      </nav>

      <div className="px-4 py-4 border-t border-[var(--border)]">
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2 flex items-center justify-between">
          <span>Rekening</span>
          <span className="font-mono">{accounts.length}</span>
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {accounts.map((a) => {
            const Icon = ACCOUNT_ICONS[a.type] || Wallet;
            return (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                <Icon size={12} className="text-[var(--text-muted)] shrink-0" />
                <span className="text-[var(--text-secondary)] flex-1 truncate">{a.name}</span>
                <span className="font-mono text-[var(--text-secondary)] tabular-nums">{formatCompact(a.balance)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Total Saldo</span>
          <MonoAmount value={totalBalance} className="text-sm font-semibold text-[var(--text-primary)]" />
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   COMMAND PALETTE (Power Bar)
   ============================================================ */

function CommandPalette({ open, onClose, categories, accounts, defaultAccountId, onCommit }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const parsed = value.trim() ? parseCommandLine(value, categories, accounts, defaultAccountId) : [];
  const validCount = parsed.filter((p) => !p.error).length;

  function handleSubmit() {
    const good = parsed.filter((p) => !p.error);
    if (good.length === 0) return;
    onCommit(good);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4 bg-[var(--overlay)] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <Terminal size={16} className="text-[var(--accent-text)] shrink-0" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="J 50k Donuts  atau  BCA 100k Bensin; BCA +5jt Gaji"
            className="flex-1 bg-transparent outline-none font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-strong)] text-[var(--text-muted)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {parsed.length === 0 ? (
            <div className="px-4 py-6 text-xs text-[var(--text-muted)] space-y-2">
              <div className="text-[var(--text-secondary)]">Sintaks cepat:</div>
              <div className="font-mono text-[11px] text-[var(--text-muted)]">
                &lt;kode&gt; &lt;nominal&gt; &lt;catatan&gt;
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {categories.slice(0, 7).map((c) => (
                  <span key={c.id} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-secondary)]">
                    {c.shortcode}={c.name}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map((a) => (
                  <span key={a.id} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-muted)]">
                    {a.shortcode}
                  </span>
                ))}
              </div>
              <div className="text-[var(--text-faint)] pt-1">Pisahkan beberapa transaksi dengan tanda ; lalu tekan Enter.</div>
              <div className="text-[var(--text-faint)]">Nominal: 50k, 50rb, 1,5jt, 50.000. Pemasukan ke akun: <span className="font-mono">BCA +5jt Gaji</span></div>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {parsed.map((p, i) => (
                <li key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  {p.error ? (
                    <>
                      <AlertCircle size={15} className="text-[var(--warning)] shrink-0" />
                      <span className="font-mono text-xs text-[var(--text-muted)] flex-1 truncate">{p.raw}</span>
                      <span className="text-[11px] text-[var(--warning)]">{p.error}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} className="text-[var(--accent-text)] shrink-0" />
                      <span className="text-[var(--text-primary)] flex-1 truncate">{p.note}</span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">{accounts.find((a) => a.id === p.accountId)?.shortcode}</span>
                      <MonoAmount value={p.type === "income" ? p.amount : -p.amount} sign colorByType={p.type} className="text-xs" />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>{validCount > 0 ? `${validCount} transaksi siap disimpan` : "Ketik lalu tekan Enter untuk simpan"}</span>
          <button
            onClick={handleSubmit}
            disabled={validCount === 0}
            className="font-mono px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--accent-on)] font-semibold disabled:bg-[var(--bg-input)] disabled:text-[var(--text-faint)] transition-colors"
          >
            Enter ↵
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ADD / EDIT TRANSACTION MODAL (manual, with receipt drag & drop)
   ============================================================ */

function TransactionModal({ open, onClose, accounts, categories, onSave, presetType = null }) {
  const [form, setForm] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const initialType = presetType || categories[0]?.type || "expense";
      setForm({
        date: todayStr(),
        accountId: accounts[0]?.id,
        categoryId: categories.find((c) => c.type === initialType)?.id || categories[0]?.id,
        amount: "",
        note: "",
        type: initialType,
        receipt: null,
      });
      setDragOver(false);
    }
  }, [open, accounts, categories, presetType]);

  useEffect(() => {
    function handler(e) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !form) return null;

  function handleFiles(files) {
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran struk maksimal 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setForm((f) => ({ ...f, receipt: { name: file.name, dataUrl: e.target.result, isPdf: file.type === "application/pdf" } }));
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    const amt = parseMoneyInput(form.amount);
    if (!amt || amt <= 0) return;
    onSave({
      date: form.date,
      accountId: form.accountId,
      categoryId: form.categoryId,
      amount: amt,
      note: form.note || categories.find((c) => c.id === form.categoryId)?.name || "",
      type: form.type,
      receipt: form.receipt,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[var(--overlay)] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {presetType === "income" ? "Catat Pemasukan Cepat" : "Transaksi Baru"}
          </span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            {["expense", "income"].map((t) => (
              <button
                key={t}
                onClick={() => setForm((f) => ({ ...f, type: t, categoryId: categories.find((c) => c.type === t)?.id }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  form.type === t
                    ? t === "income"
                      ? "bg-[var(--accent-soft-bg)] border-[var(--accent)] text-[var(--accent-text)]"
                      : "bg-[var(--negative-soft-bg)] border-[var(--negative)] text-[var(--negative)]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                }`}
              >
                {t === "income" ? "Pemasukan" : "Pengeluaran"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-1">Nominal</label>
              <input
                autoFocus
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-1">Tanggal</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-1">Akun</label>
              <select
                value={form.accountId}
                onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-1">Kategori</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {categories.filter((c) => c.type === form.type).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Catatan</label>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Opsional"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Struk Belanja</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-lg border-2 border-dashed p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                dragOver ? "border-[var(--accent)] bg-[var(--accent-soft-bg)]" : "border-[var(--border-strong)] hover:border-[var(--border-strong)]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {form.receipt ? (
                <>
                  {form.receipt.isPdf ? (
                    <div className="w-10 h-10 rounded bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-secondary)]">
                      <ReceiptIcon size={18} />
                    </div>
                  ) : (
                    <img src={form.receipt.dataUrl} alt="struk" className="w-10 h-10 rounded object-cover" />
                  )}
                  <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{form.receipt.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, receipt: null })); }}
                    className="text-[var(--text-muted)] hover:text-[var(--negative)]"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <Upload size={16} className="text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-muted)]">Tarik & lepas foto/PDF struk di sini, atau klik untuk pilih file</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[var(--accent-on)] hover:bg-[var(--accent-hover)]"
          >
            Simpan (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TRANSFER MODAL
   ============================================================ */

function TransferModal({ open, onClose, accounts, onTransfer }) {
  const [fromId, setFromId] = useState(accounts[0]?.id);
  const [toId, setToId] = useState(accounts[1]?.id);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) {
      setFromId(accounts[0]?.id);
      setToId(accounts[1]?.id);
      setAmount("");
    }
  }, [open, accounts]);

  useEffect(() => {
    function handler(e) {
      if (open && e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  function submit() {
    const amt = parseMoneyInput(amount);
    if (!amt || amt <= 0 || fromId === toId) return;
    onTransfer(fromId, toId, amt);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[var(--overlay)] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ArrowLeftRight size={15} className="text-[var(--accent-text)]" /> Transfer Antar-Akun
          </span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Dari</label>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatCompact(a.balance)})</option>)}
            </select>
          </div>
          <div className="flex justify-center text-[var(--text-faint)]"><ArrowLeftRight size={14} className="rotate-90" /></div>
          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Ke</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Nominal</label>
            <input
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="0"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Batal</button>
          <button onClick={submit} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[var(--accent-on)] hover:bg-[var(--accent-hover)]">Transfer</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   RIGHT INSPECTION PANE
   ============================================================ */

function InspectionPane({ selectedTx, accounts, categories, monthTransactions, onDeselect, onDelete }) {
  if (selectedTx) {
    const acc = accounts.find((a) => a.id === selectedTx.accountId);
    const cat = categories.find((c) => c.id === selectedTx.categoryId);
    return (
      <aside className="w-80 shrink-0 h-full bg-[var(--bg-app)] border-l border-[var(--border)] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
          <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Detail Transaksi</span>
          <button onClick={onDeselect} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-3">
            <IconBadge Icon={selectedTx.type === "income" ? TrendingUp : TrendingDown} color={cat?.color || "var(--text-muted)"} size={40} />
            <div>
              <div className="text-sm text-[var(--text-primary)] font-medium">{selectedTx.note}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{cat?.name} · {formatDate(selectedTx.date)}</div>
            </div>
          </div>
          <MonoAmount value={selectedTx.type === "income" ? selectedTx.amount : -selectedTx.amount} sign colorByType={selectedTx.type} className="text-2xl font-semibold block" />

          <div className="rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] divide-y divide-[var(--border)] text-xs">
            <div className="flex justify-between px-3 py-2"><span className="text-[var(--text-muted)]">Akun</span><span className="text-[var(--text-secondary)]">{acc?.name}</span></div>
            <div className="flex justify-between px-3 py-2"><span className="text-[var(--text-muted)]">Kategori</span><span className="text-[var(--text-secondary)]">{cat?.name}</span></div>
            <div className="flex justify-between px-3 py-2"><span className="text-[var(--text-muted)]">Tanggal</span><span className="text-[var(--text-secondary)] font-mono">{selectedTx.date}</span></div>
            <div className="flex justify-between px-3 py-2"><span className="text-[var(--text-muted)]">Tipe</span><span className="text-[var(--text-secondary)] capitalize">{selectedTx.type === "income" ? "Pemasukan" : "Pengeluaran"}</span></div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2">Struk Belanja</div>
            {selectedTx.receipt ? (
              selectedTx.receipt.isPdf ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 flex items-center gap-2 text-[var(--text-secondary)] text-xs">
                  <ReceiptIcon size={16} /> {selectedTx.receipt.name}
                </div>
              ) : (
                selectedTx.receipt.dataUrl ? (
                  <img src={selectedTx.receipt.dataUrl} alt="struk" className="w-full rounded-lg border border-[var(--border)] object-cover" />
                ) : (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] py-6 text-center text-[11px] text-[var(--text-faint)]">Memuat struk…</div>
                )
              )
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] py-6 flex flex-col items-center gap-1.5 text-[var(--text-faint)]">
                <ImageIcon size={18} />
                <span className="text-[11px]">Tidak ada lampiran</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              const msg = selectedTx.isTransfer
                ? "Hapus transaksi ini? Karena bagian dari transfer/koreksi, pasangannya ikut terhapus dan saldo dikembalikan."
                : "Hapus transaksi ini? Saldo akun akan dikembalikan.";
              if (confirm(msg)) onDelete(selectedTx.id);
            }}
            className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--negative)] hover:border-[var(--negative)]"
          >
            <Trash2 size={13} /> Hapus Transaksi
          </button>
        </div>
      </aside>
    );
  }

  // default: monthly category breakdown
  const byCategory = {};
  monthTransactions.filter((t) => t.type === "expense").forEach((t) => {
    byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
  });
  const chartData = Object.entries(byCategory)
    .map(([catId, amount]) => {
      const cat = categories.find((c) => c.id === catId);
      return { name: cat?.name || "Lainnya", value: amount, color: cat?.color || "var(--text-muted)" };
    })
    .sort((a, b) => b.value - a.value);

  const totalExpense = chartData.reduce((s, c) => s + c.value, 0);
  const totalIncome = monthTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

  return (
    <aside className="w-80 shrink-0 h-full bg-[var(--bg-app)] border-l border-[var(--border)] flex flex-col overflow-y-auto">
      <div className="px-4 py-3.5 border-b border-[var(--border)]">
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Ringkasan Bulan Ini</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1"><TrendingUp size={12} className="text-[var(--accent-text)]" /> Masuk</div>
            <MonoAmount value={totalIncome} className="text-sm font-semibold text-[var(--accent-text)]" />
          </div>
          <div className="rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1"><TrendingDown size={12} className="text-[var(--negative)]" /> Keluar</div>
            <MonoAmount value={totalExpense} className="text-sm font-semibold text-[var(--negative)]" />
          </div>
        </div>

        {chartData.length > 0 ? (
          <>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatIDR(v)}
                    contentStyle={{ background: "var(--bg-panel)", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: "var(--text-primary)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {chartData.slice(0, 6).map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-[var(--text-secondary)] flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-[var(--text-secondary)]">{((c.value / totalExpense) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-xs text-[var(--text-faint)] py-8">Belum ada pengeluaran bulan ini</div>
        )}

        <div className="pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-faint)]">
          Pilih transaksi pada tabel untuk melihat detail & struk.
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   TRANSACTIONS TABLE (Center Pane content for dashboard/transactions)
   ============================================================ */

function TransactionsTable({ transactions, accounts, categories, selectedId, onSelect, filters, setFilters }) {
  const filtered = transactions.filter((t) => {
    if (filters.accountId !== "all" && t.accountId !== filters.accountId) return false;
    if (filters.categoryId !== "all" && t.categoryId !== filters.categoryId) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const cat = categories.find((c) => c.id === t.categoryId);
      if (!t.note.toLowerCase().includes(q) && !cat?.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2 bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 flex-1 max-w-xs">
          <Search size={13} className="text-[var(--text-muted)]" />
          <input
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder="Cari transaksi..."
            className="bg-transparent outline-none text-xs text-[var(--text-primary)] placeholder:text-[var(--text-faint)] flex-1"
          />
        </div>
        <select
          value={filters.accountId}
          onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}
          className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-secondary)] outline-none"
        >
          <option value="all">Semua Akun</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={filters.categoryId}
          onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
          className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-secondary)] outline-none"
        >
          <option value="all">Semua Kategori</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-[var(--text-faint)] font-mono">{filtered.length} transaksi</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--bg-panel)] backdrop-blur z-10">
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)]">
              <th className="text-left font-medium px-5 py-2">Tanggal</th>
              <th className="text-left font-medium px-3 py-2">Deskripsi</th>
              <th className="text-left font-medium px-3 py-2">Akun</th>
              <th className="text-left font-medium px-3 py-2">Kategori</th>
              <th className="text-right font-medium px-5 py-2">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const acc = accounts.find((a) => a.id === t.accountId);
              const cat = categories.find((c) => c.id === t.categoryId);
              const active = selectedId === t.id;
              return (
                <tr
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={`cursor-pointer border-b border-[var(--border)] transition-colors ${
                    active ? "bg-[var(--accent-soft-bg)]" : "hover:bg-[var(--bg-panel)]"
                  }`}
                >
                  <td className="px-5 py-2.5 text-[var(--text-muted)] font-mono text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="px-3 py-2.5 text-[var(--text-primary)] truncate max-w-[220px]">
                    <div className="flex items-center gap-1.5">
                      {(t.hasReceipt || t.receipt) && <ReceiptIcon size={11} className="text-[var(--text-faint)] shrink-0" />}
                      <span className="truncate">{t.note}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)] text-xs whitespace-nowrap">{acc?.name}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat?.color }} />
                      {cat?.name}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <MonoAmount value={t.type === "income" ? t.amount : -t.amount} sign colorByType={t.type} className="text-xs" />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-[var(--text-faint)] text-xs py-10">Tidak ada transaksi yang cocok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD SUMMARY STRIP + TREND CHART
   ============================================================ */

function DashboardHeader({ totalBalance, monthIncome, monthExpense, trendData }) {
  const net = monthIncome - monthExpense;
  return (
    <div className="px-5 py-4 border-b border-[var(--border)] shrink-0">
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-3.5">
          <div className="text-[11px] text-[var(--text-muted)] mb-1">Total Saldo</div>
          <MonoAmount value={totalBalance} className="text-lg font-semibold text-[var(--text-primary)]" />
        </div>
        <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-3.5">
          <div className="text-[11px] text-[var(--text-muted)] mb-1 flex items-center gap-1"><TrendingUp size={11} className="text-[var(--accent-text)]" />Pemasukan</div>
          <MonoAmount value={monthIncome} className="text-lg font-semibold text-[var(--accent-text)]" />
        </div>
        <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-3.5">
          <div className="text-[11px] text-[var(--text-muted)] mb-1 flex items-center gap-1"><TrendingDown size={11} className="text-[var(--negative)]" />Pengeluaran</div>
          <MonoAmount value={monthExpense} className="text-lg font-semibold text-[var(--negative)]" />
        </div>
        <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-3.5">
          <div className="text-[11px] text-[var(--text-muted)] mb-1">Arus Kas Bersih</div>
          <MonoAmount value={net} sign colorByType={net >= 0 ? "income" : "expense"} className="text-lg font-semibold" />
        </div>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ left: -20, top: 5, right: 10, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
            <Tooltip
              formatter={(v) => formatIDR(v)}
              contentStyle={{ background: "var(--bg-panel)", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--text-secondary)" }}
            />
            <Line type="monotone" dataKey="income" stroke="var(--positive)" strokeWidth={2} dot={false} name="Masuk" />
            <Line type="monotone" dataKey="expense" stroke="var(--negative)" strokeWidth={2} dot={false} name="Keluar" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ============================================================
   ADD ACCOUNT MODAL
   ============================================================ */

const ACCOUNT_COLOR_PALETTE = ["#f59e0b", "#3b82f6", "#f97316", "#22c55e", "#8b5cf6", "#ec4899", "#06b6d4", "#a855f7", "#14b8a6", "#ef4444"];

function AddAccountModal({ open, onClose, existingAccounts, onCreate }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [balance, setBalance] = useState("0");

  useEffect(() => {
    if (open) {
      setName("");
      setType("bank");
      setBalance("0");
    }
  }, [open]);

  useEffect(() => {
    function handler(e) {
      if (open && e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const shortcode = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ACC";
    const color = ACCOUNT_COLOR_PALETTE[existingAccounts.length % ACCOUNT_COLOR_PALETTE.length];
    onCreate({
      name: trimmed,
      shortcode,
      type,
      balance: parseMoneyInput(balance) || 0,
      color,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[var(--overlay)] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Plus size={15} className="text-[var(--accent-text)]" /> Tambah Akun Baru
          </span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Nama Akun</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="misal: Jenius, Dana, Kas Kecil"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Jenis</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="ewallet">E-Wallet</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Saldo Awal</label>
            <input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Batal</button>
          <button onClick={submit} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[var(--accent-on)] hover:bg-[var(--accent-hover)]">Tambah</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ACCOUNTS VIEW
   ============================================================ */

function AccountsView({ accounts, onTransferClick, onAdjustBalance, onAddAccount, onDeleteAccount }) {
  const [addOpen, setAddOpen] = useState(false);

  function handleDelete(a) {
    if (a.isDefault) {
      alert("Akun default tidak bisa dihapus.");
      return;
    }
    if (confirm(`Hapus akun "${a.name}"? SEMUA transaksi di akun ini juga akan ikut terhapus permanen.`)) {
      onDeleteAccount(a.id);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Semua Rekening</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-on)] font-semibold hover:bg-[var(--accent-hover)]"
          >
            <Plus size={13} /> Tambah Akun
          </button>
          <button
            onClick={onTransferClick}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
          >
            <ArrowLeftRight size={13} /> Transfer Antar-Akun
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {accounts.map((a) => {
          const Icon = ACCOUNT_ICONS[a.type] || Wallet;
          return (
            <div key={a.id} className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-4 group relative">
              <button
                onClick={() => handleDelete(a)}
                className="absolute top-3 right-3 text-[var(--text-faint)] hover:text-[var(--negative)] opacity-0 group-hover:opacity-100 transition-opacity"
                title="Hapus akun"
              >
                <Trash2 size={14} />
              </button>
              <div className="flex items-center justify-between mb-3">
                <IconBadge Icon={Icon} color={a.color} />
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] px-1.5 py-0.5 rounded bg-[var(--bg-input)]">{a.type}</span>
              </div>
              <div className="text-sm text-[var(--text-secondary)] mb-1">{a.name}</div>
              <MonoAmount value={a.balance} className="text-lg font-semibold text-[var(--text-primary)] block mb-3" />
              <button
                onClick={() => {
                  const val = prompt(`Koreksi saldo untuk ${a.name} (saldo saat ini: ${formatIDR(a.balance)})`, a.balance);
                  const parsed = parseMoneyInput(val);
                  if (val !== null && parsed !== null) onAdjustBalance(a.id, parsed);
                }}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-text)]"
              >
                Koreksi saldo →
              </button>
            </div>
          );
        })}
      </div>

      <AddAccountModal open={addOpen} onClose={() => setAddOpen(false)} existingAccounts={accounts} onCreate={onAddAccount} />
    </div>
  );
}

/* ============================================================
   DEBTS VIEW
   ============================================================ */

function DebtsView({ debts, accounts, onAddDebt, onPayDebt, onDeleteDebt }) {
  const [calcPrincipal, setCalcPrincipal] = useState(10000000);
  const [calcMonths, setCalcMonths] = useState(12);
  const [calcRate, setCalcRate] = useState(0);

  const emptyForm = { name: "", kind: "debt", principal: "", monthlyInstallment: "", dueDay: "1", autopay: false };
  const [form, setForm] = useState(emptyForm);
  const [payAccountId, setPayAccountId] = useState("");
  const effectivePayAccount = payAccountId || accounts[0]?.id || "";

  const monthlyInstallment = useMemo(() => {
    const r = calcRate / 100 / 12;
    if (r === 0) return calcPrincipal / calcMonths;
    return (calcPrincipal * r) / (1 - Math.pow(1 + r, -calcMonths));
  }, [calcPrincipal, calcMonths, calcRate]);

  function submitDebt() {
    const principal = parseMoneyInput(form.principal);
    if (!form.name.trim() || !principal || principal <= 0) {
      alert("Nama dan pokok pinjaman wajib diisi dengan benar.");
      return;
    }
    onAddDebt({
      name: form.name.trim(),
      kind: form.kind,
      principal,
      monthlyInstallment: parseMoneyInput(form.monthlyInstallment) || 0,
      dueDay: parseInt(form.dueDay) || 1,
      autopay: form.autopay,
    });
    setForm(emptyForm);
  }

  function pay(d) {
    const acc = accounts.find((a) => a.id === effectivePayAccount);
    const verb = d.kind === "debt" ? "dibayar dari" : "diterima ke";
    if (confirm(`Cicilan ${formatIDR(Math.min(d.remaining, d.monthlyInstallment))} untuk "${d.name}" akan ${verb} akun ${acc?.name}. Lanjutkan?`)) {
      onPayDebt(d.id, effectivePayAccount);
    }
  }

  const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none";

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Utang & Piutang</h2>
          {debts.length > 0 && (
            <label className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              Akun untuk cicilan
              <select value={effectivePayAccount} onChange={(e) => setPayAccountId(e.target.value)} className="bg-[var(--bg-panel)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-secondary)] outline-none">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
        </div>
        {debts.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] py-8 text-center text-xs text-[var(--text-faint)] mb-4">
            Belum ada catatan utang/piutang. Tambahkan lewat formulir di bawah.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {debts.map((d) => {
            const pct = d.principal > 0 ? ((d.principal - d.remaining) / d.principal) * 100 : 0;
            return (
              <div key={d.id} className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-4 group relative">
                <button
                  onClick={() => confirm(`Hapus "${d.name}"?`) && onDeleteDebt(d.id)}
                  className="absolute bottom-3 right-3 text-[var(--text-faint)] hover:text-[var(--negative)] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Hapus"
                >
                  <Trash2 size={13} />
                </button>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${d.kind === "debt" ? "bg-[var(--negative-soft-bg)] text-[var(--negative)]" : "bg-[var(--accent-soft-bg)] text-[var(--accent-text)]"}`}>
                    {d.kind === "debt" ? "Utang" : "Piutang"}
                  </span>
                  {d.autopay && (
                    <span className="text-[10px] flex items-center gap-1 text-[var(--text-muted)]"><Clock size={11} /> Jatuh tempo tgl {d.dueDay}</span>
                  )}
                </div>
                <div className="text-sm text-[var(--text-primary)] mb-2">{d.name}</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <MonoAmount value={d.remaining} className="text-lg font-semibold text-[var(--text-primary)]" />
                  <span className="text-[11px] text-[var(--text-faint)] font-mono">/ {formatIDR(d.principal)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden mb-2">
                  <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Cicilan/bln: <span className="font-mono text-[var(--text-secondary)]">{formatIDR(d.monthlyInstallment)}</span></span>
                  {d.remaining > 0 && d.monthlyInstallment > 0 && (
                    <button onClick={() => pay(d)} className="text-[var(--accent-text)]">
                      {d.kind === "debt" ? "Bayar cicilan →" : "Terima cicilan →"}
                    </button>
                  )}
                  {d.remaining <= 0 && <span className="text-[var(--accent-text)] flex items-center gap-1"><CheckCircle2 size={12} /> Lunas</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-4 max-w-md">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-1.5"><Plus size={13} className="text-[var(--accent-text)]" /> Tambah Utang / Piutang</h3>
        <div className="space-y-2.5">
          <input className={inputCls} placeholder="Nama (mis. Cicilan Motor)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2.5">
            <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="debt">Utang (saya berutang)</option>
              <option value="receivable">Piutang (orang berutang ke saya)</option>
            </select>
            <input className={inputCls + " font-mono"} placeholder="Pokok, mis. 10jt" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <input className={inputCls + " font-mono"} placeholder="Cicilan/bln, mis. 500rb" value={form.monthlyInstallment} onChange={(e) => setForm({ ...form, monthlyInstallment: e.target.value })} />
            <input className={inputCls + " font-mono"} type="number" min="1" max="31" placeholder="Jatuh tempo (tgl)" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <input type="checkbox" checked={form.autopay} onChange={(e) => setForm({ ...form, autopay: e.target.checked })} />
            Tampilkan pengingat tanggal jatuh tempo
          </label>
          <button onClick={submitDebt} className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-on)] font-semibold hover:bg-[var(--accent-hover)]">Simpan</button>
        </div>
      </div>

      <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-4 max-w-md">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-1.5"><CreditCard size={13} className="text-[var(--accent-text)]" /> Kalkulator Cicilan</h3>
        <div className="space-y-2.5">
          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Pokok Pinjaman</label>
            <input type="number" value={calcPrincipal} onChange={(e) => setCalcPrincipal(parseFloat(e.target.value) || 0)} className={inputCls + " font-mono"} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-1">Tenor (bulan)</label>
              <input type="number" value={calcMonths} onChange={(e) => setCalcMonths(parseFloat(e.target.value) || 1)} className={inputCls + " font-mono"} />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-1">Bunga/thn (%)</label>
              <input type="number" value={calcRate} onChange={(e) => setCalcRate(parseFloat(e.target.value) || 0)} className={inputCls + " font-mono"} />
            </div>
          </div>
          <div className="pt-2 border-t border-[var(--border)] flex justify-between items-center">
            <span className="text-xs text-[var(--text-muted)]">Cicilan / bulan</span>
            <MonoAmount value={monthlyInstallment} className="text-base font-semibold text-[var(--accent-text)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ADD SAVINGS GOAL MODAL
   ============================================================ */

function AddGoalModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setTarget("");
      setCurrent("0");
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      setDeadline(toDateStr(d));
    }
  }, [open]);

  useEffect(() => {
    function handler(e) {
      if (open && e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  function submit() {
    const trimmed = name.trim();
    const targetVal = parseMoneyInput(target);
    if (!trimmed || !targetVal || targetVal <= 0) return;
    onCreate({
      name: trimmed,
      target: targetVal,
      current: parseMoneyInput(current) || 0,
      deadline: deadline || todayStr(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[var(--overlay)] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <PiggyBank size={15} className="text-[var(--accent-text)]" /> Target Tabungan Baru
          </span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Nama Target</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="misal: Dana Darurat, Liburan"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-1">Nominal Target</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="0"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-1">Sudah Terkumpul</label>
              <input
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="0"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-1">Target Tanggal</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Batal</button>
          <button onClick={submit} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[var(--accent-on)] hover:bg-[var(--accent-hover)]">Simpan</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   BUDGET VIEW
   ============================================================ */

// Kolom anggaran yang bisa diketik langsung; tersimpan ke database saat selesai mengetik (blur/Enter).
function BudgetInput({ value, onSave }) {
  const [text, setText] = useState(String(value || ""));

  function commit() {
    const parsed = text.trim() === "" ? 0 : parseMoneyInput(text);
    if (parsed === null || parsed < 0) { setText(String(value || "")); return; }
    if (parsed !== value) onSave(parsed);
  }
  return (
    <input
      value={text}
      placeholder="0"
      inputMode="numeric"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="w-24 text-right bg-[var(--bg-input)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-secondary)] outline-none focus:border-[var(--accent)]"
      title="Ketik anggaran, mis. 500rb atau 1,5jt"
    />
  );
}

function BudgetView({ categories, monthTransactions, goals, budgets, cycle, cycleStartDay, setCycleStartDay, onSetBudget, onAddGoal, onFundGoal, onDeleteGoal }) {
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const budgetCategories = categories.filter((c) => c.type === "expense" && c.id !== "cat-lainnya");

  function addGoal(goal) {
    onAddGoal(goal);
  }

  function addFunds(goalId) {
    const goal = goals.find((g) => g.id === goalId);
    const val = prompt(`Tambah dana untuk "${goal.name}" (mis. 500rb atau 1.000.000):`, "");
    const amt = parseMoneyInput(val);
    if (val !== null && amt && amt > 0) onFundGoal(goalId, amt);
  }

  function deleteGoal(goalId) {
    if (confirm("Hapus target tabungan ini?")) onDeleteGoal(goalId);
  }

  const spendByCategory = {};
  monthTransactions.filter((t) => t.type === "expense").forEach((t) => {
    spendByCategory[t.categoryId] = (spendByCategory[t.categoryId] || 0) + t.amount;
  });

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Anggaran Bulanan</h2>
            <p className="text-[11px] text-[var(--text-faint)] mt-0.5">Periode berjalan: {formatDate(cycle.start)} – {formatDate(cycle.last)}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Calendar size={13} />
            Siklus mulai tanggal
            <select
              value={cycleStartDay}
              onChange={(e) => setCycleStartDay(parseInt(e.target.value))}
              className="bg-[var(--bg-panel)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-secondary)] outline-none"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-3">
          {budgetCategories.map((cat) => {
            const catId = cat.id;
            const budget = budgets[catId] || 0;
            const spent = spendByCategory[catId] || 0;
            const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : (spent > 0 ? 100 : 0);
            const over = budget > 0 && spent > budget;
            return (
              <div key={catId} className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-3.5">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color }} /> {cat?.name}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono">
                    <span className={over ? "text-[var(--negative)]" : "text-[var(--text-secondary)]"}>{formatCompact(spent)}</span>
                    <span className="text-[var(--text-faint)]">/</span>
                    <BudgetInput key={`${catId}-${budget}`} value={budget} onSave={(v) => onSetBudget(catId, v)} />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
                  <div className={`h-full rounded-full ${over ? "bg-[var(--negative)]" : "bg-[var(--accent)]"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5"><PiggyBank size={14} className="text-[var(--accent-text)]" /> Target Tabungan</h2>
          <button
            onClick={() => setGoalModalOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-on)] font-semibold hover:bg-[var(--accent-hover)]"
          >
            <Plus size={13} /> Tambah Target
          </button>
        </div>
        {goals.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] py-8 text-center text-xs text-[var(--text-faint)] mb-4">
            Belum ada target tabungan. Klik "Tambah Target" untuk membuat yang pertama.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {goals.map((g) => {
            const pct = Math.min(100, (g.current / g.target) * 100);
            const reached = g.current >= g.target;
            return (
              <div key={g.id} className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-4 group relative">
                <button
                  onClick={() => deleteGoal(g.id)}
                  className="absolute top-3 right-3 text-[var(--text-faint)] hover:text-[var(--negative)] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Hapus target"
                >
                  <Trash2 size={14} />
                </button>
                <div className="flex items-center justify-between mb-2 pr-5">
                  <span className="text-sm text-[var(--text-primary)]">{g.name}</span>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">{formatDate(g.deadline)}</span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <MonoAmount value={g.current} className="text-base font-semibold text-[var(--accent-text)]" />
                  <span className="text-[11px] text-[var(--text-faint)] font-mono">/ {formatIDR(g.target)}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg-input)] overflow-hidden mb-1">
                  <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">{pct.toFixed(0)}%</span>
                  {reached ? (
                    <span className="text-[11px] text-[var(--accent-text)] flex items-center gap-1"><CheckCircle2 size={12} /> Tercapai</span>
                  ) : (
                    <button onClick={() => addFunds(g.id)} className="text-[11px] text-[var(--accent-text)] hover:text-[var(--accent-text)]">
                      + Tambah dana
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AddGoalModal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} onCreate={addGoal} />
    </div>
  );
}

/* ============================================================
   REPORTS VIEW (analytics + export)
   ============================================================ */

function ReportsView({ transactions, categories, accounts }) {
  // Transfer & koreksi saldo bukan pemasukan/pengeluaran sungguhan.
  const real = transactions.filter((t) => !t.isTransfer);
  const monthly = {};
  real.forEach((t) => {
    const key = t.date.slice(0, 7);
    if (!monthly[key]) monthly[key] = { label: key, income: 0, expense: 0 };
    if (t.type === "income") monthly[key].income += t.amount;
    else monthly[key].expense += t.amount;
  });
  const monthlyData = Object.values(monthly).sort((a, b) => a.label.localeCompare(b.label));

  const byCategory = {};
  real.filter((t) => t.type === "expense").forEach((t) => {
    byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
  });
  const catData = Object.entries(byCategory).map(([id, val]) => ({
    name: categories.find((c) => c.id === id)?.name || "Lainnya",
    value: val,
  })).sort((a, b) => b.value - a.value);

  function exportCSV() {
    const header = ["Tanggal", "Tipe", "Akun", "Kategori", "Catatan", "Nominal", "Transfer/Koreksi"];
    const rows = transactions.map((t) => [
      t.date, t.type, accounts.find((a) => a.id === t.accountId)?.name || "",
      categories.find((c) => c.id === t.categoryId)?.name || "", t.note, t.amount, t.isTransfer ? "ya" : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadFile(csv, "nectar-transaksi.csv", "text/csv");
  }

  function exportJSON() {
    downloadFile(JSON.stringify(transactions, null, 2), "nectar-transaksi.json", "application/json");
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Analisis & Ekspor</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent-text)]">
            <Download size={13} /> CSV
          </button>
          <button onClick={exportJSON} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent-text)]">
            <Download size={13} /> JSON
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-4">
        <h3 className="text-xs text-[var(--text-secondary)] mb-3">Perbandingan Bulanan</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
              <Tooltip formatter={(v) => formatIDR(v)} contentStyle={{ background: "var(--bg-panel)", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="income" fill="var(--positive)" name="Pemasukan" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" fill="var(--negative)" name="Pengeluaran" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-4">
        <h3 className="text-xs text-[var(--text-secondary)] mb-3">Distribusi Pengeluaran (Total)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={catData} dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}>
                {catData.map((entry, i) => {
                  const cat = categories.find((c) => c.name === entry.name);
                  return <Cell key={i} fill={cat?.color || "var(--text-muted)"} />;
                })}
              </Pie>
              <Tooltip formatter={(v) => formatIDR(v)} contentStyle={{ background: "var(--bg-panel)", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */

export default function NectarDesktop() {
  // ---- Data dari database (lewat API) ----
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [cycleStartDay, setCycleStartDay] = useState(1);

  // ---- Status pemuatan & notifikasi ----
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState(null);
  const [toast, setToast] = useState(null);

  // ---- State tampilan ----
  const [activeTab, setActiveTab] = useState("dashboard");
  const [theme, setTheme] = useState("dark");
  const [selectedTxId, setSelectedTxId] = useState(null);
  const [receiptCache, setReceiptCache] = useState({});
  const [commandOpen, setCommandOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txPresetType, setTxPresetType] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [filters, setFilters] = useState({ query: "", accountId: "all", categoryId: "all" });

  const notify = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Muat ulang semua data dari server. Dipanggil saat start dan setelah setiap perubahan,
  // sehingga layar SELALU sama dengan isi database (saldo dihitung server, bukan di browser).
  const loadAll = useCallback(async () => {
    const [acc, cats, txs, dbts, gls, bud, settings] = await Promise.all([
      api.accounts.list(),
      api.categories.list(),
      api.transactions.list(),
      api.debts.list(),
      api.goals.list(),
      api.budgets.list(),
      api.settings.get(),
    ]);
    setAccounts(acc);
    setCategories(cats);
    setTransactions(txs);
    setDebts(dbts);
    setGoals(gls);
    setBudgets(bud);
    setCycleStartDay(settings.cycleStartDay);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadAll();
      } catch (err) {
        if (!cancelled) setFatalError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadAll]);

  // Jalankan sebuah aksi ke server, lalu muat ulang data. Error ditampilkan sebagai notifikasi.
  async function run(action) {
    try {
      await action();
      await loadAll();
    } catch (err) {
      notify(err.message);
    }
  }

  useEffect(() => {
    function handler(e) {
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && key === "m") {
        e.preventDefault();
        setTxPresetType("income");
        setTxModalOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Struk (gambar besar) tidak ikut di daftar transaksi; diambil saat transaksi dipilih.
  useEffect(() => {
    const tx = transactions.find((t) => t.id === selectedTxId);
    if (!tx?.hasReceipt || receiptCache[tx.id]) return;
    api.transactions.receipt(tx.id)
      .then((r) => setReceiptCache((c) => ({ ...c, [tx.id]: r })))
      .catch((err) => notify(err.message));
  }, [selectedTxId, transactions, receiptCache, notify]);

  const baseTx = transactions.find((t) => t.id === selectedTxId) || null;
  const selectedTx = baseTx && {
    ...baseTx,
    receipt: baseTx.hasReceipt
      ? receiptCache[baseTx.id] || { name: baseTx.receiptName, isPdf: baseTx.receiptIsPdf, dataUrl: null }
      : null,
  };

  // ---- Ringkasan periode berjalan (mengikuti tanggal mulai siklus) ----
  // Transfer & koreksi saldo (isTransfer) TIDAK dihitung sebagai pemasukan/pengeluaran.
  const cycle = useMemo(() => getCycleRange(cycleStartDay), [cycleStartDay]);
  const monthTransactions = useMemo(
    () => transactions.filter((t) => !t.isTransfer && t.date >= cycle.start && t.date < cycle.end),
    [transactions, cycle]
  );
  const monthIncome = monthTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const trendData = useMemo(() => {
    const days = 14;
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const key = daysAgo(i);
      map[key] = { label: key.slice(5), income: 0, expense: 0 };
    }
    transactions.forEach((t) => {
      if (t.isTransfer || !map[t.date]) return;
      if (t.type === "income") map[t.date].income += t.amount;
      else map[t.date].expense += t.amount;
    });
    return Object.values(map);
  }, [transactions]);

  // ---- Handler: semua mengirim ke API, lalu loadAll() ----
  const commitCommandTransactions = (parsedList) =>
    run(() => api.transactions.bulk(parsedList.map((p) => ({
      accountId: p.accountId, categoryId: p.categoryId, amount: p.amount, note: p.note, type: p.type,
    }))));
  const saveManualTransaction = (tx) => run(() => api.transactions.create(tx));
  const handleTransfer = (fromId, toId, amount) => run(() => api.transactions.transfer(fromId, toId, amount));
  const deleteTransaction = (id) => {
    setSelectedTxId(null);
    return run(() => api.transactions.remove(id));
  };
  const adjustBalance = (accountId, newBalance) => run(() => api.accounts.update(accountId, { balance: newBalance }));
  const addAccount = (account) => run(() => api.accounts.create(account));
  const deleteAccount = (accountId) => run(() => api.accounts.remove(accountId));
  const addDebt = (debt) => run(() => api.debts.create(debt));
  const payDebt = (id, accountId) => run(() => api.debts.pay(id, accountId));
  const deleteDebt = (id) => run(() => api.debts.remove(id));
  const addGoal = (goal) => run(() => api.goals.create(goal));
  const fundGoal = (id, amount) => run(() => api.goals.fund(id, amount));
  const deleteGoal = (id) => run(() => api.goals.remove(id));
  const changeCycleStartDay = (day) => run(() => api.settings.update({ cycleStartDay: day }));
  const setBudget = (categoryId, amount) => run(() => api.budgets.set(categoryId, amount));

  const defaultAccountId = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id;
  const themeStyle = { fontFamily: "'Inter', system-ui, sans-serif", ...THEMES[theme] };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[var(--bg-app)] text-[var(--text-muted)] flex items-center justify-center text-sm" style={themeStyle}>
        Memuat data…
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="w-full h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex items-center justify-center px-6" style={themeStyle}>
        <div className="max-w-md rounded-xl bg-[var(--bg-panel)] border border-[var(--border-strong)] p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><AlertCircle size={16} className="text-[var(--warning)]" /> Tidak bisa memuat data</div>
          <p className="text-xs text-[var(--text-secondary)]">{fatalError}</p>
          <ol className="text-xs text-[var(--text-muted)] list-decimal pl-4 space-y-1">
            <li>Buka XAMPP Control Panel, klik <b>Start</b> pada MySQL.</li>
            <li>Jalankan backend: <span className="font-mono">npm run dev</span> di folder nectar-backend.</li>
            <li>Cek <span className="font-mono">http://127.0.0.1:4000/api/health</span> di browser.</li>
          </ol>
          <button
            onClick={() => { setFatalError(null); setLoading(true); loadAll().then(() => setLoading(false)).catch((e) => { setFatalError(e.message); setLoading(false); }); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-on)] font-semibold"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex overflow-hidden transition-colors duration-300"
      style={themeStyle}
    >
      <Sidebar
        accounts={accounts}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalBalance={totalBalance}
        onOpenCommand={() => setCommandOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {(activeTab === "dashboard" || activeTab === "transactions") && (
          <>
            {activeTab === "dashboard" && (
              <DashboardHeader totalBalance={totalBalance} monthIncome={monthIncome} monthExpense={monthExpense} trendData={trendData} />
            )}
            <div className="flex items-center justify-between px-5 pt-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{activeTab === "dashboard" ? "Transaksi Terbaru" : "Semua Transaksi"}</h2>
              <button
                onClick={() => { setTxPresetType(null); setTxModalOpen(true); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-on)] font-semibold hover:bg-[var(--accent-hover)]"
              >
                <Plus size={13} /> Transaksi Baru
              </button>
            </div>
            <TransactionsTable
              transactions={activeTab === "dashboard" ? transactions.slice(0, 25) : transactions}
              accounts={accounts}
              categories={categories}
              selectedId={selectedTxId}
              onSelect={(id) => setSelectedTxId(id === selectedTxId ? null : id)}
              filters={filters}
              setFilters={setFilters}
            />
          </>
        )}

        {activeTab === "accounts" && (
          <AccountsView
            accounts={accounts}
            onTransferClick={() => setTransferOpen(true)}
            onAdjustBalance={adjustBalance}
            onAddAccount={addAccount}
            onDeleteAccount={deleteAccount}
          />
        )}

        {activeTab === "debts" && (
          <DebtsView debts={debts} accounts={accounts} onAddDebt={addDebt} onPayDebt={payDebt} onDeleteDebt={deleteDebt} />
        )}

        {activeTab === "budget" && (
          <BudgetView
            categories={categories}
            monthTransactions={monthTransactions}
            goals={goals}
            budgets={budgets}
            cycle={cycle}
            cycleStartDay={cycleStartDay}
            setCycleStartDay={changeCycleStartDay}
            onSetBudget={setBudget}
            onAddGoal={addGoal}
            onFundGoal={fundGoal}
            onDeleteGoal={deleteGoal}
          />
        )}

        {activeTab === "reports" && <ReportsView transactions={transactions} categories={categories} accounts={accounts} />}

        {activeTab === "settings" && (
          <div className="flex-1 flex items-center justify-center text-[var(--text-faint)] text-sm">
            Pengaturan aplikasi akan tersedia di rilis berikutnya.
          </div>
        )}
      </main>

      {(activeTab === "dashboard" || activeTab === "transactions") && (
        <InspectionPane
          selectedTx={selectedTx}
          accounts={accounts}
          categories={categories}
          monthTransactions={monthTransactions}
          onDeselect={() => setSelectedTxId(null)}
          onDelete={deleteTransaction}
        />
      )}

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        categories={categories}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        onCommit={commitCommandTransactions}
      />

      <TransactionModal
        open={txModalOpen}
        onClose={() => { setTxModalOpen(false); setTxPresetType(null); }}
        accounts={accounts}
        categories={categories}
        onSave={saveManualTransaction}
        presetType={txPresetType}
      />

      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts}
        onTransfer={handleTransfer}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-lg bg-[var(--bg-panel)] border border-[var(--negative)] px-4 py-3 text-xs text-[var(--text-primary)] shadow-2xl flex items-start gap-2">
          <AlertCircle size={14} className="text-[var(--negative)] shrink-0 mt-0.5" />
          <span className="flex-1">{toast}</span>
          <button onClick={() => setToast(null)} className="text-[var(--text-muted)]"><X size={12} /></button>
        </div>
      )}
    </div>
  );
}
