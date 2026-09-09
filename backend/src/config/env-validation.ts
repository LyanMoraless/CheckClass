import { plainToInstance } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  // Security review finding: @IsNotEmpty alone would still pass a short,
  // guessable secret at startup. 32 chars is a low bar (not enforcing real
  // entropy), but catches the obvious case of someone leaving a short
  // placeholder in place.
  @MinLength(32)
  JWT_SECRET: string;

  // Frontend origin allowed to call this API from a browser (CORS). A
  // comma-separated list, since a real deployment may need to allow more
  // than one (e.g. a staging + production frontend URL).
  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string;

  // Frente 07 — absence-justification attachments (RULE-JUST-09/11/19).
  // Approved technology decision: object storage gerenciado, compatível com
  // S3 (pending-decisions.md, "Proposta pendente — Tecnologia de
  // armazenamento do anexo, Frente 07", APROVADA 2026-09-08) — CATEGORY
  // approved, concrete PROVIDER deliberately left open. These variables are
  // the only place a provider is chosen, and they choose nothing by
  // themselves: point them at any S3-compatible endpoint (a managed service,
  // or a local MinIO for dev) with no code change.
  @IsString()
  @IsOptional()
  // Unset = the SDK's own default endpoint resolution (real AWS S3). Most
  // other S3-compatible providers require this to be set explicitly.
  STORAGE_S3_ENDPOINT?: string;

  @IsString()
  @IsNotEmpty()
  STORAGE_S3_REGION: string;

  @IsString()
  @IsNotEmpty()
  STORAGE_S3_BUCKET: string;

  @IsString()
  @IsNotEmpty()
  STORAGE_S3_ACCESS_KEY_ID: string;

  @IsString()
  @IsNotEmpty()
  STORAGE_S3_SECRET_ACCESS_KEY: string;

  // Path-style addressing (bucket.example.com/key vs. example.com/bucket/key)
  // is required by most non-AWS S3-compatible providers (MinIO included) —
  // defaults to true (see AbsenceJustificationAttachmentStorageService);
  // set to the literal string "false" to disable for a provider that needs
  // virtual-hosted-style addressing.
  @IsString()
  @IsOptional()
  STORAGE_S3_FORCE_PATH_STYLE?: string;

  // RULE-JUST-11.6: encryption at rest, key managed OUTSIDE the app process.
  // Optional and provider-specific on purpose — see
  // AbsenceJustificationAttachmentStorageService's header for why this code
  // does not hardcode an SSE algorithm.
  @IsString()
  @IsOptional()
  STORAGE_S3_SSE_ALGORITHM?: string;
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
