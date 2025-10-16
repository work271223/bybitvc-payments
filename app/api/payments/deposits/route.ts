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

// Можно явно задать базу для вебхуков/редиректа через ENV,
// иначе возьмём origin из запроса.
const APP_BASE_ENV = (process.env.APP_BASE_URL || "").replace(/\/$/, "");

/** Единообразный ответ-ошибка */
function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Создать payment для инвойса, чтобы получить адрес */
async function createPaymentForInvoice(
  invoiceId: string,
  opts: { currency: string; network?: string }
) {
  const headers = {
    Authorization: AUTH,
    "Content-Type": "application/json",
  };

  // Попробуем самый вероятный эндпоинт
  // 1) POST /payments { invoice: <id>, currency: "USDT", network?: "TRC20" }
  try {
    const body1: any = {
      invoice: invoiceId,
      currency: opts.currency,
    };
    if (opts.network) body1.network = opts.network;
    const r1 = await fetch(`${API}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify(body1),
      cache: "no-store",
    });
    if (r1.ok) {
      const p = await r1.json().catch(() => ({} as any));
      return p;
    }
  } catch {}

  // 2) POST /invoices/{id}/payments { currency, network? }
  try {
    const body2: any = {
      currency: opts.currency,
    };
    if (opts.network) body2.network = opts.network;
    const r2 = await fetch(`${API}/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify(body2),
      cache: "no-store",
    });
    if (r2.ok) {
      const p = await r2.json().catch(() => ({} as any));
      return p;
    }
  } catch {}

  // 3) Фолбэк: некоторые инсталляции принимают cryptocurrency вместо currency
  try {
    const body3: any = {
      invoice: invoiceId,
      cryptocurrency: opts.currency,
    };
    if (opts.network) body3.network = opts.network;
    const r3 = await fetch(`${API}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify(body3),
      cache: "no-store",
    });
    if (r3.ok) {
      const p = await r3.json().catch(() => ({} as any));
      return p;
    }
  } catch {}

  return null;
}

/**
 * POST /api/payments/deposits
 * Body: {
 *   price: number,
 *   currency?: "USDT",
 *   username?: string,
 *   network?: "TRC20" | "BEP20" | "ERC20",
 *   metadata?: object
 * }
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

    const net = (network || "").toString().trim().toUpperCase(); // "TRC20"/"BEP20"/"ERC20"/""

    const meta = {
      username: username || null,
      network: net || null,
      ...metadata,
    };

    // База для вебхуков/редиректа
    const baseUrl = APP_BASE_ENV || new URL(req.url).origin;

    // 1) Создаём инвойс
    const invoicePayload: Record<string, any> = {
      store_id: STORE,
      price: amount,
      currency, // USDT
      metadata: meta,
      notification_url: `${baseUrl}/api/webhooks/bitcart`,
      redirect_url: `${baseUrl}/payments/success`,
    };

    const invRes = await fetch(`${API}/invoices`, {
      method: "POST",
      headers: {
        Authorization: AUTH,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoicePayload),
      cache: "no-store",
    });

    if (!invRes.ok) {
      const text = await invRes.text().catch(() => "");
      if (process.env.NODE_ENV !== "production") {
        console.error("[bitcart:create-invoice] HTTP", invRes.status, text);
        console.log("[bitcart] API:", API, "STORE:", STORE);
      }
      return err(invRes.status || 400, text || "create invoice failed");
    }

    const inv: any = await invRes.json().catch(() => ({}));

    // 2) Сразу создаём payment, чтобы получить адрес
    const payment = await createPaymentForInvoice(inv?.id, {
      currency,
      network: net || undefined,
    });

    // Попробуем собрать адрес и ссылку из payment/инвойса
    const address =
      payment?.address ||
      payment?.payment_address ||
      payment?.payment?.address ||
      inv?.address ||
      inv?.payment_address ||
      inv?.payment?.address ||
      null;

    const checkoutUrl =
      payment?.checkout_url ||
      payment?.public_url ||
      payment?.pay_url ||
      inv?.public_url ||
      inv?.checkout_link ||
      inv?.links?.checkout ||
      inv?.pay_url ||
      null;

    const expiresAt = inv?.expiration || inv?.expires_at || null;

    return NextResponse.json({
      id: inv?.id,
      price: inv?.price ?? amount,
      currency: inv?.currency ?? currency,
      network: net || null,
      address,
      payUrl: checkoutUrl,
      expiresAt,
      raw: {
        invoice: { id: inv?.id, status: inv?.status, payment_status: inv?.payment_status, state: inv?.state },
        payment: payment ? { id: payment?.id, status: payment?.status } : null,
      },
    });
  } catch (e: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[bitcart:create-invoice] exception", e?.message || e);
    }
    return err(500, e?.message || "error");
  }
}
