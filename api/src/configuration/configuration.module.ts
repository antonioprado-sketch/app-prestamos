import { Global, Module } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { BusinessRulesService } from './business-rules.service';

@Global()
@Module({
  providers: [ConfigurationService, BusinessRulesService],
  exports: [ConfigurationService, BusinessRulesService],
})
export class ConfigurationModule {}
