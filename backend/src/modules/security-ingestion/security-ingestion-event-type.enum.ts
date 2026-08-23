// Tech Decision item 3 ("Segurança de Intrusão, primeira rodada", approved
// 2026-08-23): the two event types the Gateway de Ingestão de Sinais de
// Segurança accepts. Deliberately its own enum, separate from
// IngestionEventType (ingestion/dto/ingestion-event-type.enum.ts) — that one
// is the attendance-pipeline device-ingestion contract, unrelated to this
// second, parallel pipeline.
export enum SecurityIngestionEventType {
  IR_BARRIER_CROSSING = 'IR_BARRIER_CROSSING',
  AREA_READER_SCAN = 'AREA_READER_SCAN',
}
