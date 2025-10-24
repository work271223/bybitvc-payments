import React, { useEffect, useMemo, useState } from "react";
import {
  Card, CardHeader, CardContent, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Wallet, Gift, Info } from "lucide-react";

/** ===== ENV / hosts ===== */
const RAW_ADMIN =
  (typeof process !== "undefined" &&
    (process as any)?.env?.NEXT_PUBLIC_BITCART_ADMIN_URL) ||
  "https://pay.bybitpay.pro";

// Admin base (with /admin) — required for correct invoice link
const ADMIN_BASE = RAW_ADMIN.replace(/\/+$/, "");

/** ===== helpers ===== */
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

function statusLabel(s: string) {
  switch (s) {
    case "pending": return "Awaiting payment";
    case "confirmed": return "Paid";
    case "expired": return "Expired";
    case "cancelled": return "Cancelled";
    default: return "New";
  }
}

/** Normalize expiry date safely (kept for future use if needed) */
function normalizeExpiry(expiresAt: any): number {
  if (!expiresAt) return Date.now() + 15 * 60 * 1000;
  if (typeof expiresAt === "number") {
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

const networks = [{ code: "TRC20", fee: 1, eta: "~3–5 min" }];

export default function PaymentsApp() {
  const [tab, setTab] = useState("deposit");
  return (
    <div className="min-h-screen w-full bg-[#0f1115] text-neutral-100 p-4">
      <header className="max-w-md mx-auto flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-[#F5A623]/15 grid place-items-center">
            <Wallet className="h-5 w-5 text-[#F5A623]" />
          </div>
          <div className="font-semibold">Bybit Virtual Card</div>
        </div>
      </header>

      <main className="max-w-md mx-auto">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full rounded-2xl bg-black/60 border border-[#262b36] backdrop-blur mb-4">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit"><DepositBitcart /></TabsContent>
          <TabsContent value="withdraw"><WithdrawMock /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/** ===== Info panel (Bonuses & activation) ===== */
function BonusActivationPanel({ amount, isFirst }: { amount: number; isFirst: boolean }) {
  const gte100 = amount >= 100;
  const gte500 = amount >= 500;
  const tier = isFirst ? (gte500 ? 200 : gte100 ? 100 : 0) : 0;
  const bonus = tier ? +((amount * tier) / 100).toFixed(2) : 0;
  const total = +(amount + bonus).toFixed(2);
  const tier100TextClass = gte100 ? "text-emerald-300" : "text-neutral-200";
  const tier500TextClass = gte500 ? "text-emerald-300" : "text-neutral-200";
  const tier100IconClass = gte100 ? "text-emerald-300" : "text-neutral-400";
  const tier500IconClass = gte500 ? "text-emerald-300" : "text-neutral-400";

  return (
    <Card className="rounded-2xl bg-[#1b2029] border-[#2a2f3a]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isFirst ? <Gift className="h-4 w-4 text-[#F5A623]" /> : <Info className="h-4 w-4 text-neutral-400" />}
            {isFirst ? "First Deposit Bonus" : "Repeat Deposit"}
          </CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {isFirst ? (tier ? `+${tier}%` : "Bonus available") : "Bonus used"}
          </Badge>
        </div>
        <CardDescription className="text-neutral-400">
          {isFirst
            ? "20% cashback applies to all purchases. Card activates automatically after deposit."
            : "20% cashback active. Card already activated."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isFirst ? (
          <>
            <div className={`flex items-start gap-2 text-sm ${tier100TextClass}`}>
              <Gift className={`h-4 w-4 mt-0.5 ${tier100IconClass}`} />
              <span>
                On first deposit <b>&ge;100&nbsp;USDT</b> you get <b>+100%</b>.
              </span>
            </div>
            <div className={`flex items-start gap-2 text-sm ${tier500TextClass}`}>
              <Gift className={`h-4 w-4 mt-0.5 ${tier500IconClass}`} />
              <span>
                On first deposit <b>&ge;500&nbsp;USDT</b> — you get <b>+200%</b>.
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 text-sm text-neutral-200">
              <Info className="h-4 w-4 text-neutral-400 mt-0.5" />
              First deposit bonus already applied earlier.
            </div>
            <div className="flex items-start gap-2 text-sm text-neutral-200">
              <ShieldCheck className="h-4 w-4 text-emerald-300 mt-0.5" />
              Cashback <b>20%</b> is active for all purchases.
            </div>
          </>
        )}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="rounded-xl bg-black/30 px-3 py-2">
            <div className="text-[11px] text-neutral-400">Deposit</div>
            <div className="text-sm font-semibold text-white">{amount.toFixed(2)} USDT</div>
          </div>
          <div className="rounded-xl bg-black/30 px-3 py-2">
            <div className="text-[11px] text-neutral-400">Bonus</div>
            <div className="text-sm font-semibold text-white">{bonus.toFixed(2)} USDT</div>
          </div>
          <div className="rounded-xl bg-[#F5A623]/20 border border-[#F5A623]/40 px-3 py-2">
            <div className="text-[11px] text-[#F5A623]">Total on card</div>
            <div className="text-base font-bold text-white">{total.toFixed(2)} USDT</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** ===== Deposit with Bitcart ===== */
function DepositBitcart() {
  const username = guessUsername();
  const db = readDB();
  const rec = db.users?.[username];
  const bonusAlreadyApplied = !!rec?.bonuses?.firstBonusApplied;
  const isFirstEligible = !bonusAlreadyApplied;

  const [amount, setAmount] = useState<number>(load("byvc.pay.amount", 300));
  const [creating, setCreating] = useState(false);
  const [invoice, setInvoice] = useState<any>(load("byvc.pay.invoice", null));
  const [status, setStatus] = useState<string>(load("byvc.pay.status", "idle"));
  const [success, setSuccess] = useState<null | { amount: number }>(null);

  useEffect(() => save("byvc.pay.amount", amount), [amount]);
  useEffect(() => save("byvc.pay.invoice", invoice), [invoice]);
  useEffect(() => save("byvc.pay.status", status), [status]);

  // Polling status
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

      // Keep for potential logic; not used by UI (no timer).
      normalizeExpiry(inv?.expiresAt || inv?.expiration || inv?.expires_at);

      setInvoice({
        id: inv.id,
        amount: inv.price ?? amount,
        ccy: inv.currency ?? "USDT",
        payUrl: inv.payUrl || null,
      });
      setStatus("pending");
    } catch (e) {
      console.error("create invoice error:", e);
      alert("Failed to create invoice. Try again.");
    } finally {
      setCreating(false);
    }
  };

  // Use admin URL for invoices
  const invoiceUrl = useMemo(() => {
    if (!invoice?.id) return null;
    if (invoice?.payUrl) return invoice.payUrl;
    return `${ADMIN_BASE}/i/${invoice.id}`;
  }, [invoice?.id, invoice?.payUrl]);

  const openInvoice = () => {
    if (!invoice?.id || !invoiceUrl) return;
    window.open(invoiceUrl, "_blank", "noopener,noreferrer");
  };

  const openBybit = () => {
    window.open("https://www.bybit.com/", "_blank", "noopener,noreferrer");
  };

  const cancel = () => {
    setStatus("cancelled");
    setInvoice(null);
  };

  const onCloseSuccess = () => {
    setSuccess(null);
    setInvoice(null);
    setStatus("idle");
  };

  const visibleAmount = invoice ? Number(invoice.amount || 0) : Number(amount || 0);

  return (
    <div className="space-y-4">
      <BonusActivationPanel amount={visibleAmount} isFirst={isFirstEligible} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Deposit via Bitcart</CardTitle>
          <CardDescription className="text-neutral-400">
            Choose the amount and create an invoice
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {!invoice && (
            <>
              <div className="grid grid-cols-1 gap-2">
                <div className="text-sm text-neutral-400">Network</div>
                <div className="flex gap-2">
                  <Button className="rounded-xl bg-[#F5A623] text-black hover:bg-[#ffb739]">
                    {networks[0].code}
                  </Button>
                </div>
                <div className="text-xs text-neutral-500">
                  Fee ~{networks[0].fee} USDT • {networks[0].eta}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Amount (USDT)</Label>
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
                {creating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating invoice...</>) : (<>Create invoice</>)}
              </Button>
            </>
          )}

          {invoice && (
            <>
              <div className="rounded-2xl p-3 bg-black/40 border border-[#2a2f3a] flex items-center justify-between">
                <div>
                  <div className="text-xs text-neutral-400">Status</div>
                  <div className="text-sm font-semibold">{statusLabel(status)}</div>
                </div>
              </div>

              <div className="rounded-2xl p-4 bg-black/40 border border-[#2a2f3a]">
                <div className="text-xs text-neutral-400">Amount to pay</div>
                <div className="text-base font-semibold">
                  {Number(invoice.amount || 0).toFixed(2)} USDT • TRC20
                </div>
              </div>

              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={openInvoice} className="rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]">
                    Go to payment
                  </Button>
                  <Button onClick={cancel} variant="secondary" className="rounded-2xl">
                    Cancel
                  </Button>
                </div>
                <Button
                  onClick={openBybit}
                  className="rounded-2xl border border-[#2a2f3a] bg-black/40 text-white hover:bg-[#1f2532]"
                >
                  Open Bybit
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {success && (
        <SuccessModal open={!!success} onClose={onCloseSuccess} amount={success.amount} />
      )}
    </div>
  );
}

/** ===== Success Modal ===== */
function SuccessModal({ open, onClose, amount }: { open: boolean; onClose: () => void; amount: number }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-[#141821] border border-[#2a2f3a] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-semibold">Payment confirmed</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-200">✕</button>
        </div>
        <div className="space-y-2 text-sm text-neutral-200">
          <div className="flex items-center justify-between">
            <span>Amount</span>
            <span className="font-semibold text-white">{amount.toFixed(2)} USDT</span>
          </div>
          <div className="text-xs text-neutral-300">Funds will be credited automatically.</div>
        </div>
        <div className="mt-4">
          <Button onClick={onClose} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700">OK</Button>
        </div>
      </div>
    </div>
  );
}

/** ===== Withdraw (mock) ===== */
function WithdrawMock() {
  const [amount, setAmount] = useState<number>(50);
  const [addr, setAddr] = useState<string>("");
  const [status, setStatus] = useState<string>("idle");

  const submit = () => {
    if (!addr || amount <= 0) { alert("Enter address and amount"); return; }
    setStatus(amount <= 100 ? "sent" : "manual");
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle>Withdraw</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <Label>Address (TRC20)</Label>
          <Input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Paste wallet address"
            className="rounded-xl bg-black/40 border-[#2a2f3a] text-white placeholder:text-neutral-400"
          />
        </div>
        <div className="grid gap-2">
          <Label>Amount (USDT)</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="rounded-xl bg-black/40 border-[#2a2f3a] text-white placeholder:text-neutral-400"
          />
        </div>
        <Button onClick={submit} className="rounded-2xl h-12">Confirm</Button>
        {status !== "idle" && (
          <div className="text-xs text-neutral-300">
            Status: {status === "sent" ? "Sent" : "Pending manual review"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
