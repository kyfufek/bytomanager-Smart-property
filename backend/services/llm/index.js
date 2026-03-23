const { LLMServiceError } = require("./LLMServiceError");
const { createOpenAIAdapter } = require("./providers/openaiAdapter");

function parseNumberEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseEnvConfig() {
  return {
    provider: (process.env.LLM_PROVIDER || "openai").trim().toLowerCase(),
    model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: parseNumberEnv(process.env.LLM_TEMPERATURE ?? process.env.OPENAI_TEMPERATURE, 0.2),
    maxTokens: parseNumberEnv(process.env.LLM_MAX_TOKENS ?? process.env.OPENAI_MAX_TOKENS, 700),
    timeoutMs: parseNumberEnv(process.env.LLM_TIMEOUT_MS, 30000),
    apiKey: process.env.OPENAI_API_KEY,
  };
}

function createProviderAdapter(config) {
  if (config.provider === "openai") {
    return createOpenAIAdapter(config);
  }

  throw new LLMServiceError(`Unsupported LLM provider: ${config.provider}`, {
    code: "LLM_CONFIG_ERROR",
    status: 500,
  });
}

function createLlmService() {
  const config = parseEnvConfig();
  let adapter = null;

  function getAdapter() {
    if (!adapter) {
      adapter = createProviderAdapter(config);
    }
    return adapter;
  }

  async function generateText(params) {
    try {
      const result = await getAdapter().generate({
        ...params,
        model: params?.model || config.model,
        temperature:
          typeof params?.temperature === "number" ? params.temperature : config.temperature,
        maxTokens:
          typeof params?.maxTokens === "number" ? params.maxTokens : config.maxTokens,
        timeoutMs:
          typeof params?.timeoutMs === "number" ? params.timeoutMs : config.timeoutMs,
      });

      return result.text;
    } catch (error) {
      if (error instanceof LLMServiceError) {
        throw error;
      }

      throw new LLMServiceError("Unexpected LLM service failure.", {
        code: "LLM_UNKNOWN_ERROR",
        status: 500,
        cause: error,
      });
    }
  }

  return {
    generateText,
    provider: config.provider,
    model: config.model,
  };
}

const llmService = createLlmService();

module.exports = { llmService, createLlmService, LLMServiceError };
