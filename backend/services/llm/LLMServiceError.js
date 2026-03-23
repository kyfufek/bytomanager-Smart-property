class LLMServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "LLMServiceError";
    this.code = options.code || "LLM_UNKNOWN_ERROR";
    this.status = options.status || 500;
    this.cause = options.cause;
    this.provider = options.provider;
  }
}

module.exports = { LLMServiceError };
