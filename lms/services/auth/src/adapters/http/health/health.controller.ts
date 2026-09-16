import { Controller, Get, Header } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  @Header('Cache-Control', 'no-store')
  getHealth(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
