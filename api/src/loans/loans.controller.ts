import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { QuoteDto } from './dto/quote.dto';
import { SignPagareDto } from './dto/sign-pagare.dto';
import { QuoteError } from './loan-quote';
import { ActiveLoanExistsError, LoansService } from './loans.service';
import { DocumentValidationError } from '../documents/document-validation';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  async quote(
    @Body() dto: QuoteDto,
    @Req() req: Request & { user?: { phone: string } },
  ) {
    return this.handleQuoteErrors(() => this.loans.quote(dto, req.user?.phone));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  async create(
    @Body() dto: QuoteDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.handleQuoteErrors(() =>
      this.loans.create(
        user.phone,
        dto,
        req.ip ?? '',
        req.headers['user-agent'] ?? '',
      ),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  async findMine(@CurrentUser() user: { phone: string }) {
    return this.loans.findMyLoans(user.phone);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { phone: string },
  ) {
    return this.loans.findOne(user.phone, id);
  }

  @Post(':id/pagare')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  async signPagare(
    @Param('id') id: string,
    @Body() dto: SignPagareDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.handleQuoteErrors(() =>
      this.loans.signPagare(
        user.phone,
        id,
        dto,
        req.ip ?? '',
        req.headers['user-agent'] ?? '',
      ),
    );
  }

  private async handleQuoteErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof QuoteError) throw new BadRequestException(err.message);
      if (err instanceof DocumentValidationError)
        throw new BadRequestException(err.message);
      if (err instanceof ActiveLoanExistsError)
        throw new ConflictException(err.message);
      throw err;
    }
  }
}
