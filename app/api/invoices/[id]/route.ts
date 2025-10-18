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

/** Единообразный ответ-ошибка */
function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  try {
    if (!API) return err(500, "BITCART_API_URL is not configured");
    if (!AUTH) return err(500, "BITCART_TOKEN is not configured");

    const id = ctx.params?.id;
    if (!id) return err(400, "invoice id is required");

    const headers = { Authorization: AUTH, "Content-Type": "application/json" };

    // 1) Базовая инфа по инвойсу
    const invRes = await fetch(`${API}/invoices/${encodeURIComponent(id)}`, {
      headers,
      cache: "no-store",
    });
    if (!invRes.ok) {
      const t = await invRes.text().catch(() => "");
      return err(invRes.status || 400, t || "failed to fetch invoice");
    }
    const inv: any = await invRes.json().catch(() => ({}));

    // 2) Попробуем вытащить адрес из разных мест
    let address: string | null =
      inv?.address ||
      inv?.payment_address ||
      inv?.payment?.address ||
      null;

    // 3) Если адреса нет — запросим payment-methods
    let payment_methods: any[] | null = null;
    try {
      const pmRes = await fetch(
        `${API}/invoices/${encodeURIComponent(id)}/payment-methods`,
        { headers, cache: "no-store" }
      );
      if (pmRes.ok) {
        payment_methods = await pmRes.json().catch(() => null);
        // самый подходящий метод — первый для on-chain
        const first = Array.isArray(payment_methods) ? payment_methods[0] : null;
        address =
          address ||
          first?.address ||
          first?.payment_address ||
          first?.payment?.address ||
          null;
      }
    } catch {
      /* ignore */
    }

    // 4) Если нет — попробуем payments
    let payments: any[] | null = null;
    try {
      const payRes = await fetch(
        `${API}/invoices/${encodeURIComponent(id)}/payments`,
        { headers, cache: "no-store" }
      );
      if (payRes.ok) {
        payments = await payRes.json().catch(() => null);
        const p = Array.isArray(payments) ? payments[0] : null;
        address =
          address ||
          p?.address ||
          p?.payment_address ||
          p?.payment?.address ||
          null;
      }
    } catch {
      /* ignore */
    }

    // удобные поля из создания инвойса
    const payUrl =
      inv?.public_url ||
      inv?.checkout_link ||
      inv?.links?.checkout ||
      inv?.pay_url ||
      null;

    return NextResponse.json({
      id: inv?.id ?? id,
      price: inv?.price ?? null,
      currency: inv?.currency ?? null,
      status:
        inv?.status || inv?.payment_status || inv?.state || inv?.invoice_status,
      address: address || null,
      payUrl,
      expiresAt: inv?.expiration || inv?.expires_at || null,
      payment_methods: payment_methods || null,
      payments: payments || null,
      raw: inv,
    });
  } catch (e: any) {
    return err(500, e?.message || "error");
  }
}
