import { DeleteObjectCommand, PutObjectCommand, S3Client, ServerSideEncryption } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Object storage client for Frente 10 closure documents (RULE-RET-01/02).
// Approved technology decision item 1: the SAME S3-compatible technology
// already used for Frente 07 attachments
// (AbsenceJustificationAttachmentStorageService), pointed at a NEW, SEPARATE
// bucket (checkclass-attendance-retention-documents /
// STORAGE_S3_RETENTION_BUCKET) — every OTHER setting
// (region/credentials/endpoint/path-style/SSE) is intentionally REUSED from
// the same STORAGE_S3_* variables the Frente 07 client uses: the technology
// decision found no security reason to require a separate account, only a
// separate bucket, because this bucket's lifecycle differs (a row here
// survives until the annual consolidation erases only its content; a Frente
// 07 attachment object is erased outright 30 days after its decision).
//
// No download() here (unlike the Frente 07 sibling): Frente 10 deliberately
// ships no download endpoint this round — Open Question 4 ("quem pode
// baixar o documento de fechamento") is unresolved, and forcing an endpoint
// without an access policy would be inventing one. delete() exists because
// the annual consolidation (RULE-RET-02) genuinely needs it, independent of
// that open question.
@Injectable()
export class AttendanceRetentionStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly sseAlgorithm?: ServerSideEncryption;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('STORAGE_S3_RETENTION_BUCKET');
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

  // RULE-RET-02: the annual consolidation's content elimination — the
  // metadata row's own mutation (storage_key -> NULL, content_deleted_at
  // stamped) is the CALLER's job (AttendanceAnnualConsolidationService),
  // never this method's, same split as the Frente 07 sibling's delete().
  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
