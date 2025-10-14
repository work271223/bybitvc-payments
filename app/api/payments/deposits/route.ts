import { NextRequest, NextResponse } from "next/server";

// --- helper: нормализуем API URL ---
function normalizeApi(url: string) {
  if (!url) return url;
  // если по ошибке указали /admin — убираем
  url = url.replace(/\/admin\/?$/i, "");
  // если не заканчивается на /api — добавляем
  if (url.endsWith("/api")) return url;
  return url.replace(/\/$/, "") + "/api";
}

// --- environment ---
const RAW_API = process.env.BITCART_API_URL || "";
const API = normalizeApi(RAW_API);
const RAW_AUTH = process.env.BITCART_TOKEN || "";
const AUTH = RAW_AUTH.startsWith("Token ") ? RAW_AUTH : `Token ${RAW_AUTH}`;
const STORE = process.env.BITCART_STORE_ID || "";
const APP_BASE = (process.env.APP_BASE_URL || "").replace(/\/$/, "");

// --- основной роут ---
export async function POST(req: NextRequest) {
  try {
    const { price, currency = "USDT", username, network, metadata } = await req.json();

    // тело запроса для Bitcart (ВАЖНО: ключ должен быть store_id)
    const payload = {
      store_id: STORE,
      price: Number(price),
      currency,
      metadata: { username, network, ...(metadata || {}) },
      notification_url: `${APP_BASE}/api/webhooks/bitcart`,
      redirect_url: `${APP_BASE}/payments/success`,
    };

    // отправляем запрос к Bitcart API
    const res = await fetch(`${API}/invoices`, {
      method: "POST",
      headers: {
        Authorization: AUTH,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    // обработка неуспешного ответа
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (process.env.NODE_ENV !== "production") {
        console.error("[bitcart:create-invoice] HTTP", res.status, text);
        console.log("[bitcart] API:", API, "STORE:", STORE);
      }
      return NextResponse.json(
        { error: text || "create invoice failed" },
        { status: res.status || 400 }
      );
    }

    // успешный ответ
    const inv = await res.json();

    // пробуем вытащить ссылку оплаты из разных возможных полей
    const payUrl =
      inv?.public_url ||
      inv?.checkout_link ||
      inv?.links?.checkout ||
      inv?.pay_url ||
      null;

    // финальный ответ фронту
    return NextResponse.json({
      id: inv?.id,
      price: inv?.price ?? Number(price),
      currency: inv?.currency ?? currency,
      payUrl,
      expiresAt: inv?.expiration || inv?.expires_at || null,
      raw: {
        status: inv?.status,
        payment_status: inv?.payment_status,
        state: inv?.state,
      },
    });
  } catch (e: any) {
    // fallback при исключениях
    if (process.env.NODE_ENV !== "production") {
      console.error("[bitcart:create-invoice] exception", e?.message || e);
    }
    return NextResponse.json(
      { error: e?.message || "error" },
      { status: 500 }
    );
  }
}
