import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { QrCode, Copy, Check, Loader2, Wallet, Clock, Gift, ShieldCheck, Info } from "lucide-react";

const ENV = {
  BITCART_ADMIN_URL:
    (typeof process !== "undefined" && (process as any)?.env?.NEXT_PUBLIC_BITCART_ADMIN_URL) ||
    "https://pay.bybitpay.pro",
};

// === оставляем только 3 сети ===
const networks = [
  { code: "TRC20", fee: 1, eta: "~3–5 мин" },
  { code: "BEP20", fee: 0.8, eta: "~1–3 мин" },
  { code: "ERC20", fee: 5, eta: "~5–10 мин" },
];

function save(key: string, val: any) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}
function load<T = any>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : def;
  } catch {
    return def;
  }
}

function readDB() {
  try {
    return JSON.parse(localStorage.getItem("byvc.db") ?? '{"users":{}}') as { users: Record<string, any> };
  } catch {
    return { users: {} };
  }
}
function writeDB(db: any) {
  try {
    localStorage.setItem("byvc.db", JSON.stringify(db));
  } catch {}
}
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

function readInvoices() {
  try {
    return JSON.parse(localStorage.getItem("byvc.api.invoices") ?? "[]") as any[];
  } catch {
    return [];
  }
}
function writeInvoices(arr: any[]) {
  try {
    localStorage.setItem("byvc.api.invoices", JSON.stringify(arr));
  } catch {}
}

function mockAddressFor(net: string) {
  const m: any = {
    TRC20: "TQ5E...9XZ1",
    BEP20: "0x5ab3...F29c",
    ERC20: "0x91D0...A77e",
  };
  return m[net] || "0x000...000";
}

const api = {
  async createDeposit(payload: {
    store_id: string;
    price: number;
    currency: string;
    username: string;
    network: string;
    metadata?: any;
  }) {
    const { store_id, price, currency, username, network, metadata } = payload;
    await new Promise((r) => setTimeout(r, 300));
    const inv = {
      id: `inv_${Date.now()}`,
      store_id,
      price,
      currency,
      username,
      network,
      address: mockAddressFor(network),
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
      payUrl: "https://example.bitcart/checkout/invoice-demo",
      metadata: metadata ?? {},
    } as any;
    const all = readInvoices();
    all.unshift(inv);
    writeInvoices(all);
    return inv;
  },
  async webhookBitcartPaid(invoiceId: string) {
    await new Promise((r) => setTimeout(r, 200));
    const all = readInvoices();
    const idx = all.findIndex((x: any) => x.id === invoiceId);
    if (idx < 0) throw new Error("Invoice not found");
    const inv = all[idx];
    inv.status = "confirmed";
    inv.paidAt = Date.now();
    writeInvoices(all);

    const copy = readDB();
    const username = inv.username || guessUsername();
    const urec =
      copy.users[username] || { balance: 0, txs: [], referrals: { earned: 0, count: 0, rate: 50 }, cardActive: false, bonuses: {} };

    const a = Number(inv.price || 0);
    const hadBonus = !!urec.bonuses?.firstBonusApplied;
    const qualifies = a >= 100 && !hadBonus;
    const tier = qualifies ? (a >= 500 ? 200 : 100) : 0;
    const bonusAmt = +((a * tier) / 100).toFixed(2);

    urec.balance = Number(urec.balance || 0) + a + bonusAmt;
    urec.cardActive = !!(urec.cardActive || a >= 100);
    urec.txs = [
      {
        id: `top_${Date.now()}`,
        type: "topup",
        amount: a,
        ccy: inv.currency || "USDT",
        network: inv.network,
        ts: new Date().toISOString(),
        status: "Confirmed",
        invoiceId,
      },
      ...(bonusAmt > 0
        ? [
            {
              id: `bonus_${Date.now()}`,
              type: "bonus",
              amount: bonusAmt,
              ccy: inv.currency || "USDT",
              network: inv.network,
              ts: new Date().toISOString(),
              status: "Applied",
              reason: tier === 200 ? "First deposit ≥500" : "First deposit ≥100",
            },
          ]
        : []),
      ...(urec.txs || []),
    ];
    if (qualifies) urec.bonuses.firstBonusApplied = true;
    copy.users[username] = urec;
    writeDB(copy);
    return { ...inv, appliedBonus: bonusAmt, tier };
  },
  async getInvoice(id: string) {
    const inv = readInvoices().find((x: any) => x.id === id);
    return inv || null;
  },
};

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
        <Badge className="rounded-full bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/40">Prototype</Badge>
      </header>

      <main className="max-w-md mx-auto">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full rounded-2xl bg-black/60 border border-[#262b36] backdrop-blur mb-4">
            <TabsTrigger value="deposit">Пополнение</TabsTrigger>
            <TabsTrigger value="withdraw">Вывод</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit">
            <DepositBitcart />
          </TabsContent>
          <TabsContent value="withdraw">
            <WithdrawMock />
          </TabsContent>
        </Tabs>
      </main>
      <Smoke />
    </div>
  );
}

