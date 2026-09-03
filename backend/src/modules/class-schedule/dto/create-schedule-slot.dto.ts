import { IsInt, IsUUID, Matches, Max, Min } from 'class-validator';

// "HH:mm" or "HH:mm:ss", 00-23 / 00-59 — matches the `time`-typed
// start_time/end_time columns (class_group_schedule_slot.entity.ts).
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

export class CreateScheduleSlotDto {
  // RULE-INST-14: which of the turma's matérias this weekly slot teaches.
  // That it is linked to the turma is validated at the service layer
  // (ClassScheduleService.createSlot).
  @IsUUID()
  subjectId: string;

  // JS Date.getDay() convention (0 = Sunday .. 6 = Saturday) — see
  // class-group-schedule-slot.entity.ts's top-of-file comment.
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm or HH:mm:ss format' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm or HH:mm:ss format' })
  endTime: string;
}
