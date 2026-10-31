/**
 * Provider registry. Model availability, pricing and IDs change often, so everything
 * here is data: edit this file (or use the Models page as admin) instead of code.
 * `type` selects the adapter: "openai" = any OpenAI-compatible /chat/completions API.
 */
export const PROVIDERS = {
  gemini: {
    label: 'Google Gemini', type: 'gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    envKey: 'GEMINI_API_KEY', docs: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    label: 'OpenRouter', type: 'openai', baseURL: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY', docs: 'https://openrouter.ai/keys',
    headers: { 'X-Title': 'Multi-Agent AI Platform' },
  },
  openai: {
    label: 'OpenAI', type: 'openai', baseURL: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY', docs: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    // Anthropic's OpenAI-compatibility endpoint.
    label: 'Anthropic Claude', type: 'openai', baseURL: 'https://api.anthropic.com/v1',
    envKey: 'ANTHROPIC_API_KEY', docs: 'https://console.anthropic.com/settings/keys',
  },
  groq: {
    label: 'Groq', type: 'openai', baseURL: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY', docs: 'https://console.groq.com/keys',
  },
  deepseek: {
    label: 'DeepSeek', type: 'openai', baseURL: 'https://api.deepseek.com/v1',
    envKey: 'DEEPSEEK_API_KEY', docs: 'https://platform.deepseek.com/api_keys',
  },
  huggingface: {
    label: 'Hugging Face', type: 'openai', baseURL: 'https://router.huggingface.co/v1',
    envKey: 'HF_API_TOKEN', docs: 'https://huggingface.co/settings/tokens',
  },
  ollama: {
    label: 'Ollama (local)', type: 'openai', baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    envKey: null, keyless: true, docs: 'https://ollama.com/download',
  },
};

/**
 * Seed models. Inserted once, never overwriting admin edits. IDs reflect what was known at
 * build time -- verify them against each provider's current model list and edit them on the
 * Models page. qualityTier / speedTier: 1 (low) .. 3 (high).
 */
export const SEED_MODELS = [
  { name: 'Gemini 3.5 Flash-Lite (Free)', provider: 'gemini', modelId: 'gemini-3.5-flash-lite', capabilities: ['chat', 'code', 'math', 'reasoning', 'creative', 'vision', 'long-context'], contextWindow: 1000000, qualityTier: 1, speedTier: 3, pricingInformation: { inputPer1M: 0, outputPer1M: 0 } },
  { name: 'DeepSeek V3', provider: 'openrouter', modelId: 'deepseek/deepseek-chat', capabilities: ['chat', 'code', 'math', 'reasoning'], contextWindow: 64000, qualityTier: 3, speedTier: 2, pricingInformation: { inputPer1M: 0.3, outputPer1M: 1.2 } },
  { name: 'Llama 3.3 70B', provider: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct', capabilities: ['chat', 'code', 'creative'], contextWindow: 128000, qualityTier: 2, speedTier: 2, pricingInformation: { inputPer1M: 0.12, outputPer1M: 0.3 } },
  { name: 'Qwen 2.5 72B', provider: 'openrouter', modelId: 'qwen/qwen-2.5-72b-instruct', capabilities: ['chat', 'code', 'math'], contextWindow: 32000, qualityTier: 2, speedTier: 2, pricingInformation: { inputPer1M: 0.12, outputPer1M: 0.39 } },
  { name: 'Mistral Small 3.1', provider: 'openrouter', modelId: 'mistralai/mistral-small-3.1-24b-instruct', capabilities: ['chat', 'creative', 'vision'], contextWindow: 128000, qualityTier: 2, speedTier: 3, pricingInformation: { inputPer1M: 0.1, outputPer1M: 0.3 } },
  { name: 'Llama 3.3 70B (Groq)', provider: 'groq', modelId: 'llama-3.3-70b-versatile', capabilities: ['chat', 'code', 'creative'], contextWindow: 128000, qualityTier: 2, speedTier: 3, pricingInformation: { inputPer1M: 0.59, outputPer1M: 0.79 } },
  { name: 'GPT-4o mini', provider: 'openai', modelId: 'gpt-4o-mini', capabilities: ['chat', 'code', 'math', 'creative', 'vision'], contextWindow: 128000, qualityTier: 2, speedTier: 3, pricingInformation: { inputPer1M: 0.15, outputPer1M: 0.6 } },
  { name: 'DeepSeek Chat (direct)', provider: 'deepseek', modelId: 'deepseek-chat', capabilities: ['chat', 'code', 'math', 'reasoning'], contextWindow: 64000, qualityTier: 3, speedTier: 2, pricingInformation: { inputPer1M: 0.27, outputPer1M: 1.1 } },
  { name: 'Llama 3.2 (local)', provider: 'ollama', modelId: 'llama3.2', capabilities: ['chat', 'creative'], contextWindow: 128000, qualityTier: 1, speedTier: 2, pricingInformation: { inputPer1M: 0, outputPer1M: 0 } },
];
