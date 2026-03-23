const { LLMServiceError } = require("../LLMServiceError");

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

function buildMessages({ messages, systemPrompt, prompt }) {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages;
  }

  const output = [];
  if (typeof systemPrompt === "string" && systemPrompt.trim()) {
    output.push({ role: "system", content: systemPrompt.trim() });
  }
  if (typeof prompt === "string" && prompt.trim()) {
    output.push({ role: "user", content: prompt.trim() });
  }
  return output;
}

function createOpenAIAdapter(config) {
  const apiKey = config.apiKey;

  if (!apiKey) {
    throw new LLMServiceError("Missing OpenAI API key.", {
      code: "LLM_CONFIG_ERROR",
      status: 500,
      provider: "openai",
    });
  }

  async function generate(params) {
    const model = params.model || config.model;
    const temperature = typeof params.temperature === "number" ? params.temperature : config.temperature;
    const maxTokens = typeof params.maxTokens === "number" ? params.maxTokens : config.maxTokens;
    const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : config.timeoutMs;
    const messages = buildMessages(params);

    if (!model) {
      throw new LLMServiceError("Missing model for OpenAI request.", {
        code: "LLM_CONFIG_ERROR",
        status: 500,
        provider: "openai",
      });
    }

    if (!messages.length) {
      throw new LLMServiceError("Missing prompt/messages for LLM request.", {
        code: "LLM_INPUT_ERROR",
        status: 400,
        provider: "openai",
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        throw new LLMServiceError("OpenAI API request failed.", {
          code: "LLM_PROVIDER_ERROR",
          status: response.status,
          provider: "openai",
          cause: payload,
        });
      }

      const payload = await response.json();
      const text = payload?.choices?.[0]?.message?.content;

      if (typeof text !== "string" || !text.trim()) {
        throw new LLMServiceError("OpenAI API returned empty response.", {
          code: "LLM_EMPTY_RESPONSE",
          status: 502,
          provider: "openai",
          cause: payload,
        });
      }

      return {
        text,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof LLMServiceError) {
        throw error;
      }

      if (error?.name === "AbortError") {
        throw new LLMServiceError("OpenAI request timed out.", {
          code: "LLM_TIMEOUT",
          status: 504,
          provider: "openai",
          cause: error,
        });
      }

      throw new LLMServiceError("Failed to call OpenAI API.", {
        code: "LLM_PROVIDER_ERROR",
        status: 502,
        provider: "openai",
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return { generate };
}

module.exports = { createOpenAIAdapter };
