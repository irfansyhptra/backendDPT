import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      
      const bodySanitized = this.sanitize(req.body);
      const querySanitized = this.sanitize(req.query);

      this.logger.log(
        `[${method}] ${originalUrl} ${statusCode} - ${duration}ms - IP: ${ip} - UA: ${userAgent} - Query: ${JSON.stringify(querySanitized)} - Body: ${JSON.stringify(bodySanitized)}`,
      );
    });

    next();
  }

  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = { ...obj };
    const sensitiveKeys = [
      'password',
      'currentPassword',
      'newPassword',
      'token',
      'refreshToken',
      'accessToken',
      'accessTokenHash',
      'refreshTokenHash',
    ];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.includes(key)) {
        sanitized[key] = '***';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }

    return sanitized;
  }
}
