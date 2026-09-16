import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import {
  AuthService,
  type LoginResponse,
  type RefreshResponse,
} from '../../../application/auth.service.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() payload: unknown): Promise<LoginResponse> {
    return this.authService.login(payload);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() payload: unknown): Promise<RefreshResponse> {
    return this.authService.refresh(payload);
  }
}
