"use client";

// Layout and component styling adapted from Tremor's open-source dashboard
// template (https://github.com/tremorlabs/template-dashboard-oss, Apache-2.0).
// See THIRD_PARTY_NOTICES.md.

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  RiDeleteBin6Line,
  RiDownload2Line,
  RiGithubLine,
  RiHome2Line,
  RiInformationLine,
  RiListCheck,
  RiMailLine,
  RiRefreshLine,
  RiSearchLine,
  RiUploadCloud2Line,
} from "@remixicon/react";
import sampleData from "@/data/sample-transactions.json";

interface Transaction {
  id: number;
  preview: string;
  date: string;
  bank_name: string;
  bank_code?: string;
  amount: string;
  memo: string;
  recipient: string;
  category: string;
  confidence: number;
  reference?: string;
  is_sample?: boolean;
}

type Menu = "dashboard" | "history" | "upload";
type Period = "7" | "30" | "45" | "all";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DB_KEY = "saijai_database_v2";
// The slip-analysis backend is not deployed. Set NEXT_PUBLIC_DEMO_MODE=false once it is.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
const DEVELOPER_CONTACT = "mailto:ariya06120@gmail.com?subject=SaiJai%20Analytics";
const REPO_URL = "https://github.com/AriyaLuesawat/Project-saijai";
const SAMPLE_TRANSACTIONS = sampleData as Transaction[];
const ALL = "ทั้งหมด";
const DAY = 86_400_000;

const BANK_NAMES: Record<string, string> = {
  KBank: "กสิกรไทย",
  SCB: "ไทยพาณิชย์",
  KTB: "กรุงไทย",
  BBL: "กรุงเทพ",
  BAY: "กรุงศรีอยุธยา",
};

const CATEGORIES = ["ค่าอาหาร", "ค่าเดินทาง", "ค่าสาธารณูปโภค", "ค่าของใช้", "โอนเงิน", "ทำบุญ/บริจาค", "ความบันเทิง", "สุขภาพ/ความงาม", "อื่นๆ"];
const STACK_COLORS = ["bg-emerald-600", "bg-sky-600", "bg-amber-500", "bg-gray-400"];

const NAVIGATION: { id: Menu; label: string; icon: typeof RiHome2Line }[] = [
  { id: "dashboard", label: "ภาพรวม", icon: RiHome2Line },
  { id: "history", label: "รายการ", icon: RiListCheck },
  { id: "upload", label: "เพิ่มสลิป", icon: RiUploadCloud2Line },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: "7", label: "7 วัน" },
  { id: "30", label: "30 วัน" },
  { id: "45", label: "45 วัน" },
  { id: "all", label: "ทั้งหมด" },
];

const CHART_METRICS: { title: string; kind: "money" | "count"; category?: string }[] = [
  { title: "ยอดใช้จ่าย", kind: "money" },
  { title: "จำนวนรายการ", kind: "count" },
  { title: "ค่าอาหาร", kind: "money", category: "ค่าอาหาร" },
  { title: "ค่าเดินทาง", kind: "money", category: "ค่าเดินทาง" },
  { title: "ค่าของใช้", kind: "money", category: "ค่าของใช้" },
  { title: "โอนเงิน", kind: "money", category: "โอนเงิน" },
];

// ─── helpers ────────────────────────────────────────────────────────────────
const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1";

function amountOf(t: Transaction): number {
  return Number.parseFloat(t.amount.replace(/,/g, "")) || 0;
}

function baht(value: number, digits = 0): string {
  return `฿${value.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function count(value: number): string {
  return value.toLocaleString("th-TH");
}

function percent(value: number, signed = false): string {
  if (!Number.isFinite(value)) return "—";
  const text = `${(value * 100).toFixed(1)}%`;
  return signed && value > 0 ? `+${text}` : text;
}

const dayStart = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
const isoDay = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function thaiDate(value: string | number, withYear = true): string {
  const date = new Date(typeof value === "number" ? value : dayStart(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: withYear ? "2-digit" : undefined }).format(date);
}

function bankCode(t: Transaction): string {
  return t.bank_code ?? t.bank_name.split(" ")[0];
}

function sumBy(items: Transaction[], key: (t: Transaction) => string) {
  const map = new Map<string, { value: number; count: number }>();
  items.forEach((t) => {
    const k = key(t);
    const cur = map.get(k) ?? { value: 0, count: 0 };
    map.set(k, { value: cur.value + amountOf(t), count: cur.count + 1 });
  });
  return [...map.entries()].map(([name, d]) => ({ name, ...d })).sort((a, b) => b.value - a.value);
}

function change(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

// ─── small Tremor-style components ──────────────────────────────────────────
type BadgeVariant = "neutral" | "success" | "error" | "warning";
const BADGE: Record<BadgeVariant, string> = {
  neutral: "bg-gray-50 text-gray-700 ring-gray-500/30",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-600/30",
  error: "bg-red-50 text-red-800 ring-red-600/20",
  warning: "bg-yellow-50 text-yellow-800 ring-yellow-600/30",
};

function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center gap-x-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ring-1", BADGE[variant])}>{children}</span>;
}

// For spending, going up is the "bad" direction.
function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const variant: BadgeVariant = value > 0.005 ? "error" : value < -0.005 ? "success" : "neutral";
  return <Badge variant={variant}>{percent(value, true)}</Badge>;
}

function ProgressBar({ value, max = 100, color = "bg-emerald-600", track = "bg-emerald-100" }: { value: number; max?: number; color?: string; track?: string }) {
  const width = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cx("relative mt-2 flex h-1.5 w-full items-center rounded-full", track)} role="progressbar" aria-valuenow={Math.round(width)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full", color)} style={{ width: `${width}%` }} />
    </div>
  );
}

function SectionTitle({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return <h1 id={id} className={cx("scroll-mt-10 text-lg font-semibold text-gray-900 sm:text-xl", className)}>{children}</h1>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex gap-2.5 rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-900 ring-1 ring-yellow-600/20">
      <RiInformationLine className="mt-0.5 size-4 shrink-0 text-yellow-700" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

const inputClass = cx("rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400", "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none");

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 4000);
    return () => window.clearTimeout(id);
  }, [onClose]);
  return <div role="alert" className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-md bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">{message}</div>;
}

function TransactionTable({ rows, showConfidence = false }: { rows: Transaction[]; showConfidence?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="whitespace-nowrap py-3.5 pr-3 font-semibold text-gray-900">วันที่</th>
            <th className="px-3 py-3.5 font-semibold text-gray-900">รายการ</th>
            <th className="hidden px-3 py-3.5 font-semibold text-gray-900 md:table-cell">ผู้รับ</th>
            <th className="px-3 py-3.5 font-semibold text-gray-900">ธนาคาร</th>
            <th className="px-3 py-3.5 font-semibold text-gray-900">หมวด</th>
            {showConfidence && <th className="hidden px-3 py-3.5 text-right font-semibold text-gray-900 lg:table-cell">ความมั่นใจ</th>}
            <th className="py-3.5 pl-3 text-right font-semibold text-gray-900">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap py-3 pr-3 text-gray-600">{thaiDate(t.date)}</td>
              <td className="px-3 py-3 text-gray-900">{t.memo}</td>
              <td className="hidden px-3 py-3 text-gray-600 md:table-cell">{t.recipient}</td>
              <td className="whitespace-nowrap px-3 py-3 text-gray-600">{BANK_NAMES[bankCode(t)] ?? bankCode(t)}</td>
              <td className="px-3 py-3"><Badge>{t.category}</Badge></td>
              {showConfidence && <td className="hidden px-3 py-3 text-right text-gray-600 lg:table-cell">{Math.round(t.confidence * 100)}%</td>}
              <td className="whitespace-nowrap py-3 pl-3 text-right font-medium text-gray-900">{baht(amountOf(t), 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────
export default function Home() {
  const [menu, setMenu] = useState<Menu>("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>(SAMPLE_TRANSACTIONS);
  const [period, setPeriod] = useState<Period>("30");
  const [bankFilter, setBankFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* Loading browser-owned persisted state after hydration is intentional. */
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = localStorage.getItem(DB_KEY);
      if (saved) setTransactions(JSON.parse(saved) as Transaction[]);
      else localStorage.setItem(DB_KEY, JSON.stringify(SAMPLE_TRANSACTIONS));
    } catch {
      setToast("ไม่สามารถอ่านข้อมูลที่บันทึกไว้ได้ จึงแสดงข้อมูลตัวอย่างแทน");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const persist = useCallback((next: Transaction[]) => {
    setTransactions(next);
    localStorage.setItem(DB_KEY, JSON.stringify(next));
  }, []);

  const addTransactions = useCallback((items: Transaction[]) => {
    setTransactions((current) => {
      const next = [...items, ...current];
      localStorage.setItem(DB_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const banks = useMemo(() => [...new Set(transactions.map(bankCode))].sort(), [transactions]);
  const byBank = useMemo(() => (bankFilter === ALL ? transactions : transactions.filter((t) => bankCode(t) === bankFilter)), [bankFilter, transactions]);

  // Current window ends on the latest transaction date; the previous window is the same length right before it.
  const range = useMemo(() => {
    const times = byBank.map((t) => dayStart(t.date));
    if (!times.length) return null;
    const end = Math.max(...times);
    const first = Math.min(...times);
    const days = period === "all" ? Math.round((end - first) / DAY) + 1 : Number(period);
    const start = end - (days - 1) * DAY;
    return { start, end, days, prevStart: start - days * DAY, prevEnd: start - DAY, compare: period !== "all" };
  }, [byBank, period]);

  const inWindow = useCallback((t: Transaction, from: number, to: number) => {
    const d = dayStart(t.date);
    return d >= from && d <= to;
  }, []);

  const current = useMemo(() => (range ? byBank.filter((t) => inWindow(t, range.start, range.end)).sort((a, b) => b.date.localeCompare(a.date)) : []), [byBank, inWindow, range]);
  const previous = useMemo(() => (range?.compare ? byBank.filter((t) => inWindow(t, range.prevStart, range.prevEnd)) : []), [byBank, inWindow, range]);

  const total = current.reduce((s, t) => s + amountOf(t), 0);
  const prevTotal = range?.compare ? previous.reduce((s, t) => s + amountOf(t), 0) : null;
  const categories = useMemo(() => sumBy(current, (t) => t.category), [current]);
  const prevCategories = useMemo(() => new Map(sumBy(previous, (t) => t.category).map((c) => [c.name, c.value])), [previous]);
  const bankTotals = useMemo(() => sumBy(current, bankCode), [current]);
  const prevBankTotals = useMemo(() => new Map(sumBy(previous, bankCode).map((b) => [b.name, b.value])), [previous]);

  const topCategory = categories[0];
  const topBank = bankTotals[0];
  const stack = useMemo(() => {
    const top = categories.slice(0, 3).map((c) => ({ name: c.name, value: c.value }));
    const rest = categories.slice(3).reduce((s, c) => s + c.value, 0);
    if (rest > 0) top.push({ name: "หมวดอื่น", value: rest });
    return top;
  }, [categories]);

  // Daily series for each metric card: current window vs. previous window, aligned by day.
  const series = useMemo(() => {
    if (!range) return [];
    return CHART_METRICS.map((metric) => {
      const pick = (t: Transaction) => !metric.category || t.category === metric.category;
      const daily = (items: Transaction[], from: number) => {
        const values = new Array<number>(range.days).fill(0);
        items.filter(pick).forEach((t) => {
          const i = Math.round((dayStart(t.date) - from) / DAY);
          if (i >= 0 && i < range.days) values[i] += metric.kind === "money" ? amountOf(t) : 1;
        });
        return values;
      };
      const cur = daily(current, range.start);
      const prev = range.compare ? daily(previous, range.prevStart) : null;
      const value = cur.reduce((s, v) => s + v, 0);
      const prevValue = prev ? prev.reduce((s, v) => s + v, 0) : null;
      const data = cur.map((v, i) => ({ label: thaiDate(range.start + i * DAY), value: v, previous: prev ? prev[i] : undefined }));
      return { ...metric, value, prevValue, change: change(value, prevValue), data };
    });
  }, [current, previous, range]);

  const history = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions
      .filter((t) => (categoryFilter === ALL || t.category === categoryFilter) && (!q || [t.memo, t.recipient, t.bank_name, t.reference ?? ""].some((v) => v.toLowerCase().includes(q))))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [categoryFilter, query, transactions]);

  const handleFiles = useCallback((selected: File[]) => {
    const valid = selected.filter((f) => f.type.startsWith("image/"));
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setFiles(valid);
    setPreviews(valid.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })));
    if (valid.length !== selected.length) setToast("ข้ามไฟล์ที่ไม่ใช่รูปภาพแล้ว");
  }, [previews]);

  const handleUpload = async () => {
    setLoading(true);
    const items: Transaction[] = [];
    const errors: string[] = [];
    await Promise.all(files.map(async (file, index) => {
      const form = new FormData();
      form.append("file", file);
      try {
        const response = await fetch(`${API_URL}/analyze-slip/`, { method: "POST", body: form, headers: { "ngrok-skip-browser-warning": "true" } });
        const payload = await response.json();
        if (!response.ok || payload.status !== "success") throw new Error(payload.detail ?? "วิเคราะห์ไม่สำเร็จ");
        items.push({ id: Date.now() + index, preview: previews[index]?.url ?? "", date: isoDay(Date.now()), ...payload.data, is_sample: false });
      } catch (error) {
        errors.push(DEMO_MODE ? "ระบบหลังบ้านยังไม่พร้อมใช้งาน โปรดติดต่อผู้พัฒนา" : `${file.name}: ${error instanceof Error ? error.message : "เชื่อมต่อ API ไม่ได้"}`);
      }
    }));
    if (items.length) {
      addTransactions(items);
      setFiles([]);
      setPreviews([]);
      setMenu("dashboard");
    }
    if (errors.length) setToast(errors[0]);
    setLoading(false);
  };

  const restoreSamples = () => {
    persist(SAMPLE_TRANSACTIONS);
    setPeriod("30");
    setBankFilter(ALL);
    setToast("คืนข้อมูลตัวอย่าง 100 รายการแล้ว");
  };

  const clearData = () => {
    if (!window.confirm("ล้างข้อมูลทั้งหมดออกจากเบราว์เซอร์ใช่ไหม?")) return;
    persist([]);
  };

  const navItem = (active: boolean) =>
    cx(active ? "text-emerald-700" : "text-gray-700 hover:text-gray-900", "flex w-full items-center gap-x-2.5 rounded-md px-2 py-1.5 text-left text-sm font-medium transition hover:bg-gray-100", focusRing);

  const shortcuts = [
    { label: "คืนข้อมูลตัวอย่าง", icon: RiRefreshLine, onClick: restoreSamples },
    { label: "ดาวน์โหลด CSV", icon: RiDownload2Line, href: "/data/slip-transactions.csv", download: true },
    { label: "ซอร์สโค้ดบน GitHub", icon: RiGithubLine, href: REPO_URL },
    { label: "ล้างข้อมูล", icon: RiDeleteBin6Line, onClick: clearData, danger: true },
  ];

  const windowLabel = range ? `${thaiDate(range.start)} – ${thaiDate(range.end)}` : "—";
  const compareLabel = range?.compare ? `${thaiDate(range.prevStart)} – ${thaiDate(range.prevEnd)}` : null;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* sidebar (lg+) */}
      <nav className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col" aria-label="เมนูหลัก">
        <aside className="flex grow flex-col gap-y-6 overflow-y-auto border-r border-gray-200 bg-white p-4">
          <div className="flex w-full items-center gap-x-2.5 rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm">
            <span className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-white p-0.5 ring-1 ring-gray-200">
              <Image src="/image_74b13d.png" alt="" width={64} height={35} className="h-auto w-full" priority />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-gray-900">SaiJai Analytics</span>
              <span className="block truncate text-xs text-gray-700">ข้อมูลตัวอย่าง · เดโม</span>
            </span>
          </div>

          <div className="flex flex-1 flex-col space-y-10">
            <ul role="list" className="space-y-0.5">
              {NAVIGATION.map((item) => (
                <li key={item.id}>
                  <button onClick={() => setMenu(item.id)} aria-current={menu === item.id ? "page" : undefined} className={navItem(menu === item.id)}>
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
            <div>
              <span className="text-xs font-medium leading-6 text-gray-500">ทางลัด</span>
              <ul role="list" className="space-y-0.5">
                {shortcuts.map((s) => {
                  const cls = cx(s.danger ? "text-red-600 hover:text-red-700" : "text-gray-700 hover:text-gray-900", "flex w-full items-center gap-x-2.5 rounded-md px-2 py-1.5 text-left text-sm font-medium transition hover:bg-gray-100", focusRing);
                  const body = <><s.icon className="size-4 shrink-0" aria-hidden />{s.label}</>;
                  return <li key={s.label}>{s.href ? <a href={s.href} download={s.download || undefined} className={cls}>{body}</a> : <button onClick={s.onClick} className={cls}>{body}</button>}</li>;
                })}
              </ul>
            </div>
          </div>

          <a href={DEVELOPER_CONTACT} className={cx("mt-auto flex items-center gap-x-2.5 rounded-md p-2 text-sm font-medium text-gray-900 hover:bg-gray-100", focusRing)}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700"><RiMailLine className="size-4" aria-hidden /></span>
            <span><span className="block">ติดต่อผู้พัฒนา</span><span className="block text-xs font-normal text-gray-500">สอบถามหรือขอทดลองระบบจริง</span></span>
          </a>
        </aside>
      </nav>

      {/* top bar (below lg) */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Image src="/image_74b13d.png" alt="" width={52} height={28} className="h-7 w-auto" priority />
            <span className="text-sm font-semibold">SaiJai Analytics</span>
          </div>
          <a href={DEVELOPER_CONTACT} className="text-sm font-medium text-emerald-700">ติดต่อผู้พัฒนา</a>
        </div>
        <div className="-mb-px flex gap-5 overflow-x-auto px-4 text-sm">
          {NAVIGATION.map((item) => (
            <button key={item.id} onClick={() => setMenu(item.id)} className={cx("whitespace-nowrap border-b-2 pb-2.5 pt-1 font-medium", menu === item.id ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-600")}>{item.label}</button>
          ))}
        </div>
      </div>

      <main className="lg:pl-72">
        <div className="mx-auto max-w-screen-2xl p-4 sm:px-6 sm:pb-10 sm:pt-8 lg:px-10 lg:pt-7">
          {DEMO_MODE && (
            <div className="mb-8">
              <Callout>
                <span className="font-semibold">เว็บไซต์นี้เป็นเว็บจำลองสำหรับสาธิตเท่านั้น</span> ระบบหลังบ้านสำหรับวิเคราะห์สลิปยังไม่พร้อมใช้งาน ข้อมูลทั้งหมดเป็นข้อมูลตัวอย่างที่สร้างขึ้น ไม่ใช่ธุรกรรมจริง หากต้องการทดลองระบบจริง{" "}
                <a href={DEVELOPER_CONTACT} className="font-semibold underline underline-offset-2">โปรดติดต่อผู้พัฒนา</a>
              </Callout>
            </div>
          )}

          {menu === "dashboard" && (
            <>
              <section aria-labelledby="summary">
                <SectionTitle id="summary">สรุปช่วงที่เลือก</SectionTitle>
                <p className="mt-1 text-sm text-gray-500">{windowLabel}{compareLabel ? ` · เทียบกับ ${compareLabel}` : ""}</p>
                <dl className="mt-6 grid grid-cols-1 gap-14 sm:mt-8 sm:grid-cols-2 xl:grid-cols-3">
                  {/* categories */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <dt className="font-bold text-gray-900 sm:text-sm">หมวดค่าใช้จ่าย</dt>
                        {topCategory && <ChangeBadge value={change(topCategory.value, prevCategories.has(topCategory.name) ? prevCategories.get(topCategory.name)! : range?.compare ? 0 : null)} />}
                      </div>
                      <dd className="mt-2 flex items-baseline gap-2">
                        <span className="text-xl text-gray-900">{topCategory && total ? percent(topCategory.value / total) : "—"}</span>
                        <span className="text-sm text-gray-500">{topCategory ? `ของยอดรวมเป็น${topCategory.name}` : "ยังไม่มีข้อมูล"}</span>
                      </dd>
                      <ul role="list" className="mt-4 space-y-5">
                        {categories.slice(0, 3).map((c) => (
                          <li key={c.name}>
                            <p className="flex justify-between text-sm"><span className="font-medium text-gray-900">{c.name}</span><span className="font-medium text-gray-900">{baht(c.value)}<span className="font-normal text-gray-500"> / {baht(total)}</span></span></p>
                            <ProgressBar value={c.value} max={total} />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-6 text-xs text-gray-500">ดูรายการแยกตามหมวดได้ใน <button onClick={() => setMenu("history")} className="text-emerald-700 hover:underline">หน้ารายการ</button></p>
                  </div>

                  {/* banks */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <dt className="font-bold text-gray-900 sm:text-sm">ธนาคาร</dt>
                        {topBank && <ChangeBadge value={change(topBank.value, prevBankTotals.has(topBank.name) ? prevBankTotals.get(topBank.name)! : range?.compare ? 0 : null)} />}
                      </div>
                      <dd className="mt-2 flex items-baseline gap-2">
                        <span className="text-xl text-gray-900">{topBank ? BANK_NAMES[topBank.name] ?? topBank.name : "—"}</span>
                        <span className="text-sm text-gray-500">{topBank ? `ยอดสูงสุด ${topBank.count} รายการ` : ""}</span>
                      </dd>
                      <ul role="list" className="mt-4 space-y-5">
                        {bankTotals.slice(0, 3).map((b) => (
                          <li key={b.name}>
                            <p className="flex justify-between text-sm"><span className="font-medium text-gray-900">{BANK_NAMES[b.name] ?? b.name}</span><span className="font-medium text-gray-900">{baht(b.value)}<span className="font-normal text-gray-500"> · {b.count} รายการ</span></span></p>
                            <ProgressBar value={b.value} max={total} color="bg-gray-500" track="bg-gray-200" />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-6 text-xs text-gray-500">ข้อมูลครอบคลุม {banks.length} ธนาคาร</p>
                  </div>

                  {/* total with stacked bar */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 sm:text-sm">ยอดใช้จ่าย</h3>
                        <ChangeBadge value={change(total, prevTotal)} />
                      </div>
                      <p className="mt-2 flex items-baseline gap-2">
                        <span className="text-xl text-gray-900">{baht(total)}</span>
                        <span className="text-sm text-gray-500">{current.length} รายการในช่วงที่เลือก</span>
                      </p>
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-900">สัดส่วนตามหมวด</p>
                        <div className="mt-2 flex items-center gap-0.5">
                          {stack.map((s, i) => <div key={s.name} className={cx(STACK_COLORS[i], "h-1.5 rounded-full")} style={{ width: `${total ? (s.value / total) * 100 : 0}%` }} />)}
                        </div>
                      </div>
                      <ul role="list" className="mt-5 space-y-2">
                        {stack.map((s, i) => (
                          <li key={s.name} className="flex items-center gap-2 text-xs">
                            <span className={cx(STACK_COLORS[i], "size-2.5 rounded-sm")} aria-hidden />
                            <span className="text-gray-900">{s.name}</span>
                            <span className="text-gray-600">({baht(s.value)} / {total ? percent(s.value / total) : "0%"})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-6 text-xs text-gray-500">{prevTotal !== null ? `ช่วงก่อนหน้าใช้ไป ${baht(prevTotal)}` : "เลือกช่วง 7, 30 หรือ 45 วันเพื่อเทียบกับช่วงก่อนหน้า"}</p>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="daily">
                <SectionTitle id="daily" className="mt-16">รายวัน</SectionTitle>
                <div className="sticky top-[5.75rem] z-20 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white pb-4 pt-4 sm:pt-6 lg:top-0 lg:pt-8">
                  <div className="flex overflow-hidden rounded-md border border-gray-300 shadow-sm">
                    {PERIODS.map((p) => (
                      <button key={p.id} onClick={() => setPeriod(p.id)} className={cx("px-3 py-1.5 text-sm font-medium [&:not(:first-child)]:border-l [&:not(:first-child)]:border-gray-300", period === p.id ? "bg-gray-100 text-gray-900" : "bg-white text-gray-600 hover:bg-gray-50", focusRing)}>{p.label}</button>
                    ))}
                  </div>
                  <select aria-label="ธนาคาร" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className={inputClass}>
                    <option value={ALL}>ทุกธนาคาร</option>
                    {banks.map((b) => <option key={b} value={b}>{BANK_NAMES[b] ?? b}</option>)}
                  </select>
                  <span className="text-sm text-gray-500">{compareLabel ? <>เทียบกับ <span className="font-medium text-gray-700">ช่วงก่อนหน้า</span></> : "ไม่เทียบช่วงก่อนหน้า"}</span>
                </div>
                <dl className="mt-10 grid grid-cols-1 gap-14 md:grid-cols-2 xl:grid-cols-3">
                  {series.map((m) => {
                    const fmt = m.kind === "money" ? (v: number) => baht(v) : count;
                    return (
                      <div key={m.title}>
                        <div className="flex items-center gap-x-2">
                          <dt className="font-bold text-gray-900 sm:text-sm">{m.title}</dt>
                          <ChangeBadge value={m.change} />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <dd className="text-xl text-gray-900">{fmt(m.value)}</dd>
                          {m.prevValue !== null && <dd className="text-sm text-gray-500">จาก {fmt(m.prevValue)}</dd>}
                        </div>
                        <div className="mt-6 h-32">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={m.data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                              <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="0" />
                              <XAxis dataKey="label" ticks={m.data.length ? [m.data[0].label, m.data[m.data.length - 1].label] : []} interval="preserveStartEnd" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                              <YAxis hide domain={["auto", "auto"]} />
                              <Tooltip formatter={(v, name) => [fmt(Number(v)), name === "previous" ? "ช่วงก่อนหน้า" : "ช่วงนี้"]} contentStyle={{ borderRadius: 6, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgb(0 0 0 / .05)", fontSize: 13 }} />
                              {range?.compare && <Line dataKey="previous" stroke="#9ca3af" strokeWidth={2} dot={false} isAnimationActive={false} />}
                              <Line dataKey="value" stroke="#059669" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </dl>
              </section>

              <section aria-labelledby="latest">
                <div className="mt-16 flex items-baseline justify-between">
                  <SectionTitle id="latest">รายการล่าสุด</SectionTitle>
                  <button onClick={() => setMenu("history")} className="text-sm font-medium text-emerald-700 hover:underline">ดูทั้งหมด</button>
                </div>
                <div className="mt-4">{current.length ? <TransactionTable rows={current.slice(0, 8)} /> : <p className="py-10 text-center text-sm text-gray-500">ไม่มีรายการในช่วงที่เลือก</p>}</div>
              </section>
            </>
          )}

          {menu === "history" && (
            <section aria-labelledby="history">
              <SectionTitle id="history">รายการ</SectionTitle>
              <p className="mt-1 text-sm text-gray-500">แสดง {count(history.length)} จาก {count(transactions.length)} รายการ</p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1 sm:max-w-sm">
                  <RiSearchLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหารายการ ผู้รับ ธนาคาร หรือเลขอ้างอิง" className={cx(inputClass, "w-full pl-8")} />
                </div>
                <select aria-label="หมวด" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}>
                  <option value={ALL}>ทุกหมวด</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="mt-4">{history.length ? <TransactionTable rows={history} showConfidence /> : <p className="py-10 text-center text-sm text-gray-500">ไม่พบรายการที่ตรงกับเงื่อนไข</p>}</div>
            </section>
          )}

          {menu === "upload" && (
            <section aria-labelledby="upload" className="max-w-2xl">
              <SectionTitle id="upload">เพิ่มสลิป</SectionTitle>
              <p className="mt-1 text-sm text-gray-500">ระบบอ่านข้อความจากสลิปด้วย OCR แล้วจัดหมวดค่าใช้จ่ายให้อัตโนมัติ</p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles([...e.dataTransfer.files]); }}
                className={cx("mt-6 flex w-full flex-col items-center rounded-md border border-dashed px-6 py-12 text-center transition", dragging ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-gray-400", focusRing)}
              >
                <input ref={fileInput} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles([...(e.target.files ?? [])])} />
                <RiUploadCloud2Line className="size-8 text-gray-400" aria-hidden />
                <p className="mt-3 text-sm font-medium text-gray-900">คลิกเพื่อเลือกไฟล์ <span className="font-normal text-gray-500">หรือลากสลิปมาวาง</span></p>
                <p className="mt-1 text-xs text-gray-500">JPG, PNG หรือ WebP ไม่เกิน 10 MB ต่อไฟล์</p>
              </button>
              {!!previews.length && (
                <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {previews.map((p) => (
                    <li key={p.url} className="overflow-hidden rounded-md border border-gray-200">
                      {/* User-selected object URLs cannot be optimized by next/image. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.name} className="aspect-square w-full object-cover" />
                      <p className="truncate px-2 py-1 text-xs text-gray-600">{p.name}</p>
                    </li>
                  ))}
                </ul>
              )}
              {!!files.length && (
                <button onClick={handleUpload} disabled={loading} className={cx("mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:bg-gray-300", focusRing)}>
                  {loading ? "กำลังวิเคราะห์…" : `วิเคราะห์ ${files.length} สลิป`}
                </button>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
