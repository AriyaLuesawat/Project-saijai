"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

type Menu = "dashboard" | "upload" | "history";
type Period = "30" | "90" | "all";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DB_KEY = "saijai_database_v2";
const SAMPLE_TRANSACTIONS = sampleData as Transaction[];

const CATEGORY_COLORS: Record<string, string> = {
  "ค่าอาหาร": "#10b981",
  "ค่าเดินทาง": "#f59e0b",
  "ค่าสาธารณูปโภค": "#3b82f6",
  "ค่าของใช้": "#f43f5e",
  "โอนเงิน": "#8b5cf6",
  "ทำบุญ/บริจาค": "#06b6d4",
  "ความบันเทิง": "#ec4899",
  "สุขภาพ/ความงาม": "#84cc16",
  "อื่นๆ": "#64748b",
};

const BANK_COLORS: Record<string, string> = {
  KBank: "#159c62",
  SCB: "#6f2c91",
  KTB: "#11a8e2",
  BBL: "#1e3a8a",
  BAY: "#f4c430",
};

const NAV_ITEMS: { id: Menu; icon: string; label: string }[] = [
  { id: "dashboard", icon: "◫", label: "ภาพรวม" },
  { id: "upload", icon: "↑", label: "อัปโหลดสลิป" },
  { id: "history", icon: "≡", label: "รายการทั้งหมด" },
];

const CATEGORIES = Object.keys(CATEGORY_COLORS);

function amountOf(transaction: Transaction): number {
  return Number.parseFloat(transaction.amount.replace(/,/g, "")) || 0;
}

function formatMoney(value: number | string, digits = 0): string {
  const number = typeof value === "string" ? Number.parseFloat(value.replace(/,/g, "")) : value;
  return (Number.isFinite(number) ? number : 0).toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(value: string, compact = false): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: compact ? "short" : "long",
    year: compact ? undefined : "numeric",
  }).format(date);
}

function bankCode(transaction: Transaction): string {
  return transaction.bank_code ?? transaction.bank_name.split(" ")[0];
}

