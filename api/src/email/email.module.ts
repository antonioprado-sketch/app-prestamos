import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailConfigService } from './email-config.service';

@Global()
@Module({
  providers: [EmailService, EmailConfigService],
  exports: [EmailService, EmailConfigService],
})
export class EmailModule {}
