import { plainToInstance } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, validateSync } from 'class-validator';

class EnvVariables {
  @IsInt()
  PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsInt()
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_DATABASE: string;

  @IsString()
  @IsNotEmpty()
  APP_DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  APP_DB_PASSWORD: string;
}

export function validateEnv(config: Record<string, unknown>): EnvVariables {
  const validatedConfig = plainToInstance(EnvVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }

  return validatedConfig;
}
