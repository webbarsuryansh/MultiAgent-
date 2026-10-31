# Multi-Agent AI Workspace (MERN)

Ask once, get answers from several specialist agents running on different models. A critic scores them, a synthesizer merges them into one final answer. Streams live over Socket.IO.

**Stack:** React + Vite + Tailwind + Framer Motion + Zustand, Express, MongoDB/Mongoose, Socket.IO, JWT.
**Providers:** Gemini (native), OpenRouter, OpenAI, Anthropic (OpenAI-compatible endpoint), Groq, DeepSeek, Hugging Face router, Ollama (local). All share one adapter interface.

## 1. Requirements
- Node.js 20.3 or newer
- MongoDB 6+ (local, Docker, or Atlas)
- At least one provider API key (Gemini or OpenRouter is the quickest start)

## 2. MongoDB setup (pick one)
- **Docker:** `docker compose up -d`, then `MONGODB_URI=mongodb://127.0.0.1:27017/multi-agent`
- **Local install:** install MongoDB Community, start `mongod`, use the same URI.
- **Atlas:** create a free cluster, add your IP under Network Access, create a database user, and paste the `mongodb+srv://...` string.

Collections and indexes are created automatically. Built-in agents and starter models are seeded on first boot.

## 3. Configure
```bash
npm run install:all
cp server/.env.example server/.env
```
Edit `server/.env`:
- `JWT_SECRET` and `ENCRYPTION_KEY`: 32+ random characters each (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Changing `ENCRYPTION_KEY` later makes stored user API keys unreadable.
- `ADMIN_EMAIL`: the account registered with this email becomes admin (can add models and edit built-in agents).
- Optional admin-managed provider keys (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`, ...). Users can also add their own on the **API settings** page. A user's key always wins over the server key.

## 4. Run
```bash
npm run dev:server   # http://localhost:5000
npm run dev:client   # http://localhost:5173 (proxies /api and /socket.io to :5000)
```
Register, open **API settings**, add a key, then ask something. Production: `npm run build`, serve `client/dist` from any static host, set `CLIENT_ORIGIN` on the server and `VITE_API_URL` / `VITE_SOCKET_URL` at build time.

## 5. Deploy frontend to Vercel and backend to Render
This application uses Socket.IO, so the backend must run as a persistent Node.js service. Deploy the frontend to Vercel and the backend to Render.

### Render backend
1. Create a MongoDB Atlas cluster and allow the Render service to connect.
2. In Render, choose **New > Blueprint** and select this repository. Render detects `render.yaml` and creates the `multi-agent-server` service.
3. Set `MONGODB_URI` to the Atlas connection string, `CLIENT_ORIGIN` to the Vercel URL, `ADMIN_EMAIL` to the admin account email, and `GEMINI_API_KEY` to the provider key.
4. Copy the deployed Render URL, for example `https://multi-agent-server.onrender.com`.
5. Confirm `https://<render-host>/api/health` returns `{"ok":true}`.

### Vercel frontend
1. Import this repository into Vercel.
2. Set **Root Directory** to `client`.
3. Add build environment variables:
   - `VITE_API_URL=https://<render-host>/api`
   - `VITE_SOCKET_URL=https://<render-host>`
4. Deploy. The `client/vercel.json` rewrite supports React Router routes.
5. Return to Render and set `CLIENT_ORIGIN` to the final Vercel URL, then redeploy the backend.

Never commit `.env` files or provider keys. The Render Blueprint marks secrets as environment variables.

## 6. Provider setup
| Provider | Get a key | Env var |
|---|---|---|
| Google Gemini | aistudio.google.com/apikey | `GEMINI_API_KEY` |
| OpenRouter | openrouter.ai/keys | `OPENROUTER_API_KEY` |
| OpenAI | platform.openai.com/api-keys | `OPENAI_API_KEY` |
| Anthropic | console.anthropic.com/settings/keys | `ANTHROPIC_API_KEY` |
| Groq | console.groq.com/keys | `GROQ_API_KEY` |
| DeepSeek | platform.deepseek.com/api_keys | `DEEPSEEK_API_KEY` |
| Hugging Face | huggingface.co/settings/tokens | `HF_API_TOKEN` |
| Ollama | ollama.com/download, run `ollama serve` and `ollama pull llama3.2` | `OLLAMA_ENABLED=true` |

**Verify model IDs.** Model names, prices and availability change often. The seed list in `server/config/providers.js` reflects what was known at build time. Use the Test button on the Model selection page, and as admin use Add model to fix an ID or price without touching code. Anthropic is reached through its OpenAI-compatibility endpoint, which Anthropic describes as a compatibility layer, so check it against your needs.

## 7. How a prompt flows
1. **Router** (`agents/agentRouter.js`): a fast LLM classifier picks agents, with keyword scoring as fallback (set `ROUTER_USE_LLM=false` to skip the LLM call). Cached for 10 minutes.
2. **Selector** (`services/modelSelector.js`): ranks models by capability, your preferred model, strategy (balanced/quality/speed/cost), cost ceiling, and a diversity penalty so agents land on different models.
3. **Orchestrator** (`services/aiOrchestrator.js`): runs agents in parallel behind a concurrency gate, with timeouts, exponential-backoff retries and fallback to the next model. One agent failing never stops the others. Cancel aborts every in-flight request.
4. **Critic** scores each answer (accuracy, relevance, completeness, clarity, reasoning, instruction adherence). Scores are one model's opinion, not verification, and the UI says so.
5. **Synthesizer** streams the final merged answer.

Modes: **Parallel**, **Collaborate** (agents read each other and refine over up to `MAX_COLLAB_ROUNDS`, stopping early when nobody has changes), **Model arena** (one agent, several models).

## 8. Security notes
Passwords hashed with bcrypt (12 rounds); JWT auth on REST and sockets; API keys encrypted with AES-256-GCM and never returned (only the last 4 characters); every query is scoped to the signed-in user; zod validation; helmet, CORS allow-list and rate limits; uploaded text and other agents' output are wrapped in tagged blocks the model is told to treat as data (prompt-injection hygiene, not a guarantee). The JWT is kept in `localStorage`; for a hardened deployment move it to an httpOnly cookie.

## 9. Tests
`npm test` runs backend tests against a local fake provider (streaming, fallback, cancellation, router, selector, encryption). These need no database or API keys.

## 10. Known limits
- Clarification requests between agents are not implemented; collaboration is critique-and-revise rounds.
- Scanned PDFs need OCR first. Images work only with vision-capable models.
- Cost figures are estimates from the pricing stored on each model.
- Uploaded files auto-delete after 24 hours.
