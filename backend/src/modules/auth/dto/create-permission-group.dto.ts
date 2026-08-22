import { ArrayUnique, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Permission } from '../permission.enum';

export class CreatePermissionGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(Permission, { each: true })
  @ArrayUnique()
  permissions: Permission[];
}
