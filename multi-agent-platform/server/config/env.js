import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET', 'ENCRYPTION_KEY'];

export function validateEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  }
  if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  if (process.env.ENCRYPTION_KEY.length < 32) throw new Error('ENCRYPTION_KEY must be at least 32 characters.');
}

const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

export const env = {
  port: int(process.env.PORT, 5000),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  maxConcurrency: int(process.env.MAX_CONCURRENT_AGENTS, 6),
  maxCollabRounds: int(process.env.MAX_COLLAB_ROUNDS, 3),
  maxAgentsHardLimit: int(process.env.MAX_AGENTS_PER_REQUEST, 6),
  retries: int(process.env.PROVIDER_MAX_RETRIES, 2),
  routerUseLLM: process.env.ROUTER_USE_LLM !== 'false',
  ollamaEnabled: process.env.OLLAMA_ENABLED === 'true',
  allowServerKeys: process.env.ALLOW_SERVER_KEYS !== 'false',
};
