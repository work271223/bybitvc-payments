import { NextRequest, NextResponse } from "next/server";

/** Normalize Bitcart API base URL */
function normalizeApi(url: string) {
  if (!url) return "";
  url = url.replace(/\/admin\/?$/i, "");
  if (url.endsWith("/api")) return url;
  return url.replace(/\/$/, "") + "/api";
}

/** ---- ENV ---- */
const RAW_API = process.env.BITCART_API_URL || "";
const API = normalizeApi(RAW_API);

const RAW_AUTH = process.env.BITCART_TOKEN || "";
const AUTH = RAW_AUTH.startsWith("Token ") ? RAW_AUTH : `Token ${RAW_AUTH}`;

const STORE = process.env.BITCART_STORE_ID || "";

// База для webhook/redirect; если не задана — возьмём из текущего запроса
const APP_BASE_ENV = (process.env.APP_BASE_URL || "").replace(/\/$/, "");

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function fetchInvoiceOnce(id: string) {
  const r = await fetch(`${API}/invoices/${id}`, {
    headers: { Authorization: AUTH, Accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function pickAddress(inv: any) {
  return (
    inv?.address ||
    inv?.payment_address ||
    inv?.payment?.address ||
    inv?.payments?.[0]?.address ||
    inv?.payment_methods?.[0]?.address ||
    inv?.payment_methods?.[0]?.destination ||
    null
  );
}

/**
 * POST /api/payments/deposits
 * Body: { price:number, currency?:string("USDT"), username?:string, network?: "TRC20"|"BEP20"|"ERC20", metadata?:object }
 */
export async function POST(req: NextRequest) {
  try {
    if (!API) return err(500, "BITCART_API_URL is not configured");
    if (!AUTH) return err(500, "BITCART_TOKEN is not configured");
    if (!STORE) return err(500, "BITCART_STORE_ID is not configured");

    const body = await req.json().catch(() => ({} as any));
    const {
      price,
      currency = "USDT",
      username,
      network,
      metadata = {},
    }: {
      price: number;
      currency?: string;
      username?: string;
      network?: string;
      metadata?: Record<string, any>;
    } = body || {};

    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return err(400, "price must be a positive number");
    }

    const net = (network || "").toString().trim().toUpperCase();
    const meta = { username: username || null, network: net || null, ...metadata };

    const baseUrl = APP_BASE_ENV || new URL(req.url).origin;

    const payload: Record<string, any> = {
      store_id: STORE,
      price: amount,
      currency,
      metadata: meta,
      notification_url: `${baseUrl}/api/webhooks/bitcart`,
      redirect_url: `${baseUrl}/payments/success`,
    };

    const res = await fetch(`${API}/invoices`, {
      method: "POST",
      headers: {
        Authorization: AUTH,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (process.env.NODE_ENV !== "production") {
        console.error("[bitcart:create-invoice] HTTP", res.status, text);
        console.log("[bitcart] API:", API, "STORE:", STORE);
      }
      return err(res.status || 400, text || "create invoice failed");
    }

    const inv = (await res.json().catch(() => ({}))) as any;

    // payUrl из разных возможных полей
    const payUrl =
      inv?.public_url ||
      inv?.checkout_link ||
      inv?.links?.checkout ||
      inv?.pay_url ||
      null;

    const expiresAt = inv?.expiration || inv?.expires_at || null;

    // Пытаемся сразу добрать адрес (обычно появляется через мгновение после создания)
    let addr =
      pickAddress(inv) ||
      null;

    if (!addr && inv?.id) {
      const attempts = [150, 350, 700, 1200]; // мс
      for (const delay of attempts) {
        await new Promise((r) => setTimeout(r, delay));
        const fresh = await fetchInvoiceOnce(inv.id);
        addr = pickAddress(fresh);
        if (addr) break;
      }
    }

    return NextResponse.json({
      id: inv?.id,
      price: inv?.price ?? amount,
      currency: inv?.currency ?? currency,
      payUrl,
      expiresAt,
      address: addr || null,
      network: net || null,
      raw: {
        status: inv?.status,
        payment_status: inv?.payment_status,
        state: inv?.state,
      },
    });
  } catch (e: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[bitcart:create-invoice] exception", e?.message || e);
    }
    return err(500, e?.message || "error");
  }
}
