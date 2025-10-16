import { NextRequest, NextResponse } from "next/server";

/** Normalize Bitcart API base URL */
function normalizeApi(url: string) {
  if (!url) return "";
  // убираем /admin на конце, если по ошибке указали админку
  url = url.replace(/\/admin\/?$/i, "");
  // гарантируем /api в конце
  if (url.endsWith("/api")) return url;
  return url.replace(/\/$/, "") + "/api";
}

/** ---- ENV ---- */
const RAW_API = process.env.BITCART_API_URL || "";
const API = normalizeApi(RAW_API);

const RAW_AUTH = process.env.BITCART_TOKEN || "";
const AUTH = RAW_AUTH.startsWith("Token ") ? RAW_AUTH : `Token ${RAW_AUTH}`;

const STORE = process.env.BITCART_STORE_ID || "";

const APP_BASE = (process.env.APP_BASE_URL || "").replace(/\/$/, "");

/** Small helper for consistent error replies */
function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** POST /api/payments/deposits
 *  Body: { price:number, currency?:string("USDT"), username?:string, network?: "TRC20"|"BEP20"|"ERC20", metadata?:object }
 */
export async function POST(req: NextRequest) {
  try {
    // --- sanity checks for ENV so сразу понятно, если что-то не так
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

    // нормализуем сеть для удобства фильтрации на бекенде/в админке
    const net = (network || "").toString().trim().toUpperCase(); // "TRC20" | "BEP20" | "ERC20" | ""
    const meta = {
      username: username || null,
      network: net || null,
      ...metadata,
    };

    // собираем payload для Bitcart
    const payload: Record<string, any> = {
      store_id: STORE,                // ВАЖНО: именно store_id
      price: amount,
      currency,                       // у нас USDT
      metadata: meta,
    };

    // если APP_BASE задан — добавляем webhook и redirect
    if (APP_BASE) {
      payload.notification_url = `${APP_BASE}/api/webhooks/bitcart`;
      payload.redirect_url = `${APP_BASE}/payments/success`;
    }

    const res = await fetch(`${API}/invoices`, {
      method: "POST",
      headers: {
        Authorization: AUTH,
        "Content-Type": "application/json",
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
      // пробрасываем статус Bitcart как есть (часто полезно: 400/401/422 и т.д.)
      return err(res.status || 400, text || "create invoice failed");
    }

    const inv = await res.json().catch(() => ({}));

    // пробуем вытащить ссылку на оплату из разных полей ответа Bitcart
    const payUrl =
      inv?.public_url ||
      inv?.checkout_link ||
      inv?.links?.checkout ||
      inv?.pay_url ||
      null;

    // срок жизни инвойса
    const expiresAt = inv?.expiration || inv?.expires_at || null;

    return NextResponse.json({
      id: inv?.id,
      price: inv?.price ?? amount,
      currency: inv?.currency ?? currency,
      payUrl,
      expiresAt,
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
