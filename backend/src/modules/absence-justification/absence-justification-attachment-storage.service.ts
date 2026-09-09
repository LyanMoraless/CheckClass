import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, ServerSideEncryption } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';

// Object storage client for Frente 07 attachments (RULE-JUST-09/11/19).
// Approved technology decision (pending-decisions.md, "Proposta pendente —
// Tecnologia de armazenamento do anexo, Frente 07", APROVADA 2026-09-08):
// object storage gerenciado, compatível com S3 — CATEGORY approved, no
// concrete provider chosen. This client is deliberately provider-agnostic:
// every provider-specific value (endpoint, region, bucket, credentials, and
// whether path-style addressing is required) comes from the environment,
// never hardcoded here. Pointed at a MinIO/other S3-compatible endpoint
// locally, and at any S3-compatible managed service in production, with no
// code change — only STORAGE_S3_* env vars change (see env-validation.ts).
//
// RULE-JUST-11.5: never a signed/public URL. download() fetches the object
// with the app's OWN credentials and hands the bytes back to the caller —
// the only thing ever returned to an HTTP client. Authorization is
// re-verified server-side on every call, BEFORE this class is ever reached
// (AbsenceJustificationAttachmentService.authorize()).
//
// RULE-JUST-11.6 (encryption at rest, key managed OUTSIDE the app process):
// this class does not hardcode a specific SSE algorithm/KMS key — doing so
// would assume AWS-specific semantics ('aws:kms') that not every
// S3-compatible provider implements identically, and the provider itself is
// still an open decision. STORAGE_S3_SSE_ALGORITHM is optional and, when
// set, is passed through verbatim on every upload; when unset, encryption at
// rest is expected to come from the bucket's own default-encryption
// configuration — an infra/DevOps decision, not something this code can
// enforce on its own. Flagged in the Backend Implementation Summary for the
// Orchestrator/DevOps Agent.
@Injectable()
export class AbsenceJustificationAttachmentStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly sseAlgorithm?: ServerSideEncryption;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('STORAGE_S3_BUCKET');
    this.sseAlgorithm = (config.get<string>('STORAGE_S3_SSE_ALGORITHM') || undefined) as ServerSideEncryption | undefined;
    const endpoint = config.get<string>('STORAGE_S3_ENDPOINT');

    this.client = new S3Client({
      region: config.getOrThrow<string>('STORAGE_S3_REGION'),
      endpoint: endpoint || undefined,
      forcePathStyle: config.get<string>('STORAGE_S3_FORCE_PATH_STYLE') !== 'false',
      credentials: {
        accessKeyId: config.getOrThrow<string>('STORAGE_S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('STORAGE_S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(this.sseAlgorithm ? { ServerSideEncryption: this.sseAlgorithm } : {}),
      }),
    );
  }

  async download(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return this.streamToBuffer(result.Body as Readable);
  }

  // RULE-JUST-19: the actual object removal — the metadata row's mutation
  // (storage_key -> NULL, deleted_at stamped) is the CALLER's job
  // (AbsenceJustificationAttachmentService.eliminate), never this method's.
  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }
}
