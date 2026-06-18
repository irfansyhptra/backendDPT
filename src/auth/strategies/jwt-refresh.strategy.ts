import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'dpt-dev-refresh-token-secret-key-32chars-long-or-more',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string; sessionId: string }) {
    const refreshToken = req.body.refreshToken;
    return {
      userId: payload.sub,
      sessionId: payload.sessionId,
      refreshToken,
    };
  }
}
