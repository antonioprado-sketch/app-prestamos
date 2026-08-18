import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailConfigService } from './email-config.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly emailConfig: EmailConfigService) {}

  async send(to: string, subject: string, html: string) {
    const resolved = await this.emailConfig.getResolved();
    if (!resolved) {
      this.logger.log(`[email-simulado] to=${to} subject=${subject}`);
      return { simulated: true };
    }
    const transporter = nodemailer.createTransport({
      host: resolved.host,
      port: resolved.port,
      secure: resolved.secure,
      auth: { user: resolved.user, pass: resolved.pass },
    });
    return transporter.sendMail({ from: resolved.user, to, subject, html });
  }
}
