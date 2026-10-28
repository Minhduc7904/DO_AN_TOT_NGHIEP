import type { ProviderKind } from '../../domain/ai.js';
import {
  type ChatClient,
  type ChatMessage,
  type ChatPart,
  type ChatRequest,
  type ChatResult,
  ProviderCallError,
  type ToolCall,
} from '../../application/ports/provider-client.js';
import {
  callProvider,
  extractProviderMessage,
  type ProviderHttpResponse,
  sanitizeProviderText,
} from './provider-http.js';

type Json = Record<string, unknown>;

function dataUri(mediaType: string, dataBase64: string): string {
  return `data:${mediaType};base64,${dataBase64}`;
}

function buildPart(part: ChatPart, kind: ProviderKind): Json {
  switch (part.type) {
    case 'text':
      return { type: 'text', text: part.text };
    case 'image':
      return { type: 'image_url', image_url: { url: dataUri(part.mediaType, part.dataBase64) } };
    case 'file':
      // Lớp tương thích OpenAI của Gemini từ chối part `file` nhưng nhận PDF dưới dạng data URI
      // trong `image_url`; các provider còn lại nhận part `file` chuẩn OpenAI.
      if (kind === 'GEMINI') {
        return { type: 'image_url', image_url: { url: dataUri(part.mediaType, part.dataBase64) } };
      }
      return {
        type: 'file',
        file: {
          filename: part.fileName?.trim() ? part.fileName : 'document.pdf',
          file_data: dataUri(part.mediaType, part.dataBase64),
        },
      };
  }
}

function buildMessage(message: ChatMessage, kind: ProviderKind): Json {
  const result: Json = { role: message.role };
  if (message.role === 'tool') result.tool_call_id = message.toolCallId;
  if (message.parts && message.parts.length > 0) {
    result.content = message.parts.map((part) => buildPart(part, kind));
  } else {
    result.content = message.text ?? null;
  }
  if (message.toolCalls && message.toolCalls.length > 0) {
    result.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: call.argumentsJson },
    }));
  }
  return result;
}

/** Payload `POST {baseUrl}/chat/completions` theo chuẩn OpenAI chat-completions. */
export function buildChatPayload(request: ChatRequest): string {
  const payload: Json = {
    model: request.modelName,
    messages: request.messages.map((message) => buildMessage(message, request.providerType)),
  };
  if (request.tools.length > 0) {
    payload.tools = request.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parametersSchema,
      },
    }));
  }
  return JSON.stringify(payload);
}

function readInt(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : 0;
}

function invalidResponse(status: number): ProviderCallError {
  return new ProviderCallError('invalid-response', status);
}

/** Đọc `choices[0].message` (văn bản và/hoặc `tool_calls`), `finish_reason` và `usage`. */
export function parseChatResponse(body: string, status: number): ChatResult {
  let root: unknown;
  try {
    root = JSON.parse(body);
  } catch {
    throw invalidResponse(status);
  }
  const choices = (root as { choices?: unknown } | null)?.choices;
  const choice = Array.isArray(choices) ? (choices[0] as Json | undefined) : undefined;
  const message = choice?.message as Json | undefined;
  if (!choice || !message || typeof message !== 'object') throw invalidResponse(status);

  const toolCalls: ToolCall[] = [];
  if (Array.isArray(message.tool_calls)) {
    for (const raw of message.tool_calls as Json[]) {
      const fn = raw.function as Json | undefined;
      if (!fn || typeof fn.name !== 'string') throw invalidResponse(status);
      const args = fn.arguments;
      const argumentsJson =
        typeof args === 'string' ? args : args === undefined ? '' : JSON.stringify(args);
      toolCalls.push({
        // Một số provider trả id rỗng; tạo id cục bộ để message `tool` trả lời vẫn ghép được cặp.
        id:
          typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `call_${toolCalls.length + 1}`,
        name: fn.name,
        argumentsJson: argumentsJson.trim().length > 0 ? argumentsJson : '{}',
      });
    }
  }

  const usage = (root as { usage?: Json }).usage;
  return {
    text: typeof message.content === 'string' ? message.content : null,
    toolCalls,
    finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : '',
    promptTokens: readInt(usage?.prompt_tokens),
    completionTokens: readInt(usage?.completion_tokens),
  };
}

/** Phân loại phản hồi HTTP của provider; thông điệp 4xx được làm sạch (che key/URL/host, cắt ngắn). */
function interpret(request: ChatRequest) {
  return (response: ProviderHttpResponse): ChatResult => {
    const { status } = response;
    if (status >= 200 && status < 300) return parseChatResponse(response.text, status);
    if (status === 401 || status === 403) throw new ProviderCallError('auth-failed', status);
    if (status === 429) throw new ProviderCallError('rate-limited', status);
    if (status >= 400 && status < 500) {
      const detail = extractProviderMessage(response.text);
      throw new ProviderCallError(
        'rejected',
        status,
        detail ? sanitizeProviderText(detail, request) : null,
      );
    }
    if (status >= 500) throw new ProviderCallError('upstream-error', status);
    throw invalidResponse(status);
  };
}

/**
 * Client chat-completions cho mọi loại provider (`OPENAI`, `GEMINI`, `ANTHROPIC`, `MISTRAL`,
 * `CUSTOM`) qua endpoint tương thích OpenAI. Gọi đúng một lần, không retry.
 */
export class OpenAiCompatibleChatClient implements ChatClient {
  constructor(private readonly timeoutMs: number) {}

  complete(request: ChatRequest): Promise<ChatResult> {
    return callProvider(
      {
        method: 'POST',
        path: 'chat/completions',
        target: request,
        body: buildChatPayload(request),
        timeoutMs: this.timeoutMs,
      },
      interpret(request),
    );
  }
}
