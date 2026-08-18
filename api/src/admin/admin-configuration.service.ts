import { BadRequestException, Injectable } from '@nestjs/common';
import { BusinessRulesService } from '../configuration/business-rules.service';
import { BusinessRules } from '../configuration/business-rules.constants';
import { AuditService } from '../audit/audit.service';
import { UpdateBusinessRulesDto } from './dto/update-business-rules.dto';
import {
  EmailConfigService,
  EmailConfigPublic,
} from '../email/email-config.service';
import { EmailService } from '../email/email.service';
import { UpdateEmailConfigDto } from './dto/update-email-config.dto';
import { SendTestEmailDto } from './dto/send-test-email.dto';

@Injectable()
export class AdminConfigurationService {
  constructor(
    private readonly businessRules: BusinessRulesService,
    private readonly audit: AuditService,
    private readonly emailConfig: EmailConfigService,
    private readonly email: EmailService,
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

  async getEmailConfig(): Promise<EmailConfigPublic> {
    return this.emailConfig.get();
  }

  async updateEmailConfig(
    actorPhone: string,
    dto: UpdateEmailConfigDto,
    ip: string,
    ua: string,
  ): Promise<EmailConfigPublic> {
    const prevValue = await this.emailConfig.get();
    const newValue = await this.emailConfig.set(dto, actorPhone);

    await this.audit.log({
      userPhone: actorPhone,
      action: 'email_config_updated',
      entity: 'configuration',
      prevValue,
      // Nunca auditar la contraseña, ni la que llega en el body ni la guardada.
      newValue: {
        host: newValue.host,
        port: newValue.port,
        secure: newValue.secure,
        user: newValue.user,
      },
      ip,
      userAgent: ua,
    });

    return newValue;
  }

  async sendTestEmail(
    actorPhone: string,
    dto: SendTestEmailDto,
    ip: string,
    ua: string,
  ): Promise<{ simulated: boolean }> {
    const config = await this.emailConfig.get();
    if (!config.user || !config.hasPassword) {
      throw new BadRequestException(
        'Configura usuario y contraseña de correo antes de enviar una prueba',
      );
    }

    let result: Awaited<ReturnType<EmailService['send']>>;
    try {
      result = await this.email.send(
        dto.to,
        'Correo de prueba — AppPrestamitos',
        `<p>${dto.text}</p>`,
      );
    } catch (err) {
      throw new BadRequestException(
        `No se pudo enviar el correo de prueba: ${
          err instanceof Error ? err.message : 'error desconocido'
        }`,
      );
    }

    await this.audit.log({
      userPhone: actorPhone,
      action: 'email_test_sent',
      entity: 'configuration',
      newValue: { to: dto.to },
      ip,
      userAgent: ua,
    });

    return { simulated: 'simulated' in result && !!result.simulated };
  }
}
