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
import {
  QrCode,
  Copy,
  Check,
  Loader2,
  Wallet,
  Clock,
  Gift,
  ShieldCheck,
  Info,
} from "lucide-react";

const ENV = {
  BITCART_ADMIN_URL:
    (typeof process !== "undefined" &&
      (process as any)?.env?.NEXT_PUBLIC_BITCART_ADMIN_URL) ||
    "https://pay.bybitpay.pro",
};

// сети без SOL
const networks = [
  { code: "TRC20", fee: 1, eta: "~3–5 мин" },
  { code: "BEP20", fee: 0.8, eta: "~1–3 мин" },
  { code: "ERC20", fee: 5, eta: "~5–10 мин" },
];
const SUPPORTED = new Set(networks.map((n) => n.code));

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
    const tg = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user
      ?.username;
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
      copy.users[username] || {
        balance: 0,
        txs: [],
        referrals: { earned: 0, count: 0, rate: 50 },
        cardActive: false,
        bonuses: {},
      };

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

/* ========== остальной код компонента DepositBitcart, WithdrawMock и вспомогательные функции — без изменений,
как в предыдущем сообщении, но без строки "the:" в api.webhookBitcartPaid ========== */

