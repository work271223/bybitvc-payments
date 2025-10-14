import { NextRequest, NextResponse } from "next/server";
function normalizeApi(url: string) {
  if (!url) return url;
  // если по ошибке поставили /admin — убираем
  url = url.replace(/\/admin\/?$/i, '');
  // если уже /api — оставляем, иначе добавляем
  if (url.endsWith('/api')) return url;
  return url.replace(/\/$/, '') + '/api';
}
const RAW_API = process.env.BITCART_API_URL || "";
const API     = normalizeApi(RAW_API);
const RAW_AUTH = process.env.BITCART_TOKEN || "";
const AUTH     = RAW_AUTH.startsWith("Token ") ? RAW_AUTH : `Token ${RAW_AUTH}`;
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${API}/invoices/${params.id}`, { headers: { Authorization: AUTH }, cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: 'fetch failed' }, { status: 400 });
    return NextResponse.json(await res.json());
  } catch (e:any) { return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}