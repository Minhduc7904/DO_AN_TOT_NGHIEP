/**
 * Ma trận luồng ↔ tập service phải xuất hiện trong MỘT trace (topology v2). Mỗi luồng là điều kiện
 * của DoD "trace đủ span xuyên service": `services` là tập tối thiểu, `root` là service sở hữu span
 * gốc, `spans` là các span bắt buộc (đúng service, kind và tên). Giá trị lấy từ số đo trên stack thật
 * (xem board R-12); luồng bất đồng bộ phải nối vào trace của request HTTP gây ra nó.
 */
export const FLOWS = [
  {
    id: 'http-login',
    title: 'Đăng nhập: gateway → identity',
    root: 'gateway',
    services: ['gateway', 'identity'],
    spans: [
      {
        service: 'identity',
        kind: 'SERVER',
        name: /^POST \/api\/v1\/auth\/(student|instructor|admin)\/login$/,
      },
      { service: 'identity', kind: 'CLIENT', name: /^identity-postgres / },
    ],
  },
  {
    id: 'http-register',
    title: 'Đăng ký: gateway → identity (một transaction PostgreSQL)',
    root: 'gateway',
    services: ['gateway', 'identity'],
    spans: [
      {
        service: 'identity',
        kind: 'SERVER',
        name: /^POST \/api\/v1\/auth\/register$/,
      },
      { service: 'identity', kind: 'CLIENT', name: /^identity-postgres / },
    ],
  },
  {
    id: 'http-course-authoring',
    title: 'Soạn khóa học: gateway → course',
    root: 'gateway',
    services: ['gateway', 'course'],
    spans: [{ service: 'course', kind: 'CLIENT', name: /^course-postgres / }],
  },
  {
    id: 'http-media-upload',
    title: 'Upload media: gateway → media, thumbnail qua media-worker',
    root: 'gateway',
    services: ['gateway', 'media', 'media-worker'],
    spans: [
      { service: 'media', kind: 'CLIENT', name: /^media-minio / },
      {
        service: 'media-worker',
        kind: 'CONSUMER',
        name: /^media-worker--generate-media-thumbnail-v1 process$/,
      },
    ],
  },
  {
    id: 'async-markdown-usage',
    title: 'Đồng bộ usage markdown: gateway → course → (outbox) media-worker',
    root: 'gateway',
    services: ['gateway', 'course', 'media-worker'],
    spans: [
      {
        service: 'media-worker',
        kind: 'CONSUMER',
        name: /^media-worker--synchronize-markdown-media-usage-v1 process$/,
      },
    ],
  },
  {
    id: 'async-notification-batch',
    title:
      'Thông báo hàng loạt: gateway → notification → (outbox) notification-worker → identity, SMTP',
    root: 'gateway',
    services: ['gateway', 'notification', 'notification-worker', 'identity'],
    spans: [
      {
        service: 'notification-worker',
        kind: 'CONSUMER',
        name: /^notification-worker--snapshot-notification-batch-v1 process$/,
      },
      {
        service: 'notification-worker',
        kind: 'CONSUMER',
        name: /^notification-worker--dispatch-notification-batch-v1 process$/,
      },
      { service: 'identity', kind: 'SERVER' },
      { service: 'notification-worker', kind: 'CLIENT', name: /^notification-smtp / },
    ],
  },
  {
    id: 'async-ai-job',
    title: 'Job AI soạn bài: gateway → course → ai → (outbox) ai-worker → course, provider',
    root: 'gateway',
    services: ['gateway', 'course', 'ai', 'ai-worker'],
    spans: [
      { service: 'ai-worker', kind: 'CONSUMER', name: /^ai-worker--run-ai-job-v1 process$/ },
      { service: 'ai-worker', kind: 'CLIENT', name: /^ai-llm-provider / },
      { service: 'course', kind: 'SERVER', name: /ai-context$/ },
    ],
  },
  {
    id: 'async-ai-extract',
    title: 'Trích văn bản tài liệu: gateway → media → (outbox) ai-worker',
    root: 'gateway',
    services: ['gateway', 'media', 'ai-worker'],
    spans: [
      {
        service: 'ai-worker',
        kind: 'CONSUMER',
        name: /^ai-worker--extract-ai-document-v1 process$/,
      },
    ],
  },
  {
    id: 'scheduler-media-cleanup',
    title: 'Dọn media theo lịch: scheduler-worker → media → MinIO',
    root: 'scheduler-worker',
    services: ['scheduler-worker', 'media'],
    spans: [
      { service: 'scheduler-worker', kind: 'CLIENT', name: /^scheduler-worker-media POST/ },
      { service: 'media', kind: 'CLIENT', name: /^media-minio remove-object/ },
    ],
  },
];

/** Truy vấn TraceQL chọn các trace có đủ `services` (mỗi service một spanset). */
export function flowQuery(flow) {
  return flow.services.map((service) => `{ resource.service.name = "${service}" }`).join(' && ');
}

/**
 * Kiểm một trace theo luồng; trả danh sách lỗi (rỗng nghĩa là đạt). `spans` đã gắn `service`,
 * `spanId`, `parentSpanId` (xem `support/telemetry.mjs`).
 */
export function checkFlow(spans, flow) {
  const problems = [];
  const present = new Set(spans.map((span) => span.service));
  for (const service of flow.services) {
    if (!present.has(service)) problems.push(`thiếu service ${service}`);
  }
  const ids = new Set(spans.map((span) => span.spanId));
  const roots = spans.filter((span) => !span.parentSpanId || !ids.has(span.parentSpanId));
  if (roots.length !== 1) problems.push(`có ${roots.length} span gốc (cần đúng 1: trace bị đứt)`);
  else if (roots[0].service !== flow.root) {
    problems.push(`span gốc thuộc ${roots[0].service}, cần ${flow.root}`);
  }
  for (const wanted of flow.spans) {
    const found = spans.some(
      (span) =>
        span.service === wanted.service &&
        span.kind === `SPAN_KIND_${wanted.kind}` &&
        (!wanted.name || wanted.name.test(span.name)),
    );
    if (!found) {
      problems.push(`thiếu span ${wanted.service}/${wanted.kind}/${wanted.name ?? '*'}`);
    }
  }
  return problems;
}
