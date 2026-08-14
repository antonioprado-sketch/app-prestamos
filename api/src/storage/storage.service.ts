import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';

const MINIO_REGION = 'us-east-1';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly publicClient: Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? 'documentos';

    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'minio',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ROOT_USER ?? '',
      secretKey: process.env.MINIO_ROOT_PASSWORD ?? '',
      region: MINIO_REGION,
    });

    // Cliente separado solo para firmar URLs: el endpoint interno (nombre de servicio
    // docker, ej. "minio") no es resoluble por el navegador del cliente final. La firma
    // de presignedGetObject es local (no hace I/O real) si `region` ya está seteado,
    // así que este cliente nunca necesita conectar de verdad al endpoint público.
    this.publicClient = new Client({
      endPoint:
        process.env.MINIO_PUBLIC_ENDPOINT ??
        process.env.MINIO_ENDPOINT ??
        'minio',
      port: Number(
        process.env.MINIO_PUBLIC_PORT ?? process.env.MINIO_PORT ?? 9000,
      ),
      useSSL:
        (process.env.MINIO_PUBLIC_USE_SSL ?? process.env.MINIO_USE_SSL) ===
        'true',
      accessKey: process.env.MINIO_ROOT_USER ?? '',
      secretKey: process.env.MINIO_ROOT_PASSWORD ?? '',
      region: MINIO_REGION,
    });
  }

  async onModuleInit() {
    const exists = await this.client
      .bucketExists(this.bucket)
      .catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucket, MINIO_REGION);
      this.logger.log(`Bucket MinIO creado: ${this.bucket}`);
    }
  }

  async putObject(key: string, buffer: Buffer, mime: string): Promise<void> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mime,
    });
  }

  async presignedGetUrl(key: string, expirySeconds: number): Promise<string> {
    return this.publicClient.presignedGetObject(
      this.bucket,
      key,
      expirySeconds,
    );
  }
}
