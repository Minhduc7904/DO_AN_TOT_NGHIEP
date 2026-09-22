import { Controller, Get, Header } from '@nestjs/common';

interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  @Header('Cache-Control', 'no-store')
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
