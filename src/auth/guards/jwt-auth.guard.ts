import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info && info.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Sesi Anda telah berakhir, silakan login kembali');
      }
      throw new UnauthorizedException('Sesi tidak valid atau Anda belum login');
    }
    return user;
  }
}
