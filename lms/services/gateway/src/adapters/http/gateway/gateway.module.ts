import { Module } from '@nestjs/common';

import {
  GatewayProxy,
  GATEWAY_FETCH,
  type FetchClient,
} from '../../../application/gateway-proxy.js';
import { GatewayController } from './gateway.controller.js';

@Module({
  controllers: [GatewayController],
  providers: [
    { provide: GATEWAY_FETCH, useValue: fetch },
    {
      provide: GatewayProxy,
      inject: [GATEWAY_FETCH],
      useFactory: (fetchClient: FetchClient): GatewayProxy => new GatewayProxy(fetchClient),
    },
  ],
})
export class GatewayModule {}
