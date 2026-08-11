import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(body.email ?? '', body.password ?? '');
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@Req() request: { user: { sub: string } }) {
    return this.authService.profile(request.user.sub);
  }
}
