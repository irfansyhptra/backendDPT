import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getServiceStatus', () => {
    it('returns the backend service status', () => {
      expect(appController.getServiceStatus()).toEqual({
        status: 'ok',
        service: 'dpt-auth-service',
      });
    });
  });
});
