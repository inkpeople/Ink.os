const CITIES = ["Новосибирск", "Новосибирске", "Новосибирска", "Новосибирску"];
const QUERIES = [
  '"ищу тату мастера" Новосибирск',
  '"посоветуйте тату мастера" Новосибирск',
  '"хочу тату" Новосибирск',
  '"ищу мастера татуировки" Новосибирск',
  '"тату мастер Новосибирск"'
];
const SOURCES = [
  { key: "vk", domain: "vk.com" },
  { key: "threads", domain: "threads.net" },
  { key: "instagram", domain: "instagram.com" },
  { key: "telegram", domain: "t.me" }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
function esc(s = "") { return String(s).replace(/[&<>]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" }[c])); }
function scoreLead(text = "", url = "") {
  const s = (text + " " + url).toLowerCase();
  let score = 0;
  if (/ищу (тату|мастера)|посоветуйте.*(тату|мастера)|нужен.*(тату|мастер)|хочу.*тату|где.*набить/.test(s)) score += 65;
  if (/новосибирск|нск|nsk/.test(s)) score += 20;
  if (/график|реализм|чёрно-бел|черно-бел|эскиз/.test(s)) score += 10;
  if (/куплю|продам|ваканси|обучени|курс/.test(s)) score -= 40;
  return Math.max(0, Math.min(100, score));
}
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.description || "Telegram API error");
  return data.result;
}
async function send(env, chatId, text, extra = {}) {
  return tg(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
}
async function allowed(env, chatId) {
  const row = await env.DB.prepare("SELECT chat_id FROM owner_chats WHERE chat_id=?").bind(String(chatId)).first();
  return !!row;
}
async function saveLead(env, lead) {
  const id = crypto.randomUUID().slice(0, 8);
  const score = scoreLead(lead.text, lead.url);
  if (score < 35 || !lead.url) return false;
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO leads
    (id, source, url, text, score, status, found_at)
    VALUES (?, ?, ?, ?, ?, 'new', datetime('now'))`)
    .bind(id, lead.source, lead.url, (lead.text || "").slice(0, 1800), score).run();
  return result.meta.changes > 0;
}
async function searchBrave(env, query) {
  if (!env.BRAVE_API_KEY) return [];
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "20");
  const r = await fetch(url, { headers: { "X-Subscription-Token": env.BRAVE_API_KEY, "Accept": "application/json" } });
  if (!r.ok) throw new Error("Brave Search API: " + r.status);
  const data = await r.json();
  return (data.web?.results || []).map(x => ({ url: x.url, text: [x.title, x.description].filter(Boolean).join(" — ") }));
}
async function scan(env) {
  let added = 0, errors = [];
  if (!env.BRAVE_API_KEY) return { added: 0, errors: ["Не задан BRAVE_API_KEY — поиск по открытым источникам пока выключен."] };
  for (const source of SOURCES) {
    for (const phrase of QUERIES.slice(0, 3)) {
      try {
        const results = await searchBrave(env, `site:${source.domain} ${phrase}`);
        for (const item of results) {
          const ok = await saveLead(env, { source: source.key, url: item.url, text: item.text });
          if (ok) added++;
        }
      } catch (e) { errors.push(source.key + ": " + e.message); }
    }
  }
  // Public web search is the supported discovery path. Platform APIs can be added with their official credentials.
  return { added, errors };
}
async function listLeads(env, status = "new", limit = 10) {
  return env.DB.prepare("SELECT * FROM leads WHERE status=? ORDER BY score DESC, found_at DESC LIMIT ?").bind(status, limit).all();
}
async function command(env, chatId, text) {
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(" ");
  if (cmd === "/start") {
    await env.DB.prepare("INSERT OR IGNORE INTO owner_chats(chat_id, created_at) VALUES(?, datetime('now'))").bind(String(chatId)).run();
    return send(env, chatId, "🕵️ <b>RAMZES CLIENT HUNTER подключён</b>\n\nЯ ищу публичные сигналы спроса на татуировки в Новосибирске. Контакты не собираю из закрытых профилей и никому не пишу автоматически.\n\nКоманды:\n/scan — запустить поиск\n/leads — новые потенциальные клиенты\n/stats — статистика\n/help — помощь");
  }
  if (!(await allowed(env, chatId))) return send(env, chatId, "Сначала активируй бота командой /start.");
  if (cmd === "/help") return send(env, chatId, "<b>Команды CLIENT HUNTER</b>\n/scan — поиск по открытым индексируемым страницам\n/leads — список новых сигналов спроса\n/done ID — отметить обработанным\n/ignore ID — скрыть нерелевантное\n/stats — статистика\n\nСообщения потенциальным клиентам готовятся отдельно и отправляются только после твоего подтверждения.");
  if (cmd === "/scan") {
    await send(env, chatId, "🔎 Начинаю поиск по публичным страницам VK, Threads, Instagram и Telegram. Это может занять немного времени.");
    const result = await scan(env);
    return send(env, chatId, `Готово. Новых совпадений: <b>${result.added}</b>.${result.errors.length ? "\n\n" + esc(result.errors.join("\n")) : ""}\n\nПосмотреть: /leads`);
  }
  if (cmd === "/leads") {
    const rows = (await listLeads(env)).results;
    if (!rows.length) return send(env, chatId, "Новых совпадений пока нет. Запусти /scan.");
    for (const l of rows) {
      await send(env, chatId, `<b>${esc(l.source.toUpperCase())} · ${l.score}/100</b>\n${esc(l.text)}\n<a href="${esc(l.url)}">Открыть публикацию</a>\nID: <code>${l.id}</code>\n/done ${l.id} · /ignore ${l.id}`);
    }
    return;
  }
  if (cmd === "/done" || cmd === "/ignore") {
    if (!arg) return send(env, chatId, "Укажи ID, например /done a1b2c3d4");
    const status = cmd === "/done" ? "contacted" : "ignored";
    const r = await env.DB.prepare("UPDATE leads SET status=? WHERE id=?").bind(status, arg).run();
    return send(env, chatId, r.meta.changes ? "Статус обновлён." : "Не нашёл такой ID.");
  }
  if (cmd === "/stats") {
    const r = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM leads GROUP BY status").all();
    const lines = (r.results || []).map(x => `${x.status}: ${x.n}`);
    return send(env, chatId, "<b>Статистика</b>\n" + (lines.join("\n") || "Пока нет данных."));
  }
  return send(env, chatId, "Не понял команду. Напиши /help.");
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return new Response("RAMZES CLIENT HUNTER is running");
    if (request.method === "POST" && url.pathname === "/telegram") {
      let update;
      try { update = await request.json(); } catch { return json({ ok: false }, 400); }
      const msg = update.message;
      if (msg?.chat?.id && msg.text) {
        try { await command(env, msg.chat.id, msg.text); }
        catch (e) { await send(env, msg.chat.id, "Ошибка: " + esc(e.message)).catch(() => {}); }
      }
      return json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/admin/scan") {
      const auth = request.headers.get("authorization");
      if (!env.ADMIN_SECRET || auth !== "Bearer " + env.ADMIN_SECRET) return json({ error: "unauthorized" }, 401);
      return json(await scan(env));
    }
    return json({ error: "not found" }, 404);
  }
};
