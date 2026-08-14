import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return true;

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(
        header.slice('Bearer '.length),
        {
          secret: process.env.JWT_ACCESS_SECRET,
        },
      );
      (request as Request & { user?: { phone: string } }).user = {
        phone: payload.sub,
      };
    } catch {
      // token inválido/expirado: se trata como anónimo, no se rechaza la petición
    }
    return true;
  }
}
