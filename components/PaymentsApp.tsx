import React, { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, Clock, Gift, ShieldCheck, Info } from "lucide-react";

const ENV = {
  BITCART_ADMIN_URL:
    (typeof process !== "undefined" &&
      (process as any)?.env?.NEXT_PUBLIC_BITCART_ADMIN_URL) ||
    "https://pay.bybitpay.pro",
};

// Оставляем только TRC20 (по твоей текущей конфигурации магазина)
const networks = [{ code: "TRC20", fee: 1, eta: "~3–5 мин" }];

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
    return JSON.parse(
      localStorage.getItem("byvc.db") ?? '{"users":{}}'
    ) as { users: Record<string, any> };
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
    const k =
      localStorage.getItem("byvc.currentUser") ||
      localStorage.getItem("byvc.lastUser");
    if (k) return k;
  } catch {}
  return "guest";
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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

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

function BonusActivationPanel({
  amount,
  isFirst,
}: {
  amount: number;
  isFirst: boolean;
}) {
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
        <div className="text-sm font-semibold text-white">
          {amount.toFixed(2)} USDT
        </div>
      </div>
      <div className="rounded-xl bg-black/30 px-3 py-2">
        <div className="text-[11px] text-neutral-400">
          Бонус {tier ? `+${tier}%` : "(нет)"}
        </div>
        <div className="text-sm font-semibold text-white">
          {bonus.toFixed(2)} USDT
        </div>
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
            <CardDescription className="text-neutral-400">
              Сумма менее 100 USDT — кэшбэк и активация не включаются
            </CardDescription>
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
          <CardDescription className="text-neutral-400">
            Кэшбэк 20% действует на все покупки. Карта активна после зачисления.
          </CardDescription>
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
            Если первое пополнение сразу <span className="font-semibold">≥500 USDT</span> — начислим <span className="font-semibold">+200%</span>.
          </div>
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-neutral-400 mt-0.5" />
            Если бонус начислен на сумме 100–499, то возможность +200% сгорает.
          </div>
          <div className="rounded-xl bg-black/30 p-3 text-xs text-neutral-300">
            Например: пополнив на <span className="text-white font-semibold">{ex} USDT</span>, вы получили бы бонус <span className="text-[#F5A623] font-semibold">+{exBonus} USDT</span> и на карте было бы <span className="text-white font-semibold">{exTotal} USDT</span>.
          </div>
          <Calc />
        </CardContent>
        <CardFooter className="text-xs text-neutral-300">
          Бонус начисляется один раз при первом пополнении ≥100 USDT.
        </CardFooter>
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
            <Badge className="rounded-full bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40">
              Бонус доступен
            </Badge>
          </div>
          <CardDescription className="text-neutral-300">
            Первое пополнение ≥500 USDT даёт +200%.
          </CardDescription>
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
            Бонусы будут начислены
          </CardTitle>
          <Badge variant="secondary" className="rounded-full">
            Бонус доступен
          </Badge>
        </div>
        <CardDescription className="text-neutral-400">
          Первое пополнение от 100 до 499.99 USDT даёт +100%.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-3 text-neutral-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-emerald-300 mt-0.5" />
          Кэшбэк <span className="font-semibold">20%</span> на все покупки.
        </div>
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300 mt-0.5" />
          Карта активируется автоматически после зачисления.
        </div>
      </CardContent>
      <CardFooter className="text-xs text-neutral-300">
        Бонус и кэшбэк применяются после подтверждения сети. Один раз.
      </CardFooter>
    </Card>
  );
}

/** Построить надёжную публичную ссылку на страницу инвойса */
function buildInvoiceUrl(inv: any, id?: string | null) {
  const direct =
    inv?.public_url ||
    inv?.links?.invoice ||
    inv?.links?.checkout ||
    inv?.checkout_link ||
    inv?.pay_url ||
    null;

  if (direct) return direct;

  if (id) {
    const base = ENV.BITCART_ADMIN_URL.replace(/\/admin\/?$/i, "");
    return `${base}/i/${id}`;
  }
  return null;
}

