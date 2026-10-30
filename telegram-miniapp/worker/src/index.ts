export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  BOT_WEBHOOK_SECRET: string;
  MINI_APP_ORIGIN: string;
}

type Change = { id: string; entity: string; recordId: string; payload: unknown | null; updatedAt: number };
const cors = (origin: string, env: Env) => ({
  "Access-Control-Allow-Origin": origin === env.MINI_APP_ORIGIN ? origin : env.MINI_APP_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Init-Data",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin"
});

async function hmac(key: ArrayBuffer, data: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)));
}
function hex(bytes: Uint8Array) { return [...bytes].map(x => x.toString(16).padStart(2, "0")).join(""); }
async function verifyInitData(initData: string, botToken: string): Promise<{id:string;first_name?:string;username?:string}|null> {
  if (!initData || initData.length > 8192) return null;
  const p = new URLSearchParams(initData), hash = p.get("hash"); if (!hash) return null;
  p.delete("hash");
  const check = [...p.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData").buffer, botToken);
  if (hex(await hmac(secret.buffer, check)) !== hash) return null;
  const authDate = Number(p.get("auth_date") || 0);
  if (!authDate || Math.abs(Date.now()/1000 - authDate) > 86400) return null;
  try { const u = JSON.parse(p.get("user") || "{}"); return u.id ? {id:String(u.id),first_name:u.first_name,username:u.username} : null; } catch { return null; }
}
function json(data: unknown, status=200, headers: Record<string,string>={}) { return new Response(JSON.stringify(data), {status,headers:{"Content-Type":"application/json; charset=utf-8",...headers}}); }
async function telegram(env: Env, method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if (!r.ok) throw new Error(`Telegram API ${r.status}`);
  return r.json();
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin, env);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ok:true,service:"inkos-sync"});
    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.BOT_WEBHOOK_SECRET) return json({error:"unauthorized"},401);
      const update:any = await request.json();
      if (update.message?.text === "/start" && update.message.chat?.id) {
        await telegram(env,"sendMessage",{chat_id:update.message.chat.id,text:"Добро пожаловать в INK.OS. Откройте приложение кнопкой ниже.",reply_markup:{inline_keyboard:[[{text:"Открыть INK.OS",web_app:{url:env.MINI_APP_ORIGIN}}]]}});
      }
      return json({ok:true});
    }
    if (!url.pathname.startsWith("/api/")) return json({error:"not_found"},404,headers);
    if (origin && origin !== env.MINI_APP_ORIGIN) return json({error:"origin_not_allowed"},403,headers);
    const initData = request.headers.get("X-Telegram-Init-Data") || "";
    const user = await verifyInitData(initData,env.BOT_TOKEN);
    if (!user) return json({error:"invalid_telegram_session"},401,headers);
    if (url.pathname === "/api/me" && request.method === "GET") return json({user},{headers});
    if (url.pathname === "/api/sync" && request.method === "POST") {
      const body:any = await request.json();
      const changes:Change[] = Array.isArray(body.changes) ? body.changes.slice(0,500) : [];
      const cursor = Number(body.cursor || 0);
      for (const c of changes) {
        if (!c.id || !c.entity || !c.recordId || c.entity.length > 64 || c.recordId.length > 160) continue;
        await env.DB.prepare("INSERT INTO changes (change_id,user_id,entity,record_id,payload,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(change_id) DO NOTHING")
          .bind(c.id,user.id,c.entity,c.recordId,c.payload === null ? null : JSON.stringify(c.payload),Number(c.updatedAt)||Date.now()).run();
      }
      const rows = await env.DB.prepare("SELECT seq,change_id,entity,record_id,payload,updated_at FROM changes WHERE user_id=? AND seq>? ORDER BY seq ASC LIMIT 1000").bind(user.id,cursor).all<any>();
      return json({changes:rows.results.map(r=>({seq:r.seq,id:r.change_id,entity:r.entity,recordId:r.record_id,payload:r.payload===null?null:JSON.parse(r.payload),updatedAt:r.updated_at})),cursor:rows.results.at(-1)?.seq ?? cursor},{headers});
    }
    return json({error:"not_found"},404,headers);
  }
};