function aggregate(transactions: Transaction[], getKey: (transaction: Transaction) => string) {
  const values = new Map<string, { value: number; count: number }>();
  transactions.forEach((transaction) => {
    const key = getKey(transaction);
    const current = values.get(key) ?? { value: 0, count: 0 };
    values.set(key, { value: current.value + amountOf(transaction), count: current.count + 1 });
  });
  return [...values.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.value - a.value);
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timeout);
  }, [onClose]);

  return <div role="alert" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-2xl">{message}</div>;
}

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? "#64748b";
  return <span className="rounded-full border px-2.5 py-1 text-[10px] font-bold" style={{ color, borderColor: `${color}35`, backgroundColor: `${color}12` }}>{category}</span>;
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const code = bankCode(transaction);
  return (
    <article className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      {transaction.preview ? (
        // User-selected images use temporary object URLs and cannot use next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={transaction.preview} alt="ภาพสลิป" className="h-12 w-12 rounded-xl object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-xs font-black text-white" style={{ backgroundColor: BANK_COLORS[code] ?? "#475569" }}>{code}</div>
      )}
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <CategoryBadge category={transaction.category} />
          {transaction.is_sample && <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">demo</span>}
        </div>
        <p className="truncate text-sm font-extrabold text-slate-800">{transaction.memo}</p>
        <p className="truncate text-xs text-slate-400">{transaction.recipient} · {formatDate(transaction.date, true)}</p>
      </div>
      <div className="text-right">
        <p className="font-black text-slate-900">฿{formatMoney(transaction.amount, 2)}</p>
        <p className="mt-1 text-[10px] font-bold text-slate-400">AI {Math.round(transaction.confidence * 100)}%</p>
      </div>
    </article>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-400">{children}</div>;
}

export default function Home() {
  const [activeMenu, setActiveMenu] = useState<Menu>("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>(SAMPLE_TRANSACTIONS);
  const [period, setPeriod] = useState<Period>("all");
  const [bankFilter, setBankFilter] = useState("ทั้งหมด");
  const [categoryFilter, setCategoryFilter] = useState("ทั้งหมด");
  const [searchQuery, setSearchQuery] = useState("");
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
      setToast("ไม่สามารถอ่านข้อมูลที่บันทึกไว้ได้ จึงแสดงชุดข้อมูลตัวอย่างแทน");
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
  const latestDate = useMemo(() => transactions.reduce((latest, item) => item.date > latest ? item.date : latest, ""), [transactions]);
  const dashboardTransactions = useMemo(() => {
    let result = bankFilter === "ทั้งหมด" ? transactions : transactions.filter((item) => bankCode(item) === bankFilter);
    if (period !== "all" && latestDate) {
      const cutoff = new Date(`${latestDate.slice(0, 10)}T00:00:00`);
      cutoff.setDate(cutoff.getDate() - Number(period) + 1);
      result = result.filter((item) => new Date(`${item.date.slice(0, 10)}T00:00:00`) >= cutoff);
    }
    return result;
  }, [bankFilter, latestDate, period, transactions]);

  const categoryData = useMemo(() => aggregate(dashboardTransactions, (item) => item.category), [dashboardTransactions]);
  const bankData = useMemo(() => aggregate(dashboardTransactions, bankCode), [dashboardTransactions]);
  const trendData = useMemo(() => aggregate(dashboardTransactions, (item) => item.date).sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({ ...item, label: formatDate(item.name, true) })), [dashboardTransactions]);
  const total = dashboardTransactions.reduce((sum, item) => sum + amountOf(item), 0);
  const average = dashboardTransactions.length ? total / dashboardTransactions.length : 0;
  const highest = dashboardTransactions.reduce((max, item) => Math.max(max, amountOf(item)), 0);

  const historyTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return transactions.filter((item) => {
      const categoryMatches = categoryFilter === "ทั้งหมด" || item.category === categoryFilter;
      const searchMatches = !query || [item.memo, item.recipient, item.bank_name, item.reference ?? ""].some((value) => value.toLowerCase().includes(query));
      return categoryMatches && searchMatches;
    });
  }, [categoryFilter, searchQuery, transactions]);

  const handleFiles = useCallback((selected: File[]) => {
    const valid = selected.filter((file) => file.type.startsWith("image/"));
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setFiles(valid);
    setPreviews(valid.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })));
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
        items.push({ id: Date.now() + index, preview: previews[index]?.url ?? "", date: new Date().toISOString().slice(0, 10), ...payload.data, is_sample: false });
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "เชื่อมต่อ API ไม่ได้"}`);
      }
    }));
    if (items.length) {
      addTransactions(items);
      setFiles([]);
      setPreviews([]);
      setActiveMenu("dashboard");
    }
    if (errors.length) setToast(errors[0]);
    setLoading(false);
  };

  const restoreSamples = () => {
    persist(SAMPLE_TRANSACTIONS);
    setPeriod("all");
    setBankFilter("ทั้งหมด");
    setToast("คืนข้อมูลตัวอย่าง 100 รายการแล้ว");
  };

  const clearData = () => {
    if (!window.confirm("ล้างข้อมูลทั้งหมดออกจากเบราว์เซอร์ใช่ไหม?")) return;
    persist([]);
  };

  const topCategory = categoryData[0];
  const topBank = bankData[0];

  return (
    <div className="min-h-screen bg-[#f3f6f4] text-slate-900">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#073f31] px-5 py-6 text-white lg:flex">
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-2xl">♡</div>
          <div><p className="text-xl font-black">ใส่ใจ</p><p className="text-[10px] uppercase tracking-[0.22em] text-emerald-300">expense intelligence</p></div>
        </div>
        <nav className="space-y-2">
          {NAV_ITEMS.map((item) => <button key={item.id} onClick={() => setActiveMenu(item.id)} className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-sm font-bold transition ${activeMenu === item.id ? "bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-950/30" : "text-emerald-100/70 hover:bg-white/5 hover:text-white"}`}><span className="text-xl">{item.icon}</span>{item.label}</button>)}
        </nav>
        <div className="mt-auto rounded-3xl border border-white/10 bg-black/15 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">ข้อมูลในระบบ</p>
          <p className="mt-2 text-3xl font-black">{transactions.length}</p>
          <p className="text-xs text-emerald-100/60">รายการจาก {banks.length} ธนาคาร</p>
          <a href="/data/slip-transactions.csv" download className="mt-4 block rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold hover:bg-white/15">ดาวน์โหลด CSV</a>
        </div>
      </aside>

      <main className="pb-24 lg:ml-64 lg:pb-0">
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between border-b border-slate-200/80 bg-[#f3f6f4]/90 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">SaiJai Analytics</p><h1 className="text-xl font-black sm:text-2xl">{NAV_ITEMS.find((item) => item.id === activeMenu)?.label}</h1></div>
          <div className="flex gap-2"><button onClick={restoreSamples} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">คืนข้อมูลตัวอย่าง</button><button onClick={clearData} className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50">ล้างข้อมูล</button></div>
        </header>

        <div className="mx-auto max-w-7xl p-5 sm:p-8">
          {activeMenu === "dashboard" && (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[2rem] bg-[#073f31] p-6 text-white shadow-xl sm:p-8">
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                  <div>
                    <div className="mb-4 inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">Synthetic dataset · ไม่ใช่ธุรกรรมจริง</div>
                    <h2 className="max-w-2xl text-3xl font-black leading-tight sm:text-4xl">เข้าใจพฤติกรรมการใช้จ่าย<br />จากสลิปในที่เดียว</h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100/65">วิเคราะห์ข้อมูลตัวอย่าง 100 รายการ ครอบคลุม 5 ธนาคาร พร้อมตัวกรองและสรุปเชิงลึกแบบอัตโนมัติ</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select value={bankFilter} onChange={(event) => setBankFilter(event.target.value)} className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-bold outline-none"><option className="text-slate-900">ทั้งหมด</option>{banks.map((bank) => <option key={bank} className="text-slate-900">{bank}</option>)}</select>
                    <div className="flex rounded-xl bg-white/10 p-1">{(["30", "90", "all"] as Period[]).map((value) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${period === value ? "bg-emerald-400 text-emerald-950" : "text-white/65"}`}>{value === "all" ? "ทั้งหมด" : `${value} วัน`}</button>)}</div>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[["ยอดใช้จ่ายรวม", `฿${formatMoney(total)}`, `${dashboardTransactions.length} รายการ`], ["ค่าเฉลี่ยต่อสลิป", `฿${formatMoney(average)}`, "ต่อหนึ่งธุรกรรม"], ["รายการสูงสุด", `฿${formatMoney(highest)}`, topCategory?.name ?? "ยังไม่มีข้อมูล"], ["ธนาคารหลัก", topBank?.name ?? "–", topBank ? `${topBank.count} รายการ` : "ยังไม่มีข้อมูล"]].map(([label, value, note]) => <article key={label} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-3 text-2xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs font-semibold text-slate-400">{note}</p></article>)}
              </section>

              <section className="grid gap-6 xl:grid-cols-12">
                <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm xl:col-span-8">
                  <div className="mb-6"><p className="text-lg font-black">แนวโน้มยอดใช้จ่าย</p><p className="text-xs text-slate-400">ยอดรวมรายวันตามช่วงที่เลือก</p></div>
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ left: 0, right: 10 }}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" minTickGap={35} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`฿${formatMoney(Number(value), 2)}`, "ยอดใช้จ่าย"]} labelStyle={{ fontWeight: 800 }} contentStyle={{ border: 0, borderRadius: 16, boxShadow: "0 12px 30px rgb(15 23 42 / .12)" }} /><Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div>
                </article>
                <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm xl:col-span-4">
                  <p className="text-lg font-black">สัดส่วนหมวดหมู่</p><p className="text-xs text-slate-400">คำนวณจากยอดเงินรวม</p>
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="76%" paddingAngle={3} stroke="none">{categoryData.map((entry) => <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#64748b"} />)}</Pie><Tooltip formatter={(value) => [`฿${formatMoney(Number(value), 2)}`, "ยอดใช้จ่าย"]} contentStyle={{ border: 0, borderRadius: 16 }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
                </article>
              </section>

              <section className="grid gap-6 xl:grid-cols-12">
                <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm xl:col-span-7">
                  <p className="text-lg font-black">ยอดใช้จ่ายแยกธนาคาร</p><p className="mb-5 text-xs text-slate-400">เปรียบเทียบยอดรวมจากสลิปแต่ละธนาคาร</p>
                  <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={bankData}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`฿${formatMoney(Number(value), 2)}`, "ยอดใช้จ่าย"]} contentStyle={{ border: 0, borderRadius: 16 }} /><Bar dataKey="value" radius={[8, 8, 0, 0]}>{bankData.map((entry) => <Cell key={entry.name} fill={BANK_COLORS[entry.name] ?? "#64748b"} />)}</Bar></BarChart></ResponsiveContainer></div>
                </article>
                <article className="rounded-[2rem] bg-emerald-50 p-6 xl:col-span-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Automatic insight</p><h3 className="mt-3 text-2xl font-black text-emerald-950">สรุปสิ่งที่พบ</h3>
                  <div className="mt-5 space-y-3 text-sm leading-6 text-emerald-950/70"><p className="rounded-2xl bg-white/70 p-4">หมวด <strong>{topCategory?.name ?? "–"}</strong> มียอดสูงสุด ฿{formatMoney(topCategory?.value ?? 0)} คิดเป็น {total ? (((topCategory?.value ?? 0) / total) * 100).toFixed(1) : "0"}% ของยอดรวม</p><p className="rounded-2xl bg-white/70 p-4"><strong>{topBank?.name ?? "–"}</strong> เป็นธนาคารที่มียอดรวมสูงสุดจาก {topBank?.count ?? 0} รายการ</p><p className="rounded-2xl bg-white/70 p-4">ยอดเฉลี่ยต่อรายการอยู่ที่ <strong>฿{formatMoney(average)}</strong> และรายการสูงสุดอยู่ที่ ฿{formatMoney(highest)}</p></div>
                </article>
              </section>

              <section>
                <div className="mb-4 flex items-end justify-between"><div><h3 className="text-lg font-black">รายการล่าสุด</h3><p className="text-xs text-slate-400">อัปเดตจากข้อมูลในเบราว์เซอร์</p></div><button onClick={() => setActiveMenu("history")} className="text-xs font-bold text-emerald-700">ดูทั้งหมด →</button></div>
                <div className="grid gap-3 lg:grid-cols-2">{dashboardTransactions.slice(0, 6).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}</div>{!dashboardTransactions.length && <EmptyState>ไม่พบข้อมูลในช่วงที่เลือก</EmptyState>}
              </section>
            </div>
          )}

          {activeMenu === "upload" && (
            <section className="mx-auto max-w-2xl py-8"><div className="rounded-[2.5rem] border border-slate-100 bg-white p-7 shadow-xl sm:p-10">
              <div className="mb-8 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-4xl text-emerald-700">↑</div><h2 className="text-3xl font-black">เพิ่มสลิปใหม่</h2><p className="mt-2 text-sm text-slate-400">ระบบจะใช้ OCR และ AI เพื่อจัดหมวดหมู่อัตโนมัติ</p></div>
              <button type="button" onClick={() => fileInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFiles([...event.dataTransfer.files]); }} className={`w-full rounded-3xl border-2 border-dashed p-12 text-center transition ${dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40"}`}><input ref={fileInput} type="file" multiple accept="image/*" className="hidden" onChange={(event) => handleFiles([...(event.target.files ?? [])])} /><p className="text-4xl">▧</p><p className="mt-3 font-black text-slate-700">คลิกหรือลากไฟล์มาวาง</p><p className="mt-1 text-xs text-slate-400">JPG, PNG, WebP ขนาดไม่เกิน 10 MB</p></button>
              {!!previews.length && <div className="mt-5 grid grid-cols-3 gap-3">{previews.map((preview) => <div key={preview.url} className="overflow-hidden rounded-2xl bg-slate-100">
                {/* User-selected object URLs cannot be optimized by next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt={preview.name} className="aspect-square w-full object-cover" />
                <p className="truncate p-2 text-[10px] font-bold">{preview.name}</p>
              </div>)}</div>}
              {!!files.length && <button onClick={handleUpload} disabled={loading} className="mt-6 w-full rounded-2xl bg-[#073f31] py-4 font-black text-white shadow-lg disabled:bg-slate-300">{loading ? "กำลังวิเคราะห์..." : `วิเคราะห์ ${files.length} สลิป`}</button>}
            </div></section>
          )}

          {activeMenu === "history" && (
            <section className="space-y-5"><div className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row"><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ค้นหาผู้รับ รายการ ธนาคาร หรือเลขอ้างอิง..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none"><option>ทั้งหมด</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div><p className="mt-3 text-xs font-semibold text-slate-400">แสดง {historyTransactions.length} จาก {transactions.length} รายการ</p></div><div className="grid gap-3 lg:grid-cols-2">{historyTransactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}</div>{!historyTransactions.length && <EmptyState>ไม่พบรายการที่ตรงกับเงื่อนไข</EmptyState>}</section>
          )}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">{NAV_ITEMS.map((item) => <button key={item.id} onClick={() => setActiveMenu(item.id)} className={`flex flex-col items-center gap-1 py-3 text-[10px] font-bold ${activeMenu === item.id ? "text-emerald-700" : "text-slate-400"}`}><span className="text-lg">{item.icon}</span>{item.label}</button>)}</nav>
    </div>
  );
}
