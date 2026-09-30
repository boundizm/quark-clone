function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  databaseUrl: required('DATABASE_URL'),
  encryptionKey: Buffer.from(required('MESSAGE_ENCRYPTION_KEY'), 'hex'),
  defaultRetentionDays: Number(process.env.DEFAULT_RETENTION_DAYS ?? 7),
};

if (config.encryptionKey.length !== 32) {
  throw new Error('MESSAGE_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
}
