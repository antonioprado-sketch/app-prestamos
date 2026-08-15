import { Injectable } from '@nestjs/common';
import { BusinessRulesService } from '../configuration/business-rules.service';
import { BusinessRules } from '../configuration/business-rules.constants';
import { AuditService } from '../audit/audit.service';
import { UpdateBusinessRulesDto } from './dto/update-business-rules.dto';

@Injectable()
export class AdminConfigurationService {
  constructor(
    private readonly businessRules: BusinessRulesService,
    private readonly audit: AuditService,
  ) {}

  async getBusinessRules(): Promise<BusinessRules> {
    return this.businessRules.get();
  }

  async updateBusinessRules(
    actorPhone: string,
    dto: UpdateBusinessRulesDto,
    ip: string,
    ua: string,
  ): Promise<BusinessRules> {
    const prevValue = await this.businessRules.get();
    const newValue = await this.businessRules.set(dto, actorPhone);

    await this.audit.log({
      userPhone: actorPhone,
      action: 'business_rules_updated',
      entity: 'configuration',
      prevValue,
      newValue,
      ip,
      userAgent: ua,
    });

    return newValue;
  }
}
