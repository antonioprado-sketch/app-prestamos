import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigurationService } from '../configuration/configuration.service';
import {
  decryptPassword,
  encryptPassword,
  EncryptedPassword,
} from './email-encryption';

const EMAIL_CONFIG_KEY = 'email.smtp';

export interface EmailConfigPublic {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
}

export interface EmailConfigInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
}

interface EmailConfigStored {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: EncryptedPassword | null;
}

export interface ResolvedEmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

const DEFAULTS: EmailConfigStored = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: '',
  pass: null,
};

@Injectable()
export class EmailConfigService {
  constructor(private readonly config: ConfigurationService) {}

  async get(): Promise<EmailConfigPublic> {
    const stored = await this.config.getJson<EmailConfigStored>(
      EMAIL_CONFIG_KEY,
      DEFAULTS,
    );
    return toPublic(stored);
  }

  async set(
    input: EmailConfigInput,
    updatedBy: string,
  ): Promise<EmailConfigPublic> {
    const current = await this.config.getJson<EmailConfigStored>(
      EMAIL_CONFIG_KEY,
      DEFAULTS,
    );
    const next: EmailConfigStored = {
      host: input.host,
      port: input.port,
      secure: input.secure,
      user: input.user,
      pass: input.pass ? encryptPassword(input.pass) : current.pass,
    };
    await this.config.setJson(
      EMAIL_CONFIG_KEY,
      next as unknown as Prisma.InputJsonValue,
      updatedBy,
    );
    return toPublic(next);
  }

  // Nunca expuesto por API — solo para que EmailService arme el transporter real.
  async getResolved(): Promise<ResolvedEmailConfig | null> {
    const stored = await this.config.getJson<EmailConfigStored>(
      EMAIL_CONFIG_KEY,
      DEFAULTS,
    );
    if (stored.user && stored.pass) {
      return {
        host: stored.host,
        port: stored.port,
        secure: stored.secure,
        user: stored.user,
        pass: decryptPassword(stored.pass),
      };
    }
    // Fallback a las variables de entorno legacy, mientras no se guarde nada en BD.
    const envUser = process.env.GMAIL_USER;
    const envPass = process.env.GMAIL_APP_PASSWORD;
    if (envUser && envPass) {
      return {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: envUser,
        pass: envPass,
      };
    }
    return null;
  }
}

function toPublic(stored: EmailConfigStored): EmailConfigPublic {
  return {
    host: stored.host,
    port: stored.port,
    secure: stored.secure,
    user: stored.user,
    hasPassword: !!stored.pass,
  };
}
