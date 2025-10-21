import React, { useEffect, useMemo, useState } from "react";
import {
  Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Loader2, ShieldCheck, Wallet, Gift, Info,
} from "lucide-react";

/** ===== ENV / hosts ===== */
const RAW_ADMIN =
  (typeof process !== "undefined" &&
    (process as any)?.env?.NEXT_PUBLIC_BITCART_ADMIN_URL) ||
  "https://pay.bybitpay.pro";

// БАЗА АДМИНКИ (с /admin) — нужна для правильной ссылки на инвойс
const ADMIN_BASE = RAW_ADMIN.replace(/\/+$/, "");

/** ===== small helpers ===== */
const save = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const load = <T,>(k: string, d: T): T => { try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : d; } catch { return d; } };

function guessUsername() {
  try {
    const tg = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.username;
    if (tg) return tg;
  } catch {}
  try {
    const k = localStorage.getItem("byvc.currentUser") || localStorage.getItem("byvc.lastUser");
    if (k) return k;
  } catch {}
  return "guest";
}

function readDB() {
  try {
    return JSON.parse(localStorage.getItem("byvc.db") ?? '{"users":{}}') as { users: Record<string, any> };
  } catch {
    return { users: {} };
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
function statusLabel(s: string) {
  switch (s) {
    case "pending": return "Ожидает оплаты";
    case "confirmed": return "Оплачено";
    case "expired": return "Счёт истёк";
    case "cancelled": return "Отменён";
    default: return "Новый";
  }
}

/** Надёжная нормализация времени истечения инвойса */
function normalizeExpiry(expiresAt: any): number {
  if (!expiresAt) return Date.now() + 15 * 60 * 1000;
  if (typeof expiresAt === "number") {
    // если секунды — домножим на 1000
    return expiresAt < 1e12 ? expiresAt * 1000 : expiresAt;
  }
  if (typeof expiresAt === "string") {
    const t = Date.parse(expiresAt);
    if (!Number.isNaN(t)) return t;
    const asNum = Number(expiresAt);
    if (Number.isFinite(asNum)) return asNum < 1e12 ? asNum * 1000 : asNum;
  }
  return Date.now() + 15 * 60 * 1000;
}

/** ===== networks (TRC20 only) ===== */
const networks = [{ code: "TRC20", fee: 1, eta: "~3–5 мин" }];

/** ============ MAIN APP ============ */
export default function PaymentsApp() {
  const [tab, setTab] = useState("deposit");
  return (
    <div className="min-h-screen w-full bg-[#0f1115] text-neutral-100 p-4">
      <header className="max-w-md mx-auto flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-[#F5A623]/15 grid place-items-center">
            <Wallet className="h-5 w-5 text-[#F5A623]" />
          </div>
          <div>
            <div className="text-xs text-neutral-400">BYBIT VC</div>
            <div className="font-semibold">Платёжный модуль</div>
          </div>
        </div>
        <Badge className="rounded-full bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/40">
          Prototype
        </Badge>
      </header>

      <main className="max-w-md mx-auto">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full rounded-2xl bg-black/60 border border-[#262b36] backdrop-blur mb-4">
            <TabsTrigger value="deposit">Пополнение</TabsTrigger>
            <TabsTrigger value="withdraw">Вывод</TabsTrigger>
          </TabsList>

        <TabsContent value="deposit"><DepositBitcart /></TabsContent>
        <TabsContent value="withdraw"><WithdrawMock /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/** ===== инфо-панель бонусов/активации (вернул внутри файла) ===== */
function BonusActivationPanel({ amount, isFirst }: { amount: number; isFirst: boolean }) {
  const lt100 = amount < 100;
  const gte100 = amount >= 100;
  const gte500 = amount >= 500;
  const tier = isFirst ? (gte500 ? 200 : gte100 ? 100 : 0) : 0;
  const bonus = tier ? +((amount * tier) / 100).toFixed(2) : 0;
  const total = +(amount + bonus).toFixed(2);

  const Row = ({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) => (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div className="text-sm text-neutral-200">{text}</div>
    </div>
  );

  return (
    <Card className="rounded-2xl bg-[#1b2029] border-[#2a2f3a]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isFirst ? <Gift className="h-4 w-4 text-[#F5A623]" /> : <Info className="h-4 w-4 text-neutral-400" />}
            {isFirst ? "Бонус к первому пополнению" : "Повторное пополнение"}
          </CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {isFirst ? (tier ? `+${tier}%` : "Бонус доступен") : "Бонус уже использован"}
          </Badge>
        </div>
        <CardDescription className="text-neutral-400">
          {isFirst
            ? "Кэшбэк 20% на все покупки. Карта активируется после зачисления."
            : "Кэшбэк 20% действует. Карта уже активна."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isFirst ? (
          <>
            <Row icon={<Gift className="h-4 w-4 text-neutral-400" />} text={<>При первом пополнении от <b>100 USDT</b> начислим <b>+100%</b>.</>} />
            <Row icon={<Gift className="h-4 w-4 text-neutral-400" />} text={<>Если первое пополнение <b>≥500 USDT</b> — начислим <b>+200%</b>.</>} />
          </>
        ) : (
          <>
            <Row icon={<Info className="h-4 w-4 text-neutral-400" />} text={<>Бонус первого пополнения уже был начислен ранее.</>} />
            <Row icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />} text={<>Кэшбэк <b>20%</b> действует на все покупки.</>} />
          </>
        )}

        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="rounded-xl bg-black/30 px-3 py-2">
            <div className="text-[11px] text-neutral-400">Ваше пополнение</div>
            <div className="text-sm font-semibold text-white">{amount.toFixed(2)} USDT</div>
          </div>
          <div className="rounded-xl bg-black/30 px-3 py-2">
            <div className="text-[11px] text-neutral-400">Бонус</div>
            <div className="text-sm font-semibold text-white">{bonus.toFixed(2)} USDT</div>
          </div>
          <div className="rounded-xl bg-[#F5A623]/20 border border-[#F5A623]/40 px-3 py-2">
            <div className="text-[11px] text-[#F5A623]">Итого на карте</div>
            <div className="text-base font-bold text-white">{total.toFixed(2)} USDT</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** ====== Deposit (создание счёта → открыть инвойс) ====== */
function DepositBitcart() {
  const username = guessUsername();
  const db = readDB();
  const rec = db.users?.[username];
  const bonusAlreadyApplied = !!rec?.bonuses?.firstBonusApplied;
  const isFirstEligible = !bonusAlreadyApplied;

  const [amount, setAmount] = useState<number>(load("byvc.pay.amount", 100));
  const [creating, setCreating] = useState(false);
  const [invoice, setInvoice] = useState<any>(load("byvc.pay.invoice", null));
  const [status, setStatus] = useState<string>(load("byvc.pay.status", "idle"));
  const [expiresAt, setExpiresAt] = useState<number>(load("byvc.pay.expiresAt", 0));
  const [success, setSuccess] = useState<null | { amount: number }>(null);

  useEffect(() => save("byvc.pay.amount", amount), [amount]);
  useEffect(() => save("byvc.pay.invoice", invoice), [invoice]);
  useEffect(() => save("byvc.pay.status", status), [status]);
  useEffect(() => save("byvc.pay.expiresAt", expiresAt), [expiresAt]);

  // таймер
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = useMemo(() => (expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0), [expiresAt, now]);
  useEffect(() => {
    if (!expiresAt) return;
    if (secs === 0 && status === "pending") setStatus("expired");
  }, [secs, expiresAt, status]);

  // поллинг статуса
  useEffect(() => {
    if (!invoice?.id || status !== "pending") return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/invoices/${invoice.id}`);
        if (!res.ok) return;
        const d = await res.json();
        const st = (d.status || d.payment_status || d.state || "").toLowerCase();
        if (st.includes("confirmed") || st.includes("paid")) {
          setStatus("confirmed");
          setSuccess({ amount: Number(invoice.amount || 0) });
          stop = true;
        }
      } catch {}
    };
    const t = setInterval(() => !stop && poll(), 5000);
    poll();
    return () => { stop = true; clearInterval(t); };
  }, [invoice?.id, status, invoice?.amount]);

  const createInvoice = async () => {
    setCreating(true);
    try {
      const payload = {
        price: Number(amount || 0),
        currency: "USDT",
        username,
        network: "TRC20",
        metadata: { username, network: "TRC20" },
      };
      const res = await fetch("/api/payments/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create invoice");
      const inv = await res.json();

      const ttl = normalizeExpiry(inv?.expiresAt || inv?.expiration || inv?.expires_at);

      setInvoice({
        id: inv.id,
        amount: inv.price ?? amount,
        ccy: inv.currency ?? "USDT",
        payUrl: inv.payUrl || null,
      });
      setStatus("pending");
      setExpiresAt(ttl);
    } catch (e) {
      console.error("create invoice error:", e);
      alert("Не удалось создать счёт. Попробуйте ещё раз.");
    } finally {
      setCreating(false);
    }
  };

  // ссылка на инвойс: АДМИН-URL (/admin/i/<id>)
  const invoiceUrl = useMemo(() => {
    if (!invoice?.id) return null;
    if (invoice?.payUrl) return invoice.payUrl; // если Bitcart вернул прямую ссылку — используем её
    return `${ADMIN_BASE}/i/${invoice.id}`;
  }, [invoice?.id, invoice?.payUrl]);

  const openInvoice = () => {
    if (!invoice?.id || !invoiceUrl) return;
    window.open(invoiceUrl, "_blank", "noopener,noreferrer");
  };

  const cancel = () => {
    setStatus("cancelled");
    setInvoice(null);
    setExpiresAt(0);
  };

  const onCloseSuccess = () => {
    setSuccess(null);
    setInvoice(null);
    setStatus("idle");
    setExpiresAt(0);
  };

  const visibleAmount = invoice ? Number(invoice.amount || 0) : Number(amount || 0);

  return (
    <div className="space-y-4">
      <BonusActivationPanel amount={visibleAmount} isFirst={isFirstEligible} />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Пополнение через Bitcart</CardTitle>
            <Badge className="rounded-full bg-white/10">@{username}</Badge>
          </div>
          <CardDescription className="text-neutral-400">
            Выберите сумму и создайте счёт
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {!invoice && (
            <>
              <div className="grid grid-cols-1 gap-2">
                <div className="text-sm text-neutral-400">Сеть</div>
                <div className="flex gap-2">
                  <Button disabled className="rounded-xl bg-[#F5A623] text-black">
                    {networks[0].code}
                  </Button>
                </div>
                <div className="text-xs text-neutral-500">
                  Комиссия ~{networks[0].fee} USDT • {networks[0].eta}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Сумма (USDT)</Label>
                <Input
                  type="number"
                  className="rounded-xl bg-black/40 border-[#2a2f3a] text-white placeholder:text-neutral-400"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>

              <Button
                disabled={creating || amount <= 0}
                onClick={createInvoice}
                className="w-full rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700"
              >
                {creating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Создание счёта...</>) : (<>Создать счёт</>)}
              </Button>
            </>
          )}

          {invoice && (
            <>
              <div className="rounded-2xl p-3 bg-black/40 border border-[#2a2f3a] flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-400">Статус</div>
                  <div className="text-sm font-semibold">{statusLabel(status)}</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-300">
                  <Clock className="h-4 w-4" />
                  {pad(Math.floor(secs / 60))}:{pad(secs % 60)}
                </div>
              </div>

              <div className="rounded-2xl p-4 bg-black/40 border border-[#2a2f3a]">
                <div className="text-xs text-neutral-400">Сумма к оплате</div>
                <div className="text-base font-semibold">
                  {Number(invoice.amount || 0).toFixed(2)} USDT • TRC20
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={openInvoice} className="rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]">
                  Перейти к оплате
                </Button>
                <Button onClick={cancel} variant="secondary" className="rounded-2xl">
                  Отменить
                </Button>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="text-xs text-neutral-400">
          После подтверждения сети баланс будет зачислен через вебхук.
        </CardFooter>
      </Card>

      {success && (
        <SuccessModal open={!!success} onClose={onCloseSuccess} amount={success.amount} />
      )}
    </div>
  );
}

/** ===== простая модалка об успешной оплате ===== */
function SuccessModal({ open, onClose, amount }: { open: boolean; onClose: () => void; amount: number }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-[#141821] border border-[#2a2f3a] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-semibold">Оплата подтверждена</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-200">✕</button>
        </div>
        <div className="space-y-2 text-sm text-neutral-200">
          <div className="flex items-center justify-between">
            <span>Сумма</span>
            <span className="font-semibold text-white">{amount.toFixed(2)} USDT</span>
          </div>
          <div className="text-xs text-neutral-300">Средства будут зачислены автоматически.</div>
        </div>
        <div className="mt-4">
          <Button onClick={onClose} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700">Ок</Button>
        </div>
      </div>
    </div>
  );
}

/** ===== Вывод (демо) ===== */
function WithdrawMock() {
  const [amount, setAmount] = useState<number>(50);
  const [addr, setAddr] = useState<string>("");
  const [status, setStatus] = useState<string>("idle");

  const submit = () => {
    if (!addr || amount <= 0) { alert("Заполните адрес и сумму"); return; }
    setStatus(amount <= 100 ? "sent" : "manual");
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle>Вывод средств</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <Label>Адрес (TRC20)</Label>
          <Input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Вставьте адрес кошелька"
            className="rounded-xl bg-black/40 border-[#2a2f3a] text-white placeholder:text-neutral-400"
          />
        </div>
        <div className="grid gap-2">
          <Label>Сумма (USDT)</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="rounded-xl bg-black/40 border-[#2a2f3a] text-white placeholder:text-neutral-400"
          />
        </div>
        <Button onClick={submit} className="rounded-2xl h-12">Подтвердить</Button>
        {status !== "idle" && (
          <div className="text-xs text-neutral-300">
            Статус: {status === "sent" ? "Отправлено" : "Ожидает ручной проверки"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
