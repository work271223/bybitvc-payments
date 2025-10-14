import { NextRequest, NextResponse } from "next/server";
function normalizeApi(url: string) { if (!url) return url; return url.endsWith('/api') ? url : url.replace(/\/$/, '') + '/api'; }
const RAW_API  = process.env.BITCART_API_URL || "";
const API      = normalizeApi(RAW_API);
const RAW_AUTH = process.env.BITCART_TOKEN || "";
const AUTH     = RAW_AUTH.startsWith("Token ") ? RAW_AUTH : `Token ${RAW_AUTH}`;
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({} as any));
    const invoiceId = payload?.id || payload?.invoice_id || payload?.invoice?.id;
    if (!invoiceId) return NextResponse.json({ ok: false, reason: "missing invoice id" }, { status: 400 });
    const invRes = await fetch(`${API}/invoices/${invoiceId}`, { headers: { Authorization: AUTH }, cache: "no-store" });
    if (!invRes.ok) return NextResponse.json({ ok: false, reason: "invoice fetch failed" }, { status: 400 });
    const inv = await invRes.json();
    const status = String(inv.status || inv.payment_status || inv.state || "").toLowerCase();
    return NextResponse.json({ ok: true, status });
  } catch (e:any) { return NextResponse.json({ ok: false, reason: e?.message || "error" }, { status: 500 }); }
}