import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolvePendingReviewDto {
  @IsIn(['present', 'absent'])
  decision: 'present' | 'absent';

  @IsString()
  @IsOptional()
  note?: string;
}
