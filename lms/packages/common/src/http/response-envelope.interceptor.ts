import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';

import { buildSuccessEnvelope, Page } from './response-envelope.js';

const RAW_RESPONSE_KEY = 'lms:raw-response';

/** Route trả byte hoặc stream (media content, export CSV): không bọc envelope. */
export const RawResponse = (): MethodDecorator & ClassDecorator =>
  SetMetadata(RAW_RESPONSE_KEY, true);

/** Bọc mọi kết quả thành công của controller vào envelope thống nhất. */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(RAW_RESPONSE_KEY, targets)) {
      return next.handle();
    }
    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof StreamableFile) return value;
        if (value instanceof Page) return buildSuccessEnvelope(value.items, value.pagination);
        return buildSuccessEnvelope(value === undefined ? null : value);
      }),
    );
  }
}
