import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

// Institution manually enters a camera's metadata — no auto-discovery this
// round (Tech Decision item 4). name/streamUrl mirror camera.name/stream_url;
// areaId links it into the área hierarchy Serviço de Câmeras reads from for
// RULE-SEC-03's auto-follow selection.
export class CreateCameraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsUUID()
  areaId: string;

  @IsString()
  @IsNotEmpty()
  streamUrl: string;
}
