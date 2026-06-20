// DeepSeek 流式聊天客户端 —— 浏览器端 OpenAI-compatible API
//
// 直连 api.deepseek.com，支持：
// - 流式 SSE 响应
// - Function Calling（工具调用）
// - 超时与错误处理
//
// 依赖：fetch（浏览器原生）、TextDecoder

const DEEPSEEK_CONFIG = {
  API_KEY: 'sk-64b841c7f169475eaf8e469c9ddb1c7f',
  BASE_URL: 'https://api.deepseek.com',
  MODEL: 'deepseek-chat',
  TIMEOUT_MS: 60000,
  MAX_TOOL_ROUNDS: 5  // Function calling 最大轮数
};

/**
 * 生成唯一 ID
 */
function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 将 tool 定义转换为 OpenAI function calling 格式
 * @param {Array<{name:string, description:string, parameters?:object}>} tools
 * @returns {Array} OpenAI tools 格式
 */
function toOpenAITools(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: 'object', properties: {}, required: [] }
    }
  }));
}

/**
 * DeepSeek 流式聊天客户端
 */
export class DeepSeekClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || DEEPSEEK_CONFIG.API_KEY;
    this.baseUrl = config.baseUrl || DEEPSEEK_CONFIG.BASE_URL;
    this.model = config.model || DEEPSEEK_CONFIG.MODEL;
    this.timeout = config.timeout || DEEPSEEK_CONFIG.TIMEOUT_MS;
  }

  /**
   * 流式聊天（支持 Function Calling）
   *
   * @param {Array<{role:string, content:string|object, tool_calls?:Array}>} messages - 对话历史
   * @param {Array<{name:string, description:string, parameters?:object}>} tools - 可用工具列表
   * @param {object} callbacks
   * @param {function(string):void} callbacks.onChunk - 收到文本增量
   * @param {function({name:string, args:object}):void} callbacks.onToolCall - 收到工具调用
   * @param {function(string):void} callbacks.onThinking - 收到思考内容（deepseek-reasoner）
   * @returns {Promise<{content:string|null, tool_calls:Array|null}>} 完整响应
   */
  async streamChat(messages, tools, { onChunk, onToolCall, onThinking } = {}) {
    const body = {
      model: this.model,
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 2048
    };

    if (tools && tools.length > 0) {
      body.tools = toOpenAITools(tools);
      body.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 300)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let content = '';
      let toolCalls = [];
      let toolCallMap = {};  // index -> { id, name, arguments }

      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            // 文本内容
            if (delta.content) {
              content += delta.content;
              onChunk?.(delta.content);
            }

            // 思考内容（deepseek-reasoner）
            if (delta.reasoning_content) {
              onThinking?.(delta.reasoning_content);
            }

            // 工具调用
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;

                if (!toolCallMap[idx]) {
                  toolCallMap[idx] = {
                    id: tc.id || uid(),
                    name: tc.function?.name || '',
                    arguments: ''
                  };
                }

                if (tc.id) toolCallMap[idx].id = tc.id;
                if (tc.function?.name) toolCallMap[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCallMap[idx].arguments += tc.function.arguments;

                onToolCall?.({
                  name: toolCallMap[idx].name,
                  args: toolCallMap[idx].arguments,
                  id: toolCallMap[idx].id,
                  partial: true
                });
              }
            }
          } catch (_) {
            // 无法解析的行，跳过
          }
        }
      }

      // 组装完整 tool_calls
      const indexes = Object.keys(toolCallMap).sort((a, b) => Number(a) - Number(b));
      toolCalls = indexes.map((i) => {
        const tc = toolCallMap[i];
        let args = {};
        try {
          args = tc.arguments ? JSON.parse(tc.arguments) : {};
        } catch (_) {
          args = { _raw: tc.arguments };
        }
        return { id: tc.id, name: tc.name, arguments: args };
      });

      return {
        content: content || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : null
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 非流式聊天（用于简单的单轮 tool 调用）
   */
  async chat(messages, tools) {
    const body = {
      model: this.model,
      messages,
      temperature: 0.3,
      max_tokens: 2048
    };

    if (tools && tools.length > 0) {
      body.tools = toOpenAITools(tools);
      body.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 300)}`);
      }

      const json = await response.json();
      const msg = json.choices?.[0]?.message;
      if (!msg) throw new Error('DeepSeek returned no message');

      const tool_calls = msg.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}')
      }));

      return {
        content: msg.content || null,
        tool_calls: tool_calls || null
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 默认单例 */
let _instance = null;
export function getDeepSeekClient() {
  if (!_instance) _instance = new DeepSeekClient();
  return _instance;
}

export { DEEPSEEK_CONFIG, toOpenAITools };
