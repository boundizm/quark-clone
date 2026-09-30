# Chronicle (working name)

Discord audit-logging bot: deleted/edited messages, member, voice and moderation events,
with encrypted message storage and per-server retention. Independent implementation with its own branding.

## Quick start
```bash
cp .env.example .env        # fill in token, client id, DB url, key (openssl rand -hex 32)
npm install
npm run migrate
npm run deploy-commands
npm run dev
```
Enable the **Server Members** and **Message Content** privileged intents in the Discord developer portal.
In Discord: `/logging all #logs`.

## Commands
- `/logging` — `set`, `all`, `disable`, `spoiler`, `ignore`, `retention`
- `/ban` `/unban` `/kick` `/mute` `/unmute` — moderation (reasons go to the audit log)
- `/tags` — `send`, `list`, `manage create|delete`
- `/help` `/commands` `/invite`

See [docs/SPEC.md](docs/SPEC.md) for the roadmap.