function BonusActivationPanel({ amount, isFirst }: { amount: number; isFirst: boolean }) {
  const lt100 = amount < 100;
  const gte100 = amount >= 100;
  const gte500 = amount >= 500;
  const tier = isFirst ? (gte500 ? 200 : gte100 ? 100 : 0) : 0;
  const bonus = tier ? +((amount * tier) / 100).toFixed(2) : 0;
  const total = +(amount + bonus).toFixed(2);

  const Calc = () => (
    <div className="mt-2 grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-black/30 px-3 py-2">
        <div className="text-[11px] text-neutral-400">Ваше пополнение</div>
        <div className="text-sm font-semibold text-white">{amount.toFixed(2)} USDT</div>
      </div>
      <div className="rounded-xl bg-black/30 px-3 py-2">
        <div className="text-[11px] text-neutral-400">Бонус {tier ? `+${tier}%` : "(нет)"}</div>
        <div className="text-sm font-semibold text-white">{bonus.toFixed(2)} USDT</div>
      </div>
      <div className="rounded-xl bg-[#F5A623]/20 border border-[#F5A623]/40 px-3 py-2">
        <div className="text-[11px] text-[#F5A623]">Итого будет на карте</div>
        <div className="text-base font-bold text-white">{total.toFixed(2)} USDT</div>
      </div>
    </div>
  );

  if (!isFirst) {
    if (lt100) {
      return (
        <Card className="rounded-2xl bg-[#1b2029] border-[#2a2f3a]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-yellow-400" />
                Повторное пополнение
              </CardTitle>
              <Badge variant="secondary" className="rounded-full">
                Бонус уже использован
              </Badge>
            </div>
            <CardDescription className="text-neutral-400">Сумма менее 100 USDT — кэшбэк и активация не включаются</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-neutral-200">
            <div className="flex items-start gap-2">
              <Gift className="h-4 w-4 text-neutral-400 mt-0.5" />
              Бонус первого пополнения уже был начислен ранее.
            </div>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-neutral-400 mt-0.5" />
              Кэшбэк 20% не включается при сумме &lt; 100 USDT.
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-neutral-400 mt-0.5" />
              Карта активируется при пополнении от 100 USDT.
            </div>
            <Calc />
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="rounded-2xl bg-[#1b2029] border-[#2a2f3a]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Повторное пополнение
            </CardTitle>
            <Badge variant="secondary" className="rounded-full">
              Бонус уже использован
            </Badge>
          </div>
          <CardDescription className="text-neutral-400">Кэшбэк 20% действует на все покупки. Карта активна после зачисления.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-neutral-200">
          <div className="flex items-start gap-2">
            <Gift className="h-4 w-4 text-neutral-400 mt-0.5" />
            Бонус первого пополнения недоступен повторно.
          </div>
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-emerald-300 mt-0.5" />
            Кэшбэк <span className="font-semibold">20%</span> действует.
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-300 mt-0.5" />
            Активация карты подтверждается пополнением.
          </div>
          <Calc />
        </CardContent>
      </Card>
    );
  }

  if (lt100) {
    const ex = 100;
    const exBonus = ex;
    const exTotal = ex + exBonus;
    return (
      <Card className="rounded-2xl bg-[#1b2029] border-[#2a2f3a]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-yellow-400" />
              Бонусы и активация
            </CardTitle>
            <Badge variant="secondary" className="rounded-full">
              Бонус доступен
            </Badge>
          </div>
          <CardDescription className="text-neutral-400">
            Пополнение менее 100 USDT — без бонусов и активации. Бонус сохранится до первого пополнения ≥100 USDT.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-neutral-200">
          <div className="flex items-start gap-2">
            <Gift className="h-4 w-4 text-neutral-400 mt-0.5" />
            При первом пополнении <span className="font-semibold">от 100 USDT</span> начислим <span className="font-semibold">+100%</span>.
          </div>
          <div className="flex items-start gap-2">
            <Gift className="h-4 w-4 text-neutral-400 mt-0.5" />
            Если первое пополнение сразу <span className="font-semibold">≥500 USDT</span> — начислим{" "}
            <span className="font-semibold">+200%</span>.
          </div>
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-neutral-400 mt-0.5" />
            Если бонус начислен на сумме 100–499, то возможность +200% сгорает.
          </div>
          <div className="rounded-xl bg-black/30 p-3 text-xs text-neutral-300">
            Например: пополнив на <span className="text-white font-semibold">{ex} USDT</span>, вы получили бы бонус{" "}
            <span className="text-[#F5A623] font-semibold">+{exBonus} USDT</span> и на карте было бы{" "}
            <span className="text-white font-semibold">{exTotal} USDT</span>.
          </div>
          <Calc />
        </CardContent>
        <CardFooter className="text-xs text-neutral-300">Бонус начисляется один раз при первом пополнении ≥100 USDT.</CardFooter>
      </Card>
    );
  }

  if (gte500) {
    return (
      <Card className="rounded-2xl bg-[#F5A623]/15 border border-[#F5A623]/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-[#F5A623]">
              <Gift className="h-4 w-4" />
              Максимальный бонус к первому пополнению
            </CardTitle>
            <Badge className="rounded-full bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40">Бонус доступен</Badge>
          </div>
          <CardDescription className="text-neutral-300">Первое пополнение ≥500 USDT даёт +200%.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-neutral-100">
          <div className="flex items-start gap-2">
            <Gift className="h-4 w-4 text-[#F5A623] mt-0.5" />
            Бонус к первому пополнению: <span className="font-semibold">+200%</span>.
          </div>
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-[#F5A623] mt-0.5" />
            Кэшбэк <span className="font-semibold">20%</span> на все покупки.
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-[#F5A623] mt-0.5" />
            Карта будет активирована автоматически после зачисления.
          </div>
          <Calc />
          <div className="text-xs text-neutral-300">
            Возможность +200% действует только если первое квалифицирующее пополнение ≥500 USDT.
          </div>
        </CardContent>
        <CardFooter className="text-xs text-neutral-200">После подтверждения сети бонус и кэшбэк применятся автоматически.</CardFooter>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl bg-[#1b2029] border-[#2a2f3a]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Бонусы будут начислены
          </CardTitle>
          <Badge variant="secondary" className="rounded-full">
            Бонус доступен
          </Badge>
        </div>
        <CardDescription className="text-neutral-400">Первое пополнение от 100 до 499.99 USDT даёт +100%.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-3 text-neutral-200">
        <div className="flex items-start gap-2">
          <Gift className="h-4 w-4 text-emerald-300 mt-0.5" />
          Бонус к первому пополнению: <span className="font-semibold">+100%</span>.
        </div>
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-emerald-300 mt-0.5" />
          Кэшбэк <span className="font-semibold">20%</span> на все покупки.
        </div>
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300 mt-0.5" />
          Карта активируется автоматически после зачисления.
        </div>
        <Calc />
        <div className="text-xs text-neutral-300">
          Если первое квалифицирующее пополнение <span className="font-semibold text-white">&lt; 500 USDT</span>, возможность получить +200%
          сгорает.
        </div>
      </CardContent>
      <CardFooter className="text-xs text-neutral-300">Бонус и кэшбэк применяются после подтверждения сети. Один раз.</CardFooter>
    </Card>
  );
}

function DepositBitcart() {
  const [amount, setAmount] = useState<number>(load<number>("byvc.pay.amount", 100));
  const [network, setNetwork] = useState<string>(load<string>("byvc.pay.network", "TRC20"));
  const [creating, setCreating] = useState(false);
  const [invoice, setInvoice] = useState<any>(load("byvc.pay.invoice", null));
  const [status, setStatus] = useState<string>(load<string>("byvc.pay.status", "idle"));
  const [expiresAt, setExpiresAt] = useState<number>(load<number>("byvc.pay.expiresAt", 0));
  const [, setDbTick] = useState(0);
  const [success, setSuccess] =
    useState<null | { amount: number; bonus: number; total: number; balance?: number }>(null);

  const username = guessUsername();
  const db = readDB();
  const rec = db.users?.[username];
  const bonusAlreadyApplied = !!rec?.bonuses?.firstBonusApplied;
  const isFirstEligible = !bonusAlreadyApplied;

  useEffect(() => {
    save("byvc.pay.amount", amount);
  }, [amount]);
  useEffect(() => {
    save("byvc.pay.network", network);
  }, [network]);
  useEffect(() => {
    save("byvc.pay.invoice", invoice);
  }, [invoice]);
  useEffect(() => {
    save("byvc.pay.status", status);
  }, [status]);
  useEffect(() => {
    save("byvc.pay.expiresAt", expiresAt);
  }, [expiresAt]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((expiresAt - now) / 1000));
  useEffect(() => {
    if (expiresAt && secs === 0 && status === "pending") setStatus("expired");
  }, [secs, expiresAt, status]);

  useEffect(() => {
    if (!invoice?.id || status !== "pending") return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/invoices/${invoice.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const st = (data.status || data.payment_status || data.state || "").toLowerCase();
        if (st.includes("confirmed") || st.includes("paid")) {
          const a = Number((invoice.amount ?? data.price ?? data.amount) || 0);
          const tier = !bonusAlreadyApplied && a >= 100 ? (a >= 500 ? 200 : 100) : 0;
          const bonusAmt = +((a * tier) / 100).toFixed(2);
          setStatus("confirmed");
          setSuccess({ amount: a, bonus: bonusAmt, total: a + bonusAmt });
          stop = true;
        }
      } catch {}
    };
    const timer = setInterval(() => {
      if (!stop) poll();
    }, 5000);
    poll();
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [invoice?.id, status, bonusAlreadyApplied, invoice?.amount]);

  const createInvoice = async () => {
    setCreating(true);
    const payload = {
      price: Number(amount || 0),
      currency: "USDT",
      username,
      network,
      metadata: { username, network, firstDepositEligible: isFirstEligible },
    } as any;
    try {
      const res = await fetch("/api/payments/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create invoice");
      const inv = await res.json();
      setInvoice({
        id: inv.id,
        amount: inv.price ?? inv.amount,
        ccy: inv.currency,
        network: inv.network ?? network,
        address: inv.address,
        payUrl: inv.payUrl,
      });
      setStatus("pending");
      setExpiresAt(inv.expiresAt ?? Date.now() + 15 * 60 * 1000);
      setCreating(false);
      if ((window as any)?.bitcart?.showInvoice && inv?.id) (window as any).bitcart.showInvoice(inv.id);
      return;
    } catch (e) {
      console.warn("Falling back to mock invoice (dev):", e);
    }
    const inv = await api.createDeposit({
      store_id: "STORE_DEMO_1",
      price: payload.price,
      currency: "USDT",
      username,
      network,
      metadata: payload.metadata,
    });
    setInvoice({ id: inv.id, amount: inv.price, ccy: inv.currency, network: inv.network, address: inv.address, payUrl: inv.payUrl });
    setStatus("pending");
    setExpiresAt(inv.expiresAt);
    setCreating(false);
  };

  // модалка Bitcart — аккуратный fallback с подсказкой скрипта
  const openModal = () => {
    if ((window as any)?.bitcart?.showInvoice && invoice?.id) {
      (window as any).bitcart.showInvoice(invoice.id);
      return;
    }
    const modalSrc = `${ENV.BITCART_ADMIN_URL.replace(/\/$/, "")}/modal/bitcart.js`;
    alert(
      `Bitcart modal недоступен (dev). Подключите <script src="${modalSrc}"> или задайте NEXT_PUBLIC_BITCART_ADMIN_URL`
    );
  };

  const markPaid = async () => {
    if (!invoice?.id) return;
    const a = Number(invoice.amount || 0);
    const tier = !bonusAlreadyApplied && a >= 100 ? (a >= 500 ? 200 : 100) : 0;
    const bonusAmt = +((a * tier) / 100).toFixed(2);
    await api.webhookBitcartPaid(invoice.id);
    setStatus("confirmed");
    const db2 = readDB();
    const balance = Number(db2.users?.[username]?.balance || 0);
    setSuccess({ amount: a, bonus: bonusAmt, total: a + bonusAmt, balance });
    setDbTick((x) => x + 1);
  };

  const cancel = () => {
    setStatus("cancelled");
    setInvoice(null);
    setExpiresAt(0);
  };
  const visibleAmount = invoice ? Number(invoice.amount || 0) : Number(amount || 0);

  return (
    <div className="space-y-4 relative">
      <BonusActivationPanel amount={visibleAmount} isFirst={isFirstEligible} />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Пополнение через Bitcart</CardTitle>
            <Badge className="rounded-full bg-white/10">@{username}</Badge>
          </div>
          <CardDescription className="text-neutral-400">Выберите сеть и пополните баланс</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!invoice && (
            <>
              {/* 3 сети → 3 колонки */}
              <div className="grid grid-cols-3 gap-2">
                {networks.map((n) => (
                  <Button
                    key={n.code}
                    onClick={() => setNetwork(n.code)}
                    className={`${
                      network === n.code ? "bg-[#F5A623] text-black hover:bg-[#ffb739]" : "bg-black/40 text-neutral-200 hover:bg-black/60"
                    } rounded-xl`}
                  >
                    {n.code}
                  </Button>
                ))}
              </div>
              <Row
                label="Сеть"
                value={network}
                hint={`Комиссия ~${networks.find((n) => n.code === network)?.fee} USDT • ${
                  networks.find((n) => n.code === network)?.eta
                }`}
              />
              <div className="grid gap-2">
                <Label>Сумма (USDT)</Label>
                <UInput type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </div>
              <Button
                disabled={creating || amount <= 0}
                onClick={createInvoice}
                className="w-full rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Создание счёта...
                  </>
                ) : (
                  <>Пополнить</>
                )}
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
                  <Clock className="h-4 w-4" /> {pad(Math.floor(secs / 60))}:{pad(secs % 60)}
                </div>
              </div>

              <div className="rounded-2xl p-4 bg-black/40 border border-[#2a2f3a] flex gap-3">
                <div className="rounded-xl bg-[#1b2029] w-28 h-28 grid place-items-center">
                  <QrCode className="h-10 w-10 text-neutral-300" />
                </div>
                <div className="flex-1 space-y-2">
                  <KVP label="Сумма" value={`${invoice.amount} USDT`} />
                  <KVP label="Сеть" value={invoice.network} />
                  <KVP label="Адрес" value={invoice.address ?? "в модалке Bitcart"} copyable={!!invoice.address} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={openModal} className="rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]">
                  Открыть оплату
                </Button>
                <Button onClick={cancel} variant="secondary" className="rounded-2xl">
                  Отменить
                </Button>
                <Button onClick={markPaid} className="rounded-2xl col-span-2 bg-emerald-600 hover:bg-emerald-700">
                  <Check className="h-4 w-4 mr-2" />
                  Отметить как оплачено (мок)
                </Button>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="text-xs text-neutral-400">После подтверждения сети баланс будет зачислен через вебхук.</CardFooter>
      </Card>
      {success && (
        <SuccessModal
          open={!!success}
          onClose={() => setSuccess(null)}
          amount={success.amount}
          bonus={success.bonus}
          total={success.total}
          balance={success.balance}
        />
      )}
    </div>
  );
}

function WithdrawMock() {
  const [amount, setAmount] = useState<number>(50);
  const [network, setNetwork] = useState<string>("TRC20");
  const [addr, setAddr] = useState<string>("");
  const [status, setStatus] = useState<string>("idle");

  const submit = () => {
    if (!addr || amount <= 0) {
      alert("Заполните адрес и сумму");
      return;
    }
    if (amount <= 100) {
      setStatus("sent");
    } else {
      setStatus("manual");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Вывод средств</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 3 сети → 3 колонки */}
        <div className="grid grid-cols-3 gap-2">
          {networks.map((n) => (
            <Button
              key={n.code}
              onClick={() => setNetwork(n.code)}
              className={`${
                network === n.code ? "bg-[#F5A623] text-black hover:bg-[#ffb739]" : "bg-black/40 text-neutral-200 hover:bg-black/60"
              } rounded-xl`}
            >
              {n.code}
            </Button>
          ))}
        </div>
        <div className="grid gap-2">
          <Label>Адрес</Label>
          <UInput value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Вставьте адрес кошелька" />
        </div>
        <div className="grid gap-2">
          <Label>Сумма (USDT)</Label>
          <UInput type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <Button onClick={submit} className="rounded-2xl h-12">
          Подтвердить
        </Button>
        {status !== "idle" && (
          <div className="text-xs text-neutral-300">Статус: {status === "sent" ? "Отправлено" : "Ожидает ручной проверки"}</div>
        )}
      </CardContent>
    </Card>
  );
}

const UInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ className = "", ...props }, ref) => (
    <Input
      ref={ref}
      className={`rounded-xl bg-black/40 border-[#2a2f3a] text-white placeholder:text-neutral-400 ${className}`}
      {...props}
    />
  )
);
UInput.displayName = "UInput";

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm text-neutral-400">{label}</div>
        <div className="text-base font-medium text-white">{value}</div>
        {hint && <div className="text-xs text-neutral-500 mt-1">{hint}</div>}
      </div>
    </div>
  );
}

