# RAMZES CLIENT HUNTER

Telegram lead-discovery assistant for tattoo services in Novosibirsk.

## Current MVP
- Telegram webhook bot.
- Owner-only chat registration via /start.
- Public, search-engine-indexed pages discovery for VK, Threads, Instagram and Telegram via Brave Search API.
- Lead scoring, deduplication, SQLite/D1 storage.
- /scan, /leads, /stats, /done ID, /ignore ID.
- No automatic outreach. The owner reviews every lead.

## Important platform limits
This MVP searches public pages indexed by the search provider. It does not scrape private accounts, bypass login, harvest personal contact details, or send unsolicited DMs. Threads and Instagram do not provide a general public API for searching arbitrary people/posts. Direct platform integrations require official API access and permissions.

## Deploy (Cloudflare Workers + D1)
1. Install Wrangler: `npm install -g wrangler`
2. Log in: `wrangler login`
3. Create D1 database: `wrangler d1 create ramzes-client-hunter`
4. Put the returned database_id into wrangler.toml.
5. Apply schema: `wrangler d1 execute ramzes-client-hunter --file=./schema.sql --remote`
6. Add secrets:
   - `wrangler secret put BOT_TOKEN` — token from @BotFather
   - `wrangler secret put BRAVE_API_KEY` — Brave Search API key
   - `wrangler secret put ADMIN_SECRET` — long random secret
7. Deploy: `wrangler deploy`
8. Set Telegram webhook (replace values):
   `https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<WORKER_SUBDOMAIN>.workers.dev/telegram`
9. Open the bot and send /start, then /scan.

## Configuration
Location and tattoo intent terms are currently defined in worker.js. Never commit API tokens or secrets.
