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

// База для webhook/redirect (если не задана — возьмём origin запроса)
const APP_BASE_ENV = (process.env.APP_BASE_URL || "").replace(/\/$/, "");

/** helpers */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Достаём адрес из разных форматов ответа Bitcart */
function extractAddress(obj: any): string | null {
  if (!obj) return null;
  return (
    obj.address ||
    obj.payment_address ||
    obj?.payment?.address ||
    obj?.payments?.[0]?.address ||
    obj?.addresses?.[0] ||
    obj?.payment_method?.address ||
    null
  );
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

    // нормализуем сеть (положим в metadata и вернём фронту)
    const net = (network || "").toString().trim().toUpperCase(); // "TRC20" | "BEP20" | "ERC20" | ""

    const meta = {
      username: username || null,
      network: net || null,
      ...metadata,
    };

    const baseUrl = APP_BASE_ENV || new URL(req.url).origin;

    // собираем payload для Bitcart
    const payload: Record<string, any> = {
      store_id: STORE, // ВАЖНО: ключ именно store_id
      price: amount,
      currency, // USDT
      metadata: meta,
      notification_url: `${baseUrl}/api/webhooks/bitcart`,
      redirect_url: `${baseUrl}/payments/success`,
    };

    // 1) создаём инвойс
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
      return err(res.status || 400, text || "create invoice failed");
    }

    const inv: any = await res.json().catch(() => ({}));

    // возможные ссылки на оплату
    const payUrl =
      inv?.public_url ||
      inv?.checkout_link ||
      inv?.links?.checkout ||
      inv?.pay_url ||
      null;

    const id = inv?.id;
    const expiresAt = inv?.expiration || inv?.expires_at || null;

    // 2) пытаемся достать адрес сразу из ответа
    let address = extractAddress(inv);

    // 3) если адреса нет — коротко подождём и спросим инвойс по ID
    //    (часто адрес появляется спустя сотни миллисекунд)
    if (!address && id) {
      // до 5 попыток, с задержкой 400мс (≈2 секунды максимум)
      for (let i = 0; i < 5; i++) {
        await sleep(400);
        const r = await fetch(`${API}/invoices/${id}`, {
          headers: { Authorization: AUTH },
          cache: "no-store",
        }).catch(() => null);

        if (r && r.ok) {
          const fresh = await r.json().catch(() => ({}));
          address = extractAddress(fresh);
          if (address) break;
        }
      }
    }

    return NextResponse.json({
      id,
      price: inv?.price ?? amount,
      currency: inv?.currency ?? currency,
      payUrl,
      expiresAt,
      address: address || null,
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