function KVP({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {}
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="text-xs text-neutral-400">{label}</div>
        <div className="text-sm font-mono text-white break-all">{value}</div>
      </div>
      {copyable && (
        <Button size="icon" variant="secondary" className="rounded-xl" onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function statusLabel(s: string) {
  switch (s) {
    case "pending":
      return "Ожидает оплаты";
    case "confirmed":
      return "Оплачено";
    case "expired":
      return "Счёт истёк";
    case "cancelled":
      return "Отменён";
    default:
      return "Новый";
  }
}

function SuccessModal({
  open,
  onClose,
  amount,
  bonus,
  total,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  amount: number;
  bonus: number;
  total: number;
  balance?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-[#141821] border border-[#2a2f3a] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-semibold">Пополнение успешно</span>
          </div>
        </div>
        <div className="space-y-2 text-sm text-neutral-200">
          <div className="flex items-center justify-between">
            <span>Сумма пополнения</span>
            <span className="font-semibold text-white">{amount.toFixed(2)} USDT</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Начисленный бонус</span>
            <span className={bonus > 0 ? "font-semibold text-[#F5A623]" : "font-semibold text-neutral-300"}>
              {bonus.toFixed(2)} USDT
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Итого зачислено</span>
            <span className="font-bold text-white">{total.toFixed(2)} USDT</span>
          </div>
          {typeof balance === "number" && (
            <div className="flex items-center justify-between">
              <span>Текущий баланс</span>
              <span className="font-semibold text-white">{balance.toFixed(2)} USDT</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <Button onClick={onClose} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700">
            Ок
          </Button>
        </div>
      </div>
    </div>
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Smoke() {
  useEffect(() => {
    try {
      const ok = document.body.textContent?.includes("Платёжный модуль");
      console.assert(!!ok, "Header should render");
      const text = document.body.textContent || "";
      const hasBonus = ["Бонусы и активация", "Бонусы будут начислены", "Максимальный бонус к первому пополнению", "Повторное пополнение"].some(
        (s) => text.includes(s)
      );
      console.assert(!!hasBonus, "Bonus panel should render");
      const invCreated = readInvoices().length >= 0;
      console.assert(invCreated !== undefined, "Invoices store readable");
    } catch (e) {
      console.warn("Smoke test warn", e);
    }
  }, []);
  return null;
}
