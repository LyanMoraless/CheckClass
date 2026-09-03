import { ArrayUnique, IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { MONITORABLE_EVENT_TYPES, MONITORING_MODES, MonitorableEventType, MonitoringMode } from '../exam-vocabulary';

// RULE-EXAM-13's whole configuration screen in one payload: turma,
// identification, availability window, duration and monitoring behavior.
//
// There is no `status` field on purpose — an exam is always created as
// DRAFT (confirmed 2026-09-03) and only POST /publish changes that.
export class CreateExamDto {
  // RULE-EXAM-16: the exam belongs to a turma, and both student eligibility
  // and management authorization derive from it.
  @IsUUID()
  classGroupId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsDateString()
  availableFrom: string;

  @IsDateString()
  availableUntil: string;

  // RULE-EXAM-06: omitted = no time limit, which is NOT the same as "until
  // the window closes" — such a session ends as ABANDONED when the window
  // does, never as EXPIRED.
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  // RULE-EXAM-04: an explicit choice, with no default.
  @IsIn(MONITORING_MODES)
  monitoringMode: MonitoringMode;

  // RULE-EXAM-05's checkbox list. Also the allow-list of what the client may
  // later report (Security control 4) — an empty array is valid and means
  // "monitor nothing", which still logs page reloads (RULE-EXAM-11).
  @IsArray()
  @ArrayUnique()
  @IsIn(MONITORABLE_EVENT_TYPES, { each: true })
  monitoredEventTypes: MonitorableEventType[];
}
