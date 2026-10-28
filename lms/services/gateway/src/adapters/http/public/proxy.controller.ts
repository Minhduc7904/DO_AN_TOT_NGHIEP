import { RawResponse } from '@aiops-lms/common/http';
import { PUBLIC_PREFIX } from '@aiops-lms/contracts/http/common';
import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { ProxyRequestUseCase } from '../../../application/use-cases/proxy-request.use-case.js';

/**
 * Cổng vào duy nhất cho `/api/v1/**` (bề mặt public). Route `/internal/**`, `/.well-known/**` và mọi
 * path ngoài `/api` không được proxy (Nest trả 404 envelope). Phản hồi upstream được stream nguyên vẹn nên bỏ qua envelope
 * interceptor; lỗi do chính Gateway sinh ra vẫn đi qua `AppExceptionFilter`.
 */
@RawResponse()
@Controller(PUBLIC_PREFIX)
export class ProxyController {
  constructor(@Inject(ProxyRequestUseCase) private readonly proxy: ProxyRequestUseCase) {}

  @All('*path')
  async handle(@Req() request: IncomingMessage, @Res() response: ServerResponse): Promise<void> {
    const abort = new AbortController();
    // Client ngắt trước khi phản hồi xong thì hủy lời gọi upstream.
    response.once('close', () => {
      if (!response.writableFinished) abort.abort();
    });

    const upstream = await this.proxy.execute({
      method: request.method ?? 'GET',
      url: request.url ?? '/',
      headers: request.headers,
      body: request,
      signal: abort.signal,
    });

    response.statusCode = upstream.status;
    for (const [name, value] of Object.entries(upstream.headers)) response.setHeader(name, value);
    if (!upstream.body) {
      response.end();
      return;
    }
    try {
      await pipeline(Readable.from(upstream.body), response);
    } catch {
      // Upstream đứt giữa chừng hoặc client ngắt: header đã gửi nên không thể trả envelope lỗi.
      response.destroy();
    }
  }
}
