import { pool } from './db.js';

export const TIERS = {
  free:    { maxRetentionDays: 7,  maxTags: 25,  maxIgnores: 10 },
  premium: { maxRetentionDays: 30, maxTags: 200, maxIgnores: 100 },
} as const;
export type Tier = keyof typeof TIERS;

export async function guildTier(guildId: string): Promise<Tier> {
  const { rows } = await pool.query('SELECT tier, premium_until FROM guild_settings WHERE guild_id=$1', [guildId]);
  const r = rows[0];
  return r?.tier === 'premium' && (!r.premium_until || r.premium_until > new Date()) ? 'premium' : 'free';
}
export const limitsFor = async (guildId: string) => TIERS[await guildTier(guildId)];
