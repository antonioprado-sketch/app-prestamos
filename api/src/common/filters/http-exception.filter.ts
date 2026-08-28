import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    let message: unknown = body;
    let error: string = (HttpStatus[status] as string | undefined) ?? 'Error';

    if (typeof body === 'object' && body !== null) {
      const b = body as Record<string, unknown>;
      message = b.message ?? b.error ?? body;
      if (typeof b.error === 'string') {
        error = b.error;
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status} ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
    });
  }
}
