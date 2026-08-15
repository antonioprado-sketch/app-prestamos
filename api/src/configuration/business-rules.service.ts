import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import {
  BusinessRules,
  PENALTY_PER_DAY_DEFAULT,
  PENALTY_PER_DAY_KEY,
  SCORE_ORANGE_MAX_DAYS_DEFAULT,
  SCORE_ORANGE_MAX_DAYS_KEY,
  SCORE_YELLOW_MAX_DAYS_DEFAULT,
  SCORE_YELLOW_MAX_DAYS_KEY,
} from './business-rules.constants';

@Injectable()
export class BusinessRulesService {
  constructor(private readonly config: ConfigurationService) {}

  async get(): Promise<BusinessRules> {
    const [penaltyPerDay, yellowMaxDays, orangeMaxDays] = await Promise.all([
      this.config.getNumber(PENALTY_PER_DAY_KEY, PENALTY_PER_DAY_DEFAULT),
      this.config.getNumber(
        SCORE_YELLOW_MAX_DAYS_KEY,
        SCORE_YELLOW_MAX_DAYS_DEFAULT,
      ),
      this.config.getNumber(
        SCORE_ORANGE_MAX_DAYS_KEY,
        SCORE_ORANGE_MAX_DAYS_DEFAULT,
      ),
    ]);
    return { penaltyPerDay, yellowMaxDays, orangeMaxDays };
  }

  async set(rules: BusinessRules, updatedBy: string): Promise<BusinessRules> {
    if (rules.penaltyPerDay <= 0) {
      throw new BadRequestException('penaltyPerDay debe ser mayor a 0');
    }
    if (rules.yellowMaxDays <= 0 || rules.orangeMaxDays <= 0) {
      throw new BadRequestException(
        'yellowMaxDays y orangeMaxDays deben ser mayores a 0',
      );
    }
    if (rules.yellowMaxDays >= rules.orangeMaxDays) {
      throw new BadRequestException(
        'yellowMaxDays debe ser menor que orangeMaxDays',
      );
    }

    await Promise.all([
      this.config.set(PENALTY_PER_DAY_KEY, rules.penaltyPerDay, updatedBy),
      this.config.set(
        SCORE_YELLOW_MAX_DAYS_KEY,
        rules.yellowMaxDays,
        updatedBy,
      ),
      this.config.set(
        SCORE_ORANGE_MAX_DAYS_KEY,
        rules.orangeMaxDays,
        updatedBy,
      ),
    ]);

    return rules;
  }
}
