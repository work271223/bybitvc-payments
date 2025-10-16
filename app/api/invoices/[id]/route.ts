import { NextRequest, NextResponse } from "next/server";

/** Нормализуем базу Bitcart: убираем /admin и гарантируем /api */
function normalizeApi(url: string) {
  if (!url) return "";
  url = url.replace(/\/admin\/?$/i, "");
  if (url.endsWith("/api")) return url;
  return url.replace(/\/$/, "") + "/api";
}

/** ENV */
const RAW_API  = process.env.BITCART_API_URL || "";
const API      = normalizeApi(RAW_API);
const RAW_AUTH = process.env.BITCART_TOKEN || "";
const AUTH     = RAW_AUTH.startsWith("Token ") ? RAW_AUTH : `Token ${RAW_AUTH}`;

function jerr(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * GET /api/invoices/:id
 * Проксируем в Bitcart: /invoices/{id} + /invoices/{id}/payments
 * и возвращаем invoice + address (если есть).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!API)  return jerr(500, "BITCART_API_URL is not configured");
    if (!AUTH) return jerr(500, "BITCART_TOKEN is not configured");

    const id = params?.id;
    if (!id) return jerr(400, "invoice id required");

    // 1) сам инвойс
    const invRes = await fetch(`${API}/invoices/${encodeURIComponent(id)}`, {
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!invRes.ok) {
      const t = await invRes.text().catch(() => "");
      return jerr(invRes.status || 400, t || "failed to fetch invoice");
    }
    const inv: any = await invRes.json().catch(() => ({}));

    // 2) payments по инвойсу — здесь чаще всего есть адрес
    const payRes = await fetch(
      `${API}/invoices/${encodeURIComponent(id)}/payments`,
      { headers: { Authorization: AUTH, "Content-Type": "application/json" }, cache: "no-store" }
    );

    let payments: any[] = [];
    if (payRes.ok) {
      payments = await payRes.json().catch(() => []);
    }

    // Попробуем вынуть адрес из разных мест
    const addrFromInvoice =
      inv?.address ||
      inv?.payment_address ||
      inv?.payment?.address ||
      null;

    const addrFromPayments =
      payments?.[0]?.address ||
      payments?.[0]?.payment_address ||
      null;

    const address = addrFromInvoice || addrFromPayments || null;

    // также вернём payments целиком — вдруг пригодится для отладки
    return NextResponse.json({
      ...inv,
      address,
      payments,
    });
  } catch (e: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[bitcart:get-invoice] exception", e?.message || e);
    }
    return jerr(500, e?.message || "error");
  }
}
