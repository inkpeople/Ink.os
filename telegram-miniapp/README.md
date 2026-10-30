# INK.OS Telegram Mini App — foundation

This folder is a safe, separate foundation branch. It does not replace the current INK.OS app or touch its existing local database.

## Architecture
- Telegram bot: entry point and notifications.
- Telegram Mini App: mobile UI hosted as a static site.
- Local-first storage: IndexedDB in the Mini App.
- Cloud sync: Cloudflare Worker + D1 append-only change log, partitioned by Telegram user ID.
- Telegram identity: validated server-side from signed initData; never trust a user ID sent by the browser.

## Worker setup
1. Create a Cloudflare Worker and D1 database.
2. Apply `migrations/0001_changes.sql`.
3. Configure secrets `BOT_TOKEN` and `BOT_WEBHOOK_SECRET`.
4. Configure vars `MINI_APP_ORIGIN` (HTTPS URL of deployed Mini App).
5. Deploy the Worker and set Telegram webhook to `https://YOUR_WORKER/telegram/webhook` using Telegram's setWebhook API with secret_token equal to BOT_WEBHOOK_SECRET.
6. Set the bot's Menu Button to the Mini App URL in BotFather.

## Important security and data notes
- Never commit bot tokens or webhook secrets.
- Cloudflare D1 is a separate service from Supabase; quotas and terms still apply. Keep local data and downloadable backups.
- The initial sync API is append-only and idempotent by change ID. Client-side conflict policy and tombstone retention must be implemented and tested before production use.
- Do not migrate or delete existing INK.OS data until a verified export and restore test is completed.
