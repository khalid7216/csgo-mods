import { z } from 'zod';

export const DEFAULT_SERVER_CONFIG = {
  map: 'de_dust2',
  gameMode: 'casual',
  botsEnabled: false,
  freezeTime: false,
  skipWarmup: true,
  friendlyFire: true,
  maxPlayers: 16,
  hostname: 'CSGO Mod Manager Server',
  port: 27015,
  rconPassword: 'changeme',
  customCommands: ''
};

export const serverConfigSchema = z.object({
  map: z.string().min(1, 'Select a map'),
  gameMode: z.enum(['casual', 'competitive', 'deathmatch', 'retake']),
  botsEnabled: z.boolean(),
  freezeTime: z.boolean(),
  skipWarmup: z.boolean(),
  friendlyFire: z.boolean(),
  maxPlayers: z.coerce.number().int().min(2, 'Minimum 2 players').max(64, 'Maximum 64 players'),
  hostname: z.string().trim().min(3, 'Hostname is too short').max(80, 'Hostname is too long'),
  port: z.coerce.number().int().min(1024, 'Port must be 1024 or higher').max(65535, 'Port is too high'),
  rconPassword: z.string().trim().min(4, 'RCON password is too short').max(64, 'RCON password is too long'),
  customCommands: z.string().max(6000, 'Custom commands are too long').default('')
});

export const steamIdSchema = z
  .string()
  .trim()
  .regex(/^\d{15,20}$/, 'Enter a valid SteamID64');

export function normalizeServerConfig(value) {
  return serverConfigSchema.parse({
    ...DEFAULT_SERVER_CONFIG,
    ...(value || {})
  });
}

export function getFirstZodError(result, fallback = 'Validation failed') {
  if (result.success) return '';
  return result.error.issues[0]?.message || fallback;
}
