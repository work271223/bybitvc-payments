import { NextRequest, NextResponse } from "next/server";

/** Normalize Bitcart API base URL */
function normalizeApi(url: string) {
  if (!url) return "";
  // если по ошибке указали ссылку на админку — убираем /admin в конце
  url = url.replace(/\/admin\/?$/i, "");
  // гарантируем, что база заканчивается на /api
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
    // sanity-check ENV — сразу видно, что не так
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

    // нормализуем сеть (используем в metadata и отдадим назад фронту)
    const net = (network || "").toString().trim().toUpperCase(); // "TRC20" | "BEP20" | "ERC20" | ""

    const meta = {
      username: username || null,
      network: net || null,
      ...metadata,
    };

    // база для вебхуков/редиректа
    const baseUrl = APP_BASE_ENV || new URL(req.url).origin;

    // собираем payload для Bitcart
    const payload: Record<string, any> = {
      store_id: STORE,        // ВАЖНО: ключ именно store_id
      price: amount,
      currency,               // USDT
      metadata: meta,
      notification_url: `${baseUrl}/api/webhooks/bitcart`,
      redirect_url: `${baseUrl}/payments/success`,
    };

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
      // пробрасываем статус Bitcart — так проще диагностировать (400/401/422/…)
      return err(res.status || 400, text || "create invoice failed");
    }

    const inv: any = await res.json().catch(() => ({}));

    // пробуем вытащить наиболее удобную ссылку на оплату
    const payUrl =
      inv?.public_url ||
      inv?.checkout_link ||
      inv?.links?.checkout ||
      inv?.pay_url ||
      null;

    // срок жизни инвойса
    const expiresAt = inv?.expiration || inv?.expires_at || null;

    // иногда Bitcart отдаёт адрес прямо на создании инвойса (в зав-ти от конфигурации)
    const address =
      inv?.address ||
      inv?.payment_address ||
      inv?.payment?.address ||
      null;

    return NextResponse.json({
      id: inv?.id,
      price: inv?.price ?? amount,
      currency: inv?.currency ?? currency,
      payUrl,
      expiresAt,
      address,
      network: net || null, // отдадим фронту, чтобы он знал, какую сеть запрашивали
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
