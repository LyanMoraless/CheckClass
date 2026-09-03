import { ArrayUnique, IsArray, IsIn } from 'class-validator';
import { MONITORABLE_EVENT_TYPES, MONITORING_MODES, MonitorableEventType, MonitoringMode } from '../exam-vocabulary';

// RULE-EXAM-13's monitoring block, replaced as a whole: the checkbox screen
// always knows the complete list it wants enabled.
export class UpdateMonitoringConfigDto {
  @IsIn(MONITORING_MODES)
  monitoringMode: MonitoringMode;

  @IsArray()
  @ArrayUnique()
  @IsIn(MONITORABLE_EVENT_TYPES, { each: true })
  monitoredEventTypes: MonitorableEventType[];
}
