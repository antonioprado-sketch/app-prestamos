import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import {
  validateDocument,
  UploadableDocumentType,
} from './document-validation';

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
    type: UploadableDocumentType,
    file: { buffer: Buffer; mimetype: string },
    ip: string,
    ua: string,
  ) {
    const verifiedMime = validateDocument(type, file.mimetype, file.buffer);
    return this.persist(
      phone,
      phone,
      type,
      null,
      file.buffer,
      verifiedMime,
      'document_uploaded',
      ip,
      ua,
    );
  }

  /** Documento subido por el cobrador durante una visita, para el cliente dueño del préstamo. */
  async uploadForClient(
    actorPhone: string,
    customerPhone: string,
    loanId: bigint,
    file: { buffer: Buffer; mimetype: string },
    ip: string,
    ua: string,
  ) {
    const verifiedMime = validateDocument(
      'COLLECTOR_DOC',
      file.mimetype,
      file.buffer,
    );
    return this.persist(
      customerPhone,
      actorPhone,
      'COLLECTOR_DOC',
      loanId,
      file.buffer,
      verifiedMime,
      'collector_document_uploaded',
      ip,
      ua,
    );
  }

  /** Documentos generados por el servidor (ej. pagaré) — el contenido no viene del cliente, no se valida como upload. */
  async storeGenerated(
    phone: string,
    loanId: bigint,
    type: DocumentType,
    buffer: Buffer,
    mime: string,
    action: string,
    ip: string,
    ua: string,
  ) {
    return this.persist(
      phone,
      phone,
      type,
      loanId,
      buffer,
      mime,
      action,
      ip,
      ua,
    );
  }

  private async persist(
    customerPhone: string,
    uploadedBy: string,
    type: DocumentType,
    loanId: bigint | null,
    buffer: Buffer,
    mime: string,
    action: string,
    ip: string,
    ua: string,
  ) {
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const ext = EXTENSION_BY_MIME[mime] ?? 'bin';
    const storageKey = `customers/${customerPhone}/${type.toLowerCase()}/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;

    await this.storage.putObject(storageKey, buffer, mime);

    const document = await this.prisma.document.create({
      data: {
        customerPhone,
        loanId: loanId ?? undefined,
        type,
        storageKey,
        mime,
        sizeBytes: buffer.length,
        checksum,
        uploadedBy,
      },
    });

    await this.audit.log({
      userPhone: uploadedBy,
      action,
      entity: 'document',
      entityId: String(document.id),
      newValue: { type, mime, sizeBytes: buffer.length },
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

  async findForLoan(loanId: bigint) {
    const documents = await this.prisma.document.findMany({
      where: { loanId, type: 'COLLECTOR_DOC' },
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

  /** Sin chequeo de ownership — solo para uso desde endpoints de ADMIN, ya protegidos por RolesGuard. */
  async signedUrlForAdmin(id: string): Promise<{ url: string }> {
    if (!/^\d+$/.test(id))
      throw new NotFoundException('Documento no encontrado');
    const document = await this.prisma.document.findUnique({
      where: { id: BigInt(id) },
    });
    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }
    const url = await this.storage.presignedGetUrl(
      document.storageKey,
      SIGNED_URL_EXPIRY_SECONDS,
    );
    return { url };
  }
}
