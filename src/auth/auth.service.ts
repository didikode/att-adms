import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email atau kata sandi tidak valid');
    }

    return {
      accessToken: await this.jwtService.signAsync({ role: user.role, sub: user.id }),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async profile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true, active: true },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException();
    }
    return { email: user.email, role: user.role };
  }
}
