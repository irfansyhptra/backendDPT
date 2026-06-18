import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getServiceStatus(): { status: string; service: string } {
    return {
      status: 'ok',
      service: 'dpt-auth-service',
    };
  }
}
