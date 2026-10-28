import {
  buildChatPayload,
  parseChatResponse,
} from '../../src/adapters/provider/openai-compatible-chat.client.js';
import {
  extractProviderMessage,
  providerHeaders,
  providerUrl,
  sanitizeProviderText,
} from '../../src/adapters/provider/provider-http.js';
import {
  ProviderCallError,
  type ChatRequest,
} from '../../src/application/ports/provider-client.js';

const KEY = 'sk-test-key-0123456789';

function request(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    providerType: 'OPENAI',
    baseUrl: 'http://llm.corp.internal:8080/v1/',
    apiKey: KEY,
    modelName: 'gpt-4o',
    messages: [{ role: 'user', text: 'xin chào' }],
    tools: [],
    ...overrides,
  };
}

describe('payload chat-completions', () => {
  it('văn bản thường và tools theo chuẩn OpenAI', () => {
    const payload = JSON.parse(
      buildChatPayload(
        request({
          messages: [
            { role: 'system', text: 'hệ thống' },
            {
              role: 'assistant',
              toolCalls: [{ id: 'c1', name: 'save', argumentsJson: '{"x":1}' }],
            },
            { role: 'tool', text: '{"ok":true}', toolCallId: 'c1' },
          ],
          tools: [{ name: 'save', description: 'Lưu', parametersSchema: { type: 'object' } }],
        }),
      ),
    ) as Record<string, unknown>;

    expect(payload).toEqual({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'hệ thống' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'c1', type: 'function', function: { name: 'save', arguments: '{"x":1}' } },
          ],
        },
        { role: 'tool', tool_call_id: 'c1', content: '{"ok":true}' },
      ],
      tools: [
        {
          type: 'function',
          function: { name: 'save', description: 'Lưu', parameters: { type: 'object' } },
        },
      ],
    });
  });

  it('ảnh qua image_url, PDF qua phần file; Gemini nhận PDF như image_url', () => {
    const parts = [
      { type: 'text' as const, text: 'đọc' },
      { type: 'image' as const, mediaType: 'image/png', dataBase64: 'AAAA' },
      {
        type: 'file' as const,
        mediaType: 'application/pdf',
        dataBase64: 'BBBB',
        fileName: 'a.pdf',
      },
    ];
    const openai = JSON.parse(
      buildChatPayload(request({ messages: [{ role: 'user', parts }] })),
    ) as {
      messages: { content: unknown[] }[];
    };
    const gemini = JSON.parse(
      buildChatPayload(request({ providerType: 'GEMINI', messages: [{ role: 'user', parts }] })),
    ) as { messages: { content: unknown[] }[] };

    expect(openai.messages[0]?.content).toEqual([
      { type: 'text', text: 'đọc' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      { type: 'file', file: { filename: 'a.pdf', file_data: 'data:application/pdf;base64,BBBB' } },
    ]);
    expect(gemini.messages[0]?.content[2]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:application/pdf;base64,BBBB' },
    });
  });
});

describe('phản hồi chat-completions', () => {
  it('đọc văn bản, tool_calls (sinh id khi thiếu), finish_reason và usage', () => {
    const result = parseChatResponse(
      JSON.stringify({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                { id: '', function: { name: 'a', arguments: '{"k":1}' } },
                { id: 'call_x', function: { name: 'b', arguments: { raw: true } } },
                { function: { name: 'c' } },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 11, completion_tokens: 7 },
      }),
      200,
    );

    expect(result).toEqual({
      text: null,
      toolCalls: [
        { id: 'call_1', name: 'a', argumentsJson: '{"k":1}' },
        { id: 'call_x', name: 'b', argumentsJson: '{"raw":true}' },
        { id: 'call_3', name: 'c', argumentsJson: '{}' },
      ],
      finishReason: 'tool_calls',
      promptTokens: 11,
      completionTokens: 7,
    });
  });

  it('phản hồi không đọc được thì invalid-response', () => {
    for (const body of [
      'không phải json',
      '{}',
      '{"choices":[]}',
      '{"choices":[{"message":{"tool_calls":[{"function":{}}]}}]}',
    ]) {
      expect(() => parseChatResponse(body, 200)).toThrow(ProviderCallError);
    }
  });
});

describe('làm sạch thông điệp provider', () => {
  it('che API key, URL và host của provider rồi cắt ngắn', () => {
    const text = `Invalid key ${KEY} for http://llm.corp.internal:8080/v1/chat, host llm.corp.internal rejected ${'x'.repeat(400)}`;

    const cleaned = sanitizeProviderText(text, request());

    expect(cleaned).not.toContain(KEY);
    expect(cleaned).not.toContain('llm.corp.internal');
    expect(cleaned).not.toContain('8080');
    expect(cleaned.length).toBeLessThanOrEqual(303);
    expect(cleaned).toContain('***');
  });

  it('lấy message từ nhiều dạng body lỗi', () => {
    expect(extractProviderMessage('{"error":{"message":"bad tool"}}')).toBe('bad tool');
    expect(extractProviderMessage('{"error":"plain"}')).toBe('plain');
    expect(extractProviderMessage('[{"error":{"message":"in array"}}]')).toBe('in array');
    expect(extractProviderMessage('<html>')).toBeNull();
    expect(extractProviderMessage('{"other":1}')).toBeNull();
  });
});

describe('request tới provider', () => {
  it('ghép URL không trùng dấu gạch chéo; header Bearer, thêm x-api-key cho Anthropic', () => {
    expect(providerUrl('http://h:1/v1/', 'chat/completions').href).toBe(
      'http://h:1/v1/chat/completions',
    );
    expect(providerUrl('http://h:1/v1', 'models').href).toBe('http://h:1/v1/models');

    const openai = providerHeaders({ providerType: 'OPENAI', baseUrl: 'http://h', apiKey: KEY });
    expect(openai.authorization).toBe(`Bearer ${KEY}`);
    expect(openai['x-api-key']).toBeUndefined();
    const anthropic = providerHeaders({
      providerType: 'ANTHROPIC',
      baseUrl: 'http://h',
      apiKey: KEY,
    });
    expect(anthropic['x-api-key']).toBe(KEY);
    expect(anthropic['anthropic-version']).toBe('2023-06-01');
  });
});
