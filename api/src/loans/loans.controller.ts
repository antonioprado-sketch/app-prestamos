import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { QuoteDto } from './dto/quote.dto';
import { calculateQuote, QuoteError } from './loan-quote';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';

const NEW_CLIENT_MAX_AMOUNT_KEY = 'loans.new_client_max_amount';
const NEW_CLIENT_MAX_AMOUNT_DEFAULT = 3000;

@Controller('api/v1/loans')
export class LoansController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigurationService,
  ) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  async quote(
    @Body() dto: QuoteDto,
    @Req() req: Request & { user?: { phone: string } },
  ) {
    const maxAmount = await this.resolveMaxAmount(req.user?.phone);
    try {
      return calculateQuote({
        amount: dto.amount,
        model: dto.model,
        openingDate: dto.openingDate,
        maxAmount,
      });
    } catch (err) {
      if (err instanceof QuoteError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  private async resolveMaxAmount(
    phone: string | undefined,
  ): Promise<number | null> {
    const newClientMax = await this.config.getNumber(
      NEW_CLIENT_MAX_AMOUNT_KEY,
      NEW_CLIENT_MAX_AMOUNT_DEFAULT,
    );

    if (!phone) return newClientMax;

    const customer = await this.prisma.customer.findUnique({
      where: { phone },
      select: { isNewCustomer: true },
    });
    if (!customer || customer.isNewCustomer) return newClientMax;
    return null;
  }
}
