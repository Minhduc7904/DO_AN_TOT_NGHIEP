import { createServer } from 'node:http';

/**
 * Provider LLM giả tương thích OpenAI chat-completions, chạy trong container cùng network với stack.
 * Trả công cụ `save_lesson_content` hoặc `create_quiz` theo danh sách `tools` của request, và ghi lại
 * các Bearer token đã thấy để workflow kiểm API key được giải mã đúng.
 */
const port = Number(process.env.PORT ?? 8080);
const bearers = new Set();
let chatCalls = 0;

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

const QUIZ = {
  title: 'Quiz do AI soạn',
  description_markdown: 'Sinh bởi provider giả',
  questions: [
    {
      question_markdown: 'Quy hoạch động dựa trên gì?',
      question_type: 'SINGLE_CHOICE',
      points: 1,
      options: [
        { option_markdown: 'Bài toán con gối nhau', is_correct: true },
        { option_markdown: 'Ngẫu nhiên', is_correct: false },
        { option_markdown: 'Không có', is_correct: false },
      ],
    },
  ],
};

createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', 'http://provider');
    const bearer = /^Bearer (.+)$/u.exec(request.headers.authorization ?? '')?.[1];
    if (url.pathname === '/__seen')
      return send(response, 200, { bearers: [...bearers], chat_calls: chatCalls });
    if (bearer) bearers.add(bearer);
    if (request.method === 'GET' && url.pathname === '/v1/models') {
      return send(response, 200, { data: [{ id: 'regression-model' }] });
    }
    if (request.method === 'POST' && url.pathname === '/v1/chat/completions') {
      chatCalls += 1;
      const body = JSON.parse((await readBody(request)) || '{}');
      const tools = (body.tools ?? []).map((tool) => tool.function?.name);
      const last = body.messages?.at(-1);
      let message = { role: 'assistant', content: 'Hoàn tất.' };
      let finishReason = 'stop';
      if (last?.role !== 'tool') {
        const name = tools.includes('save_lesson_content')
          ? 'save_lesson_content'
          : tools.includes('create_quiz')
            ? 'create_quiz'
            : null;
        if (name) {
          const args =
            name === 'create_quiz' ? QUIZ : { markdown: '# Bài học do AI soạn\n\nNội dung mẫu.' };
          message = {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name, arguments: JSON.stringify(args) },
              },
            ],
          };
          finishReason = 'tool_calls';
        }
      }
      return send(response, 200, {
        choices: [{ finish_reason: finishReason, message }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    }
    send(response, 404, { error: 'not found' });
  })();
}).listen(port, '0.0.0.0');
