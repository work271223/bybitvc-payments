import { NextRequest, NextResponse } from "next/server";
function normalizeApi(url: string) { if (!url) return url; return url.endsWith('/api') ? url : url.replace(/\/$/, '') + '/api'; }
const RAW_API   = process.env.BITCART_API_URL || "";
const API       = normalizeApi(RAW_API);
const RAW_AUTH  = process.env.BITCART_TOKEN || "";
const AUTH      = RAW_AUTH.startsWith("Token ") ? RAW_AUTH : `Token ${RAW_AUTH}`;
const STORE_ID  = process.env.BITCART_STORE_ID!;
const APP_BASE  = process.env.APP_BASE_URL || "";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { price, currency = "USDT", username, network, metadata } = body ?? {};
    if (!price || !STORE_ID) return NextResponse.json({ error: "price or STORE_ID missing"}, { status: 400 });
    const invoiceCreation = {
      price, store_id: STORE_ID, currency,
      order_id: `byvc_${Date.now()}`,
      notification_url: APP_BASE ? `${APP_BASE}/api/webhooks/bitcart` : undefined,
      redirect_url: APP_BASE ? `${APP_BASE}/payments/success` : undefined,
      metadata: { username, network, ...metadata },
    } as any;
    const res = await fetch(`${API}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: AUTH },
      body: JSON.stringify(invoiceCreation), cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 400 });
    const data = await res.json();
    return NextResponse.json({
      id: data.id, price: data.price, currency: data.currency,
      payUrl: data.payment_url ?? data.pay_url,
      expiresAt: data.expiration ?? Date.now() + 15 * 60 * 1000
    });
  } catch (e:any) { return NextResponse.json({ error: e?.message || "failed" }, { status: 500 }); }
}