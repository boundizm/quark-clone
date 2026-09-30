import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { PermissionFlagsBits, type Client } from 'discord.js';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { pool } from '../db.js';
import { ALL_TYPES, CATEGORIES, LOG_CATALOG, isValidTarget } from '../logger.js';
import { TIERS, guildTier } from '../tiers.js';

interface Session { userId: string; username: string; guilds: { id: string; name: string; icon: string | null; permissions: string }[]; expires: number }
const sessions = new Map<string, Session>(); // MVP: in-memory; move to Redis for multi-instance
const states = new Map<string, number>();
const DISCORD = 'https://discord.com/api/v10';

export async function startApi(client: Client) {
  if (!config.oauthClientSecret || !config.sessionSecret) {
    console.warn('Dashboard/API disabled: set DISCORD_CLIENT_SECRET and SESSION_SECRET');
    return;
  }
  const app = Fastify({ logger: true });
  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(fastifyStatic, { root: join(process.cwd(), 'public') });
  const redirectUri = `${config.publicUrl}/auth/callback`;
  const secure = config.publicUrl.startsWith('https');

  // ---- auth ----
  app.get('/auth/login', (_req, reply) => {
    const state = randomBytes(16).toString('hex');
    states.set(state, Date.now() + 10 * 60_000);
    const q = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'identify guilds', state });
    reply.redirect(`https://discord.com/oauth2/authorize?${q}`);
  });

  app.get('/auth/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state || (states.get(state) ?? 0) < Date.now()) return reply.code(400).send('Invalid state');
    states.delete(state);
    const tok = await fetch(`${DISCORD}/oauth2/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.oauthClientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    }).then((r) => r.json() as Promise<{ access_token?: string }>);
    if (!tok.access_token) return reply.code(400).send('OAuth failed');
    const h = { authorization: `Bearer ${tok.access_token}` };
    const [user, guilds] = await Promise.all([
      fetch(`${DISCORD}/users/@me`, { headers: h }).then((r) => r.json() as Promise<{ id: string; username: string }>),
      fetch(`${DISCORD}/users/@me/guilds`, { headers: h }).then((r) => r.json() as Promise<Session['guilds']>),
    ]);
    const sid = randomBytes(32).toString('hex');
    sessions.set(sid, { userId: user.id, username: user.username, guilds, expires: Date.now() + 7 * 864e5 });
    reply.setCookie('sid', sid, { signed: true, httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 7 * 86400 }).redirect('/');
  });

  const sessionOf = (req: FastifyRequest): Session | null => {
    const raw = req.cookies.sid;
    const v = raw ? req.unsignCookie(raw) : null;
    const s = v?.valid && v.value ? sessions.get(v.value) : null;
    return s && s.expires > Date.now() ? s : null;
  };

  app.post('/auth/logout', (req, reply) => {
    const raw = req.cookies.sid; const v = raw ? req.unsignCookie(raw) : null;
    if (v?.value) sessions.delete(v.value);
    reply.clearCookie('sid', { path: '/' }).send({ ok: true });
  });

  // ---- API (auth + CSRF guard) ----
  await app.register(async (api) => {
    api.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
      const s = sessionOf(req);
      if (!s) return reply.code(401).send({ error: 'unauthorized' });
      (req as any).session = s;
      if (req.method !== 'GET') {
        const origin = req.headers.origin;
        if (origin && origin !== config.publicUrl) return reply.code(403).send({ error: 'bad origin' });
        if (!req.headers['content-type']?.includes('application/json')) return reply.code(415).send({ error: 'json only' });
      }
    });
    const guardGuild = (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const s = (req as any).session as Session;
      const g = s.guilds.find((x) => x.id === id);
      const ok = g && (BigInt(g.permissions) & (PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator)) !== 0n && client.guilds.cache.has(id);
      if (!ok) { reply.code(403).send({ error: 'forbidden' }); return null; }
      return id;
    };

    api.get('/me', async (req) => { const s = (req as any).session as Session; return { id: s.userId, username: s.username }; });
    api.get('/catalog', async () => ({ categories: LOG_CATALOG, tiers: TIERS }));

    api.get('/guilds', async (req) => {
      const s = (req as any).session as Session;
      const manage = PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator;
      return s.guilds.filter((g) => (BigInt(g.permissions) & manage) !== 0n)
        .map((g) => ({ id: g.id, name: g.name, icon: g.icon, botPresent: client.guilds.cache.has(g.id) }));
    });

    api.get('/guilds/:id', async (req, reply) => {
      const id = guardGuild(req, reply); if (!id) return;
      const [settings, routes, ignores, tags] = await Promise.all([
        pool.query('SELECT retention_days, spoiler_logs FROM guild_settings WHERE guild_id=$1', [id]),
        pool.query('SELECT event_type, channel_id FROM log_channels WHERE guild_id=$1 ORDER BY event_type', [id]),
        pool.query('SELECT target_id FROM log_ignores WHERE guild_id=$1', [id]),
        pool.query('SELECT name, content FROM tags WHERE guild_id=$1 ORDER BY name', [id]),
      ]);
      const guild = client.guilds.cache.get(id)!;
      return {
        tier: await guildTier(id),
        settings: settings.rows[0] ?? { retention_days: config.defaultRetentionDays, spoiler_logs: false },
        routes: routes.rows, ignores: ignores.rows.map((r) => r.target_id), tags: tags.rows,
        channels: guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread() && !c.isDMBased()).map((c) => ({ id: c.id, name: c.name })),
      };
    });

    api.put('/guilds/:id/routes', async (req, reply) => {
      const id = guardGuild(req, reply); if (!id) return;
      const body = req.body as { event?: string; channelId?: string | null };
      if (!body.event || !isValidTarget(body.event)) return reply.code(400).send({ error: 'unknown event' });
      if (!body.channelId) { await pool.query('DELETE FROM log_channels WHERE guild_id=$1 AND event_type=$2', [id, body.event]); return { ok: true }; }
      if (!client.guilds.cache.get(id)?.channels.cache.has(body.channelId)) return reply.code(400).send({ error: 'unknown channel' });
      await pool.query(`INSERT INTO log_channels (guild_id, event_type, channel_id) VALUES ($1,$2,$3)
        ON CONFLICT (guild_id, event_type) DO UPDATE SET channel_id = EXCLUDED.channel_id`, [id, body.event, body.channelId]);
      return { ok: true };
    });

    api.put('/guilds/:id/settings', async (req, reply) => {
      const id = guardGuild(req, reply); if (!id) return;
      const b = req.body as { retentionDays?: number; spoilerLogs?: boolean };
      const max = TIERS[await guildTier(id)].maxRetentionDays;
      if (b.retentionDays !== undefined && (!Number.isInteger(b.retentionDays) || b.retentionDays < 1 || b.retentionDays > max))
        return reply.code(400).send({ error: `retentionDays must be 1-${max}` });
      await pool.query(`INSERT INTO guild_settings (guild_id, retention_days, spoiler_logs) VALUES ($1, COALESCE($2, $4), COALESCE($3, false))
        ON CONFLICT (guild_id) DO UPDATE SET retention_days = COALESCE($2, guild_settings.retention_days), spoiler_logs = COALESCE($3, guild_settings.spoiler_logs)`,
        [id, b.retentionDays ?? null, b.spoilerLogs ?? null, config.defaultRetentionDays]);
      return { ok: true };
    });

    api.put('/guilds/:id/tags/:name', async (req, reply) => {
      const id = guardGuild(req, reply); if (!id) return;
      const name = String((req.params as any).name).toLowerCase().slice(0, 32);
      const content = String((req.body as any)?.content ?? '').slice(0, 2000);
      if (!content) return reply.code(400).send({ error: 'content required' });
      const n = await pool.query('SELECT count(*)::int AS c FROM tags WHERE guild_id=$1 AND name<>$2', [id, name]);
      if (n.rows[0].c >= TIERS[await guildTier(id)].maxTags) return reply.code(403).send({ error: 'tag limit reached' });
      await pool.query(`INSERT INTO tags (guild_id, name, content, created_by) VALUES ($1,$2,$3,$4)
        ON CONFLICT (guild_id, name) DO UPDATE SET content = EXCLUDED.content`, [id, name, content, (req as any).session.userId]);
      return { ok: true };
    });
    api.delete('/guilds/:id/tags/:name', async (req, reply) => {
      const id = guardGuild(req, reply); if (!id) return;
      await pool.query('DELETE FROM tags WHERE guild_id=$1 AND name=$2', [id, String((req.params as any).name).toLowerCase()]);
      return { ok: true };
    });
  }, { prefix: '/api' });

  void CATEGORIES; void ALL_TYPES;
  await app.listen({ port: config.port, host: '0.0.0.0' });
}
