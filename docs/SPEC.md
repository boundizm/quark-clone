# Product spec & roadmap

## MVP (implemented in scaffold)
- Message create/edit/delete logging, content encrypted with AES-256-GCM
- Member join/leave/update (nickname, roles), bans/unbans, voice join/leave/move
- Per-event log channel routing, per-guild retention with hourly cleanup

- Commands at parity with the competitor's documented list: help, commands, invite, logging (spoiler/ignore), ban, unban, kick, mute, unmute, tags
- Kick/timeout/ban events attributed to moderator + reason via audit log

- Role, channel, webhook, server, emoji, invite and thread events (moderator via audit log where available)

- Full log-type catalog (8 categories, ~65 types) with category + per-type routing, autocomplete in `/logging`
- Message attribution (who deleted), bulk delete (text export), pins, reactions, polls, threads, edit history (`/history`), encrypted attachment archive
- Web dashboard (Discord OAuth2) + REST API under `/api`, free/premium tier limits (`src/tiers.ts`)

## Next
1. Moderator attribution for message deletions; edit-history viewer
3. Attachment archiving (encrypted object storage)
4. Web dashboard (Next.js + Discord OAuth2), public REST API + OpenAPI
5. Message search, filters/ignore lists (channels, roles, users)
6. i18n, public API tokens + OpenAPI, message search
7. Premium tiers via Stripe (on hold: launch is free-only; tier limits already enforced in `src/tiers.ts`)
8. Sharding, metrics, status page

## Legal / compliance (before launch)
- Own name, logo, copy and assets — do not reuse third-party branding or text
- Privacy policy, ToS, data deletion on guild removal, DSGVO processing basis
- Apply for Discord verification + privileged intents once >75 servers
