import { IsUUID } from 'class-validator';

export class AssignPersonToGroupDto {
  @IsUUID()
  personId: string;
}
