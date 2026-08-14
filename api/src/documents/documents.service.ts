import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { validateDocument } from './document-validation';

const SIGNED_URL_EXPIRY_SECONDS = 5 * 60;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    phone: string,
    type: DocumentType,
    file: { buffer: Buffer; mimetype: string },
    ip: string,
    ua: string,
  ) {
    const verifiedMime = validateDocument(type, file.mimetype, file.buffer);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const ext = EXTENSION_BY_MIME[verifiedMime];
    const storageKey = `customers/${phone}/${type.toLowerCase()}/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;

    await this.storage.putObject(storageKey, file.buffer, verifiedMime);

    const document = await this.prisma.document.create({
      data: {
        customerPhone: phone,
        type,
        storageKey,
        mime: verifiedMime,
        sizeBytes: file.buffer.length,
        checksum,
        uploadedBy: phone,
      },
    });

    await this.audit.log({
      userPhone: phone,
      action: 'document_uploaded',
      entity: 'document',
      entityId: String(document.id),
      newValue: { type, mime: verifiedMime, sizeBytes: file.buffer.length },
      ip,
      userAgent: ua,
    });

    return {
      id: String(document.id),
      type: document.type,
      mime: document.mime,
      sizeBytes: document.sizeBytes,
      createdAt: document.createdAt,
    };
  }

  async findMine(phone: string) {
    const documents = await this.prisma.document.findMany({
      where: { customerPhone: phone },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map((d) => ({
      id: String(d.id),
      type: d.type,
      mime: d.mime,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
    }));
  }

  async signedUrl(phone: string, id: string): Promise<{ url: string }> {
    if (!/^\d+$/.test(id))
      throw new NotFoundException('Documento no encontrado');
    const document = await this.prisma.document.findUnique({
      where: { id: BigInt(id) },
    });
    if (!document || document.customerPhone !== phone) {
      throw new NotFoundException('Documento no encontrado');
    }
    const url = await this.storage.presignedGetUrl(
      document.storageKey,
      SIGNED_URL_EXPIRY_SECONDS,
    );
    return { url };
  }
}
