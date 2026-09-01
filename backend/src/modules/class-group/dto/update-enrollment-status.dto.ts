import { IsIn } from 'class-validator';
import { ENROLLMENT_STATUSES } from '../class-group.service';

export class UpdateEnrollmentStatusDto {
  // RULE-INST-11: fixed 4-value enum (Ativo/Trancado/Formado/Evadido —
  // active | on_leave | graduated | withdrawn), free transitions between
  // all four, no state machine (confirmed) — any value in the list can
  // become any other, so this is the only validation needed.
  @IsIn(ENROLLMENT_STATUSES)
  status: string;
}
