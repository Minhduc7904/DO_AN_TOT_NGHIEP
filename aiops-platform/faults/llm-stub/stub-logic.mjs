/**
 * Phần logic thuần của LLM stub (không mở cổng mạng) để test được độc lập với server.
 *
 * Stub đứng thay provider LLM thật cho case C3: trả lời theo giao thức OpenAI chat-completions,
 * và cho phép chỉnh độ trễ, độ dao động, tỉ lệ lỗi lúc đang chạy. Lỗi ngẫu nhiên lấy từ bộ sinh số
 * có seed để cùng cấu hình và cùng thứ tự request cho ra cùng chuỗi lỗi.
 */

export const DEFAULT_CONTROL = Object.freeze({
  latency_ms: 0,
  jitter_ms: 0,
  error_rate: 0,
  error_mode: 'status',
  error_status: 503,
  affect_models: false,
});

const ERROR_MODES = new Set(['status', 'disconnect']);
const MAX_DELAY_MS = 600_000;

/** Bộ sinh số giả ngẫu nhiên mulberry32: nhỏ, nhanh, đủ đều cho việc chọn request lỗi. */
export function createRng(seed) {
  let state = Number(seed) >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function integerIn(name, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} phải là số nguyên trong [${min}, ${max}], nhận ${value}`);
  }
  return value;
}

/**
 * Gộp phần cấu hình mới vào cấu hình hiện tại và kiểm tra từng trường.
 * Trường lạ bị từ chối để lỗi gõ sai tên (ví dụ `latency`) không âm thầm bị bỏ qua.
 */
export function mergeControl(current, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new TypeError('Cấu hình phải là object JSON');
  }
  const allowed = new Set([...Object.keys(DEFAULT_CONTROL), 'seed']);
  for (const key of Object.keys(patch)) {
    if (!allowed.has(key)) throw new RangeError(`Trường cấu hình không hợp lệ: ${key}`);
  }
  const next = { ...current };
  if ('latency_ms' in patch)
    next.latency_ms = integerIn('latency_ms', patch.latency_ms, 0, MAX_DELAY_MS);
  if ('jitter_ms' in patch)
    next.jitter_ms = integerIn('jitter_ms', patch.jitter_ms, 0, MAX_DELAY_MS);
  if ('error_rate' in patch) {
    const rate = patch.error_rate;
    if (typeof rate !== 'number' || Number.isNaN(rate) || rate < 0 || rate > 1) {
      throw new RangeError(`error_rate phải trong [0, 1], nhận ${rate}`);
    }
    next.error_rate = rate;
  }
  if ('error_mode' in patch) {
    if (!ERROR_MODES.has(patch.error_mode)) {
      throw new RangeError(`error_mode phải là status hoặc disconnect, nhận ${patch.error_mode}`);
    }
    next.error_mode = patch.error_mode;
  }
  if ('error_status' in patch)
    next.error_status = integerIn('error_status', patch.error_status, 400, 599);
  if ('affect_models' in patch) {
    if (typeof patch.affect_models !== 'boolean')
      throw new TypeError('affect_models phải là boolean');
    next.affect_models = patch.affect_models;
  }
  return next;
}

/**
 * Quyết định số phận một request: trễ bao lâu và có lỗi không.
 * Luôn rút đúng hai số ngẫu nhiên mỗi request để chuỗi quyết định không phụ thuộc cấu hình trước đó.
 */
export function decideFault(rng, control) {
  const jitterDraw = rng();
  const errorDraw = rng();
  const delayMs = control.latency_ms + Math.floor(jitterDraw * (control.jitter_ms + 1));
  const failed = errorDraw < control.error_rate;
  return {
    delayMs: Math.min(delayMs, MAX_DELAY_MS),
    error: failed ? { mode: control.error_mode, status: control.error_status } : null,
  };
}

const QUIZ = {
  title: 'Quiz do AI soạn',
  description_markdown: 'Sinh bởi LLM stub',
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

/**
 * Tạo phản hồi chat-completions. Nếu request khai báo công cụ `save_lesson_content` hoặc
 * `create_quiz` và lượt cuối chưa phải kết quả công cụ, stub gọi công cụ đó (giống provider thật
 * dùng function calling); ngược lại trả lời văn bản để vòng lặp của `ai-worker` kết thúc.
 */
export function buildChatResponse(body) {
  const tools = (body?.tools ?? []).map((tool) => tool?.function?.name);
  const last = Array.isArray(body?.messages) ? body.messages.at(-1) : undefined;
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
          { id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } },
        ],
      };
      finishReason = 'tool_calls';
    }
  }
  return {
    id: 'chatcmpl-llm-stub',
    object: 'chat.completion',
    model: body?.model ?? 'llm-stub',
    choices: [{ index: 0, finish_reason: finishReason, message }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

/** Thân lỗi theo dạng lỗi của OpenAI để client hiểu như lỗi provider thật. */
export function buildErrorBody(status) {
  return {
    error: {
      message: `LLM stub chèn lỗi HTTP ${status}`,
      type: status >= 500 ? 'server_error' : 'invalid_request_error',
      code: 'llm_stub_injected',
    },
  };
}
