import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { env, validateEnv } from './config/env.js';
import connectDB from './config/db.js';
import { seedAgents, seedModels } from './services/modelRegistry.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import registerSocket from './socket/socketHandler.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import modelRoutes from './routes/modelRoutes.js';
import keyRoutes from './routes/keyRoutes.js';
import userRoutes from './routes/userRoutes.js';
import responseRoutes from './routes/responseRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

validateEnv();

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(helmet());
app.use(cors({ origin: env.clientOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/uploads', uploadRoutes);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.clientOrigins, credentials: true }, maxHttpBufferSize: 1e6 });
registerSocket(io);

await connectDB();
await Promise.all([seedAgents(), seedModels()]);
server.listen(env.port, () => console.log(`[server] http://localhost:${env.port}`));

const shutdown = () => { io.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000).unref(); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
