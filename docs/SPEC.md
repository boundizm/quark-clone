# Product spec & roadmap

## MVP (implemented in scaffold)
- Message create/edit/delete logging, content encrypted with AES-256-GCM
- Member join/leave/update (nickname, roles), bans/unbans, voice join/leave/move
- Per-event log channel routing, per-guild retention with hourly cleanup

## Next
1. Audit-log lookup to attribute moderator + reason for bans/kicks/timeouts/deletions
2. Kick, timeout, role/channel/webhook/server-settings events
3. Attachment archiving (encrypted object storage)
4. Web dashboard (Next.js + Discord OAuth2), public REST API + OpenAPI
5. Message search, filters/ignore lists (channels, roles, users)
6. Premium tiers via Stripe (longer retention, higher limits), i18n
7. Sharding, metrics, status page

## Legal / compliance (before launch)
- Own name, logo, copy and assets — do not reuse third-party branding or text
- Privacy policy, ToS, data deletion on guild removal, DSGVO processing basis
- Apply for Discord verification + privileged intents once >75 servers