function DepositBitcart() {
  const [amount, setAmount] = useState<number>(load<number>("byvc.pay.amount", 100));
  const [network] = useState<string>("TRC20");
  const [creating, setCreating] = useState(false);
  const [invoice, setInvoice] = useState<any>(load("byvc.pay.invoice", null));
  const [status, setStatus] = useState<string>(load<string>("byvc.pay.status", "idle"));
  const [expiresAt, setExpiresAt] = useState<number>(load<number>("byvc.pay.expiresAt", 0));

  const username = guessUsername();
  const db = readDB();
  const rec = db.users?.[username];
  const bonusAlreadyApplied = !!rec?.bonuses?.firstBonusApplied;
  const isFirstEligible = !bonusAlreadyApplied;

  useEffect(() => { save("byvc.pay.amount", amount); }, [amount]);
  useEffect(() => { save("byvc.pay.invoice", invoice); }, [invoice]);
  useEffect(() => { save("byvc.pay.status", status); }, [status]);
  useEffect(() => { save("byvc.pay.expiresAt", expiresAt); }, [expiresAt]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.floor((expiresAt - now) / 1000));
  useEffect(() => { if (expiresAt && secs === 0 && status === "pending") setStatus("expired"); }, [secs, expiresAt, status]);

  // Поллинг: тянем статус/expiration
  useEffect(() => {
    if (!invoice?.id || status !== "pending") return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/invoices/${invoice.id}`);
        if (!res.ok) return;
        const data = await res.json();

        const exp =
          data?.expiration ||
          data?.expires_at ||
          (data?.expiresAt ? Date.parse(data.expiresAt) : null);
        if (exp && !expiresAt) {
          setExpiresAt(typeof exp === "number" ? exp : Date.parse(exp));
        }

        const st = (data.status || data.payment_status || data.state || "").toLowerCase();
        if (st.includes("confirmed") || st.includes("paid")) {
          // Сброс в исходное состояние
          setInvoice(null);
          setStatus("idle");
          setExpiresAt(0);
        }
      } catch {}
    };
    const timer = setInterval(() => { if (!stop) poll(); }, 5000);
    poll();
    return () => { stop = true; clearInterval(timer); };
  }, [invoice?.id, status, expiresAt]);

  const createInvoice = async () => {
    setCreating(true);
    const payload = {
      price: Number(amount || 0),
      currency: "USDT",
      username,
      network: "TRC20",
      metadata: { username, network: "TRC20", firstDepositEligible: isFirstEligible },
    } as any;

    try {
      const res = await fetch("/api/payments/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create invoice");
      const inv = await res.json();

      const id = inv.id;
      const payUrl = buildInvoiceUrl(inv, id);

      setInvoice({
        id,
        amount: inv.price ?? inv.amount ?? payload.price,
        ccy: inv.currency ?? "USDT",
        network: "TRC20",
        payUrl,
      });
      setStatus("pending");
      setExpiresAt(inv.expiresAt ?? Date.now() + 15 * 60 * 1000);
      setCreating(false);
      return;
    } catch (e) {
      console.warn("Create invoice failed:", e);
      setCreating(false);
    }
  };

  const openInvoicePage = () => {
    if (!invoice?.id) return;
    const url = buildInvoiceUrl(invoice, invoice.id);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const cancel = () => {
    setStatus("cancelled");
    setInvoice(null);
    setExpiresAt(0);
  };

  const visibleAmount = invoice ? Number(invoice.amount || 0) : Number(amount || 0);
  const mm = pad(Math.floor(secs / 60));
  const ss = pad(secs % 60);

  return (
    <div className="space-y-4 relative">
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
                <div className="rounded-xl bg-black/40 text-neutral-200 px-3 py-2 border border-[#2a2f3a]">
                  Сеть: <span className="font-semibold">TRC20</span>
                  <span className="text-xs text-neutral-400"> (комиссия ~{networks[0].fee} USDT • {networks[0].eta})</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Сумма (USDT)</Label>
                <Input
                  className="rounded-xl bg-black/40 border-[#2a2f3a] text-white placeholder:text-neutral-400"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
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
              <div className="rounded-2xl p-3 bg-black/40 border border-[#2a2f3a]">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="text-neutral-400">Статус</div>
                    <div className="font-semibold">{statusLabel(status)}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-300">
                    <Clock className="h-4 w-4" /> {mm}:{ss}
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <div className="text-neutral-400">Сумма к оплате</div>
                  <div className="font-semibold text-white">
                    {Number(invoice.amount || 0).toFixed(2)} USDT · TRC20
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={openInvoicePage}
                  className="rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]"
                >
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
    </div>
  );
}

function WithdrawMock() {
  const [amount, setAmount] = useState<number>(50);
  const [addr, setAddr] = useState<string>("");
  const [status, setStatus] = useState<string>("idle");

  const submit = () => {
    if (!addr || amount <= 0) {
      alert("Заполните адрес и сумму");
      return;
    }
    setStatus(amount <= 100 ? "sent" : "manual");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Вывод средств</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl bg-black/40 text-neutral-200 px-3 py-2 border border-[#2a2f3a]">
          Сеть: <span className="font-semibold">TRC20</span>
        </div>
        <div className="grid gap-2">
          <Label>Адрес</Label>
          <Input
            className="rounded-xl bg-black/40 border-[#2a2f3a] text-white placeholder:text-neutral-400"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Вставьте адрес кошелька"
          />
        </div>
        <div className="grid gap-2">
          <Label>Сумма (USDT)</Label>
          <Input
            className="rounded-xl bg-black/40 border-[#2a2f3a] text-white placeholder:text-neutral-400"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </div>
        <Button onClick={submit} className="rounded-2xl h-12">
          Подтвердить
        </Button>
        {status !== "idle" && (
          <div className="text-xs text-neutral-300">
            Статус: {status === "sent" ? "Отправлено" : "Ожидает ручной проверки"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Smoke() {
  useEffect(() => {
    try {
      const ok = document.body.textContent?.includes("Платёжный модуль");
      console.assert(!!ok, "Header should render");
    } catch (e) {
      console.warn("Smoke test warn", e);
    }
  }, []);
  return null;
}
