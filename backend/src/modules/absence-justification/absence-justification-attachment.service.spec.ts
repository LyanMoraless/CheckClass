import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AbsenceJustificationAttachmentAccessLogEntity,
  AbsenceJustificationAttachmentEntity,
  AbsenceJustificationItemEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockSelectQueryBuilder,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ABSENCE_JUSTIFICATION_ATTACHMENT_RETENTION_DAYS } from './absence-justification.constants';
import { AbsenceJustificationAttachmentService, DownloadRequestContext } from './absence-justification-attachment.service';

// RULE-JUST-08/11.2/19/24: download() is the single gate every open of the
// attachment's bytes goes through, and RULE-JUST-11.2 requires EVERY
// attempt logged, granted or denied, "Exceptions: Nenhuma" — including the
// case fixed here, where the requester has no relation whatsoever to the
// submission and student_ownership/teacher_subject_scope hide the row from
// the very first (unscoped) lookup.
describe('AbsenceJustificationAttachmentService.download', () => {
  const ATTACHMENT: AbsenceJustificationAttachmentEntity = {
    id: 'attachment-1',
    tenantId: 'tenant-a-id',
    submissionId: 'submission-1',
    personId: 'student-1',
    storageKey: 'tenant-a-id/absence-justifications/submission-1/file-1',
    originalFilename: 'atestado.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1000,
    uploadedAt: new Date(),
    scheduledDeletionAt: null,
    deletedAt: null,
  } as AbsenceJustificationAttachmentEntity;

  const CONTEXT: DownloadRequestContext = {
    requesterPersonId: 'stranger-1',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  function buildService(overrides: {
    firstLookupResult?: AbsenceJustificationAttachmentEntity | null;
    accessLogLookupResult?: AbsenceJustificationAttachmentEntity | null;
    isSubjectTeacher?: boolean;
    hasPermission?: boolean;
  } = {}) {
    const firstLookup = overrides.firstLookupResult === undefined ? ATTACHMENT : overrides.firstLookupResult;

    const attachmentRepo = createMockRepository({
      // Faithful stand-in for what RLS does in real Postgres: the FIRST call
      // (plain scope) sees only what student_ownership/teacher_subject_scope
      // allow; a SECOND call only ever happens inside
      // findAttachmentForAccessLogOnly, once the elevated access_log_lookup_scope
      // GUC has been applied.
      findOneBy: jest.fn().mockResolvedValueOnce(firstLookup).mockResolvedValueOnce(overrides.accessLogLookupResult ?? null),
    });
    const accessLogRepo = createMockRepository();
    const itemRepo = createMockRepository({
      findBy: jest.fn().mockResolvedValue([
        { id: 'item-1', submissionId: 'submission-1', classGroupId: 'class-group-1', subjectId: 'subject-1' },
      ]),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [AbsenceJustificationAttachmentEntity, attachmentRepo],
      [AbsenceJustificationAttachmentAccessLogEntity, accessLogRepo],
      [AbsenceJustificationItemEntity, itemRepo],
    ]);

    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');

    const storage = { download: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')) };
    const teacherScope = { isSubjectTeacher: jest.fn().mockResolvedValue(overrides.isSubjectTeacher ?? false) };
    const permissionGroupService = { hasPermission: jest.fn().mockResolvedValue(overrides.hasPermission ?? false) };
    const rlsContext = {
      applyAccessLogLookupScope: jest.fn().mockResolvedValue(undefined),
      clearAccessLogLookupScope: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AbsenceJustificationAttachmentService(
      tenantContext as never,
      storage as never,
      teacherScope as never,
      permissionGroupService as never,
      rlsContext as never,
    );

    return { service, attachmentRepo, accessLogRepo, itemRepo, storage, teacherScope, permissionGroupService, rlsContext };
  }

  // The case the Security Agent flagged as blocking: a requester with no
  // relation at all to the submission — not the titular, not a teacher of
  // any of its subjects — never even reaches authorize(), because the plain
  // (unscoped) findOneBy already returns nothing under real RLS. Before this
  // fix, that meant NO row in absence_justification_attachment_access_log.
  test('test_download_requesterUnrelatedToSubmission_logsDeniedViaAccessLogLookupScopeAndThrowsForbidden', async () => {
    const { service, accessLogRepo, rlsContext } = buildService({
      firstLookupResult: null,
      accessLogLookupResult: ATTACHMENT,
    });

    await expect(service.download('submission-1', CONTEXT)).rejects.toThrow(ForbiddenException);

    expect(rlsContext.applyAccessLogLookupScope).toHaveBeenCalledTimes(1);
    expect(rlsContext.clearAccessLogLookupScope).toHaveBeenCalledTimes(1);
    expect(accessLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: ATTACHMENT.tenantId,
        attachmentId: ATTACHMENT.id,
        attachmentOwnerPersonId: ATTACHMENT.personId,
        accessedByPersonId: CONTEXT.requesterPersonId,
        accessResult: 'denied',
        denialReason: 'no_relation_to_submission',
      }),
    );
  });

  // A truly nonexistent submissionId — the elevated lookup ALSO finds
  // nothing, so there is no attachment id/owner to log against, and no log
  // row is written (matches the FK the access log table enforces).
  test('test_download_submissionTrulyDoesNotExist_throwsNotFoundWithoutLogging', async () => {
    const { service, accessLogRepo, rlsContext } = buildService({
      firstLookupResult: null,
      accessLogLookupResult: null,
    });

    await expect(service.download('submission-does-not-exist', CONTEXT)).rejects.toThrow(NotFoundException);

    expect(rlsContext.applyAccessLogLookupScope).toHaveBeenCalledTimes(1);
    expect(rlsContext.clearAccessLogLookupScope).toHaveBeenCalledTimes(1);
    expect(accessLogRepo.save).not.toHaveBeenCalled();
  });

  // Baseline: the titular downloading their own attachment never needs the
  // elevated lookup at all — the first, plain findOneBy already returns the
  // row because student_ownership lets it through.
  test('test_download_ownerRequestsOwnAttachment_grantsAndLogsGrantedWithoutElevatedScope', async () => {
    const { service, accessLogRepo, rlsContext, storage } = buildService({ firstLookupResult: ATTACHMENT });

    const result = await service.download('submission-1', { ...CONTEXT, requesterPersonId: 'student-1' });

    expect(result.mimeType).toBe('application/pdf');
    expect(storage.download).toHaveBeenCalledWith(ATTACHMENT.storageKey);
    expect(rlsContext.applyAccessLogLookupScope).not.toHaveBeenCalled();
    expect(accessLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ accessResult: 'granted', denialReason: null }));
  });

  // A requester who DOES resolve on the first (plain) lookup — e.g. because
  // they are ALSO a titular/teacher of a DIFFERENT item somehow visible to
  // RLS in this mock's simplified shape — but fails the application-level
  // authorize() check, keeps going through the pre-existing missing_permission
  // path untouched by this fix.
  test('test_download_relatedButMissingPermission_logsDeniedWithoutElevatedScope', async () => {
    const { service, accessLogRepo, rlsContext } = buildService({
      firstLookupResult: ATTACHMENT,
      hasPermission: false,
    });

    await expect(service.download('submission-1', CONTEXT)).rejects.toThrow(ForbiddenException);

    expect(rlsContext.applyAccessLogLookupScope).not.toHaveBeenCalled();
    expect(accessLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ accessResult: 'denied', denialReason: 'missing_permission' }));
  });

  // RULE-JUST-08/24: the core "it actually works" case for the professor
  // side — holds the VIEW_ABSENCE_JUSTIFICATION_ATTACHMENT permission AND is
  // the subject-teacher of (at least) one item of this submission. No
  // existing test exercised authorize() actually GRANTING via this branch
  // before this one; every prior test only exercised the denial paths.
  test('test_download_teacherWithPermissionAndIsSubjectTeacher_grantsAndDownloadsBytes', async () => {
    const { service, accessLogRepo, storage } = buildService({
      firstLookupResult: ATTACHMENT,
      hasPermission: true,
      isSubjectTeacher: true,
    });

    const result = await service.download('submission-1', { ...CONTEXT, requesterPersonId: 'teacher-1' });

    expect(result.mimeType).toBe('application/pdf');
    expect(storage.download).toHaveBeenCalledWith(ATTACHMENT.storageKey);
    expect(accessLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ accessResult: 'granted', denialReason: null }));
  });

  // A teacher WITH the permission but who does NOT teach any (classGroup,
  // subject) pair this submission's items belong to — RULE-JUST-24's narrow
  // scope, not RULE-JUST-08's coarser permission check, is what must decide
  // here.
  test('test_download_teacherWithPermissionButNotSubjectTeacher_deniedAsNotSubjectTeacher', async () => {
    const { service, accessLogRepo } = buildService({
      firstLookupResult: ATTACHMENT,
      hasPermission: true,
      isSubjectTeacher: false,
    });

    await expect(service.download('submission-1', { ...CONTEXT, requesterPersonId: 'teacher-1' })).rejects.toThrow(ForbiddenException);

    expect(accessLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ accessResult: 'denied', denialReason: 'not_subject_teacher' }));
  });

  // RULE-JUST-19.5: an AUTHORIZED requester (the titular here) hitting an
  // already-eliminated file gets the specific "eliminated" outcome, never a
  // generic 404 or the unauthorized-looking 'denied' log entry.
  test('test_download_authorizedButAttachmentAlreadyEliminated_logsDeletedUnavailableAndThrowsNotFound', async () => {
    const eliminatedAttachment = { ...ATTACHMENT, storageKey: null, deletedAt: new Date() };
    const { service, accessLogRepo, storage } = buildService({ firstLookupResult: eliminatedAttachment });

    await expect(service.download('submission-1', { ...CONTEXT, requesterPersonId: 'student-1' })).rejects.toThrow(NotFoundException);

    expect(storage.download).not.toHaveBeenCalled();
    expect(accessLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ accessResult: 'deleted_unavailable', denialReason: null }),
    );
  });
});

// Security Agent finding (OWASP unrestricted file upload, non-blocking item
// 2): file.mimetype is only the CLIENT-DECLARED Content-Type — spoofable by
// simply renaming a file before upload. assertUploadIsAcceptable must reject
// content whose real (magic-bytes-detected) type does not match what was
// declared, on top of the pre-existing allow-list/size checks.
describe('AbsenceJustificationAttachmentService.assertUploadIsAcceptable', () => {
  // A minimal-but-genuine PDF signature ("%PDF-1.4") — enough for file-type
  // to positively identify application/pdf from the buffer's magic bytes.
  const REAL_PDF_BUFFER = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  function buildService() {
    return new AbsenceJustificationAttachmentService({} as never, {} as never, {} as never, {} as never, {} as never);
  }

  test('test_assertUploadIsAcceptable_declaredTypeAndMagicBytesBothPdf_resolves', async () => {
    const service = buildService();
    const file = { mimetype: 'application/pdf', size: REAL_PDF_BUFFER.length, buffer: REAL_PDF_BUFFER } as Express.Multer.File;

    await expect(service.assertUploadIsAcceptable(file)).resolves.toBeUndefined();
  });

  // The exact OWASP scenario: an HTML/script payload renamed and declared as
  // application/pdf. file-type finds no PDF signature (or no signature at
  // all) in the real bytes, so this must be rejected even though the
  // declared Content-Type alone would have passed the allow-list check.
  test('test_assertUploadIsAcceptable_declaredPdfButContentIsHtml_throwsBadRequest', async () => {
    const service = buildService();
    const htmlBuffer = Buffer.from('<html><body><script>alert(1)</script></body></html>');
    const file = { mimetype: 'application/pdf', size: htmlBuffer.length, buffer: htmlBuffer } as Express.Multer.File;

    await expect(service.assertUploadIsAcceptable(file)).rejects.toThrow(BadRequestException);
  });

  // Real magic bytes detected, but for a DIFFERENT type than declared (e.g. a
  // genuine PNG relabeled as application/pdf) — still a mismatch, still
  // rejected, even though the detected type is itself in the allow-list.
  test('test_assertUploadIsAcceptable_declaredPdfButContentIsPng_throwsBadRequest', async () => {
    const service = buildService();
    // eslint-disable-next-line no-magic-numbers -- the PNG file signature.
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = { mimetype: 'application/pdf', size: pngBuffer.length, buffer: pngBuffer } as Express.Multer.File;

    await expect(service.assertUploadIsAcceptable(file)).rejects.toThrow(BadRequestException);
  });

  test('test_assertUploadIsAcceptable_unsupportedDeclaredType_throwsBadRequestBeforeReadingBuffer', async () => {
    const service = buildService();
    const file = { mimetype: 'text/html', size: REAL_PDF_BUFFER.length, buffer: REAL_PDF_BUFFER } as Express.Multer.File;

    await expect(service.assertUploadIsAcceptable(file)).rejects.toThrow(BadRequestException);
  });
});

// RULE-JUST-11.4: the titular always sees their own attachment's access log;
// nobody else does — student_ownership_read RLS on the log table itself is
// the real enforcement, this exercises the application-level redundant guard
// (same posture as AbsenceJustificationSubmissionService.cancel()'s own
// ownership check).
describe('AbsenceJustificationAttachmentService.listAccessLogForSubmission', () => {
  const ATTACHMENT: AbsenceJustificationAttachmentEntity = {
    id: 'attachment-1',
    tenantId: 'tenant-a-id',
    submissionId: 'submission-1',
    personId: 'student-1',
    storageKey: 'tenant-a-id/absence-justifications/submission-1/file-1',
    originalFilename: 'atestado.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1000,
    uploadedAt: new Date(),
    scheduledDeletionAt: null,
    deletedAt: null,
  } as AbsenceJustificationAttachmentEntity;

  const LOG_ROWS: AbsenceJustificationAttachmentAccessLogEntity[] = [
    {
      id: 'log-1',
      tenantId: 'tenant-a-id',
      attachmentId: 'attachment-1',
      attachmentOwnerPersonId: 'student-1',
      accessedByPersonId: 'teacher-1',
      accessResult: 'granted',
      denialReason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      occurredAt: new Date(),
    } as AbsenceJustificationAttachmentAccessLogEntity,
  ];

  function buildService(overrides: { attachment?: AbsenceJustificationAttachmentEntity | null } = {}) {
    const attachmentRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(overrides.attachment === undefined ? ATTACHMENT : overrides.attachment),
    });
    const accessLogRepo = createMockRepository({ find: jest.fn().mockResolvedValue(LOG_ROWS) });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [AbsenceJustificationAttachmentEntity, attachmentRepo],
      [AbsenceJustificationAttachmentAccessLogEntity, accessLogRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');

    const service = new AbsenceJustificationAttachmentService(
      tenantContext as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { service, attachmentRepo, accessLogRepo };
  }

  test('test_listAccessLogForSubmission_titularOwnsAttachment_returnsLogRows', async () => {
    const { service, accessLogRepo } = buildService();

    const result = await service.listAccessLogForSubmission('submission-1', 'student-1');

    expect(result).toBe(LOG_ROWS);
    expect(accessLogRepo.find).toHaveBeenCalledWith({ where: { attachmentId: 'attachment-1' }, order: { occurredAt: 'DESC' } });
  });

  test('test_listAccessLogForSubmission_requesterNotTitular_throwsForbidden', async () => {
    const { service, accessLogRepo } = buildService();

    await expect(service.listAccessLogForSubmission('submission-1', 'teacher-1')).rejects.toThrow(ForbiddenException);
    expect(accessLogRepo.find).not.toHaveBeenCalled();
  });

  test('test_listAccessLogForSubmission_noAttachmentVisibleForSubmission_throwsNotFound', async () => {
    const { service } = buildService({ attachment: null });

    await expect(service.listAccessLogForSubmission('submission-does-not-exist', 'student-1')).rejects.toThrow(NotFoundException);
  });
});

// RULE-JUST-19: the write side of the 30-day retention clock — advanced (or
// the file eliminated outright) every time an item of the submission reaches
// a terminal state. None of these branches had any coverage before this
// block: whether the clock starts at all, the RULE-JUST-19.3 "all cancelled"
// immediate-elimination shortcut, and the terminalAt/updatedAt fallback the
// deadline math itself depends on.
describe('AbsenceJustificationAttachmentService.recomputeRetentionSchedule', () => {
  const ATTACHMENT: AbsenceJustificationAttachmentEntity = {
    id: 'attachment-1',
    tenantId: 'tenant-a-id',
    submissionId: 'submission-1',
    personId: 'student-1',
    storageKey: 'tenant-a-id/absence-justifications/submission-1/file-1',
    originalFilename: 'atestado.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1000,
    uploadedAt: new Date(),
    scheduledDeletionAt: null,
    deletedAt: null,
  } as AbsenceJustificationAttachmentEntity;

  function buildService(overrides: {
    items?: unknown[];
    attachment?: AbsenceJustificationAttachmentEntity | null;
  } = {}) {
    const itemRepo = createMockRepository({ findBy: jest.fn().mockResolvedValue(overrides.items ?? []) });
    const attachmentRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(overrides.attachment === undefined ? ATTACHMENT : overrides.attachment),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [AbsenceJustificationItemEntity, itemRepo],
      [AbsenceJustificationAttachmentEntity, attachmentRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');

    const storage = { delete: jest.fn().mockResolvedValue(undefined) };

    const service = new AbsenceJustificationAttachmentService(
      tenantContext as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { service, itemRepo, attachmentRepo, storage };
  }

  test('test_recompute_noItemsForSubmission_isNoOp', async () => {
    const { service, attachmentRepo } = buildService({ items: [] });

    await service.recomputeRetentionSchedule('submission-1');

    expect(attachmentRepo.findOneBy).not.toHaveBeenCalled();
    expect(attachmentRepo.update).not.toHaveBeenCalled();
  });

  // The clock does not start while ANY item is still under_review — a
  // partially-decided submission must not have its attachment scheduled for
  // deletion (or worse, eliminated) while a decision is still pending on a
  // sibling item.
  test('test_recompute_someItemStillUnderReview_isNoOp', async () => {
    const { service, attachmentRepo } = buildService({
      items: [{ id: 'item-1', status: 'approved', terminalAt: new Date() }, { id: 'item-2', status: 'under_review', terminalAt: null }],
    });

    await service.recomputeRetentionSchedule('submission-1');

    expect(attachmentRepo.findOneBy).not.toHaveBeenCalled();
    expect(attachmentRepo.update).not.toHaveBeenCalled();
  });

  test('test_recompute_noAttachmentFound_isNoOp', async () => {
    const { service, attachmentRepo } = buildService({
      items: [{ id: 'item-1', status: 'approved', terminalAt: new Date() }],
      attachment: null,
    });

    await service.recomputeRetentionSchedule('submission-1');

    expect(attachmentRepo.update).not.toHaveBeenCalled();
  });

  // Already eliminated (e.g. this ran once before, or the retention sweep
  // beat it to it) — must not be re-scheduled or re-eliminated.
  test('test_recompute_attachmentAlreadyDeleted_isNoOp', async () => {
    const { service, attachmentRepo, storage } = buildService({
      items: [{ id: 'item-1', status: 'approved', terminalAt: new Date() }],
      attachment: { ...ATTACHMENT, storageKey: null, deletedAt: new Date() },
    });

    await service.recomputeRetentionSchedule('submission-1');

    expect(attachmentRepo.update).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  // RULE-JUST-19.3: every item cancelled by the student before ANY human
  // decision — eliminate immediately, nobody ever needed the file. Distinct
  // from the general "schedule 30 days out" path below.
  test('test_recompute_allItemsCancelledByStudent_eliminatesImmediately', async () => {
    const { service, attachmentRepo, storage } = buildService({
      items: [
        { id: 'item-1', status: 'cancelled_by_student', terminalAt: new Date() },
        { id: 'item-2', status: 'cancelled_by_student', terminalAt: new Date() },
      ],
    });

    await service.recomputeRetentionSchedule('submission-1');

    expect(storage.delete).toHaveBeenCalledWith(ATTACHMENT.storageKey);
    expect(attachmentRepo.update).toHaveBeenCalledWith({ id: ATTACHMENT.id }, { storageKey: null, deletedAt: expect.any(Date) });
  });

  // A mix that includes even one non-cancelled terminal item (e.g. one
  // approved, one cancelled) must NOT take the immediate-elimination
  // shortcut — RULE-JUST-19.3's "every item cancelled" is an ALL, not an ANY.
  test('test_recompute_mixOfCancelledAndDecided_schedulesInsteadOfEliminating', async () => {
    const { service, attachmentRepo, storage } = buildService({
      items: [
        { id: 'item-1', status: 'cancelled_by_student', terminalAt: new Date('2026-09-01T00:00:00.000Z') },
        { id: 'item-2', status: 'approved', terminalAt: new Date('2026-09-05T00:00:00.000Z') },
      ],
    });

    await service.recomputeRetentionSchedule('submission-1');

    expect(storage.delete).not.toHaveBeenCalled();
    expect(attachmentRepo.update).toHaveBeenCalledWith(
      { id: ATTACHMENT.id },
      { scheduledDeletionAt: new Date(Date.UTC(2026, 8, 5 + ABSENCE_JUSTIFICATION_ATTACHMENT_RETENTION_DAYS)) },
    );
  });

  // The deadline is anchored to the LATEST item's terminalAt, not the first
  // one to become terminal.
  test('test_recompute_multipleTerminalItems_schedulesFromTheLatestTerminalAt', async () => {
    const { service, attachmentRepo } = buildService({
      items: [
        { id: 'item-1', status: 'rejected', terminalAt: new Date('2026-09-01T00:00:00.000Z') },
        { id: 'item-2', status: 'approved', terminalAt: new Date('2026-09-10T00:00:00.000Z') },
      ],
    });

    await service.recomputeRetentionSchedule('submission-1');

    expect(attachmentRepo.update).toHaveBeenCalledWith(
      { id: ATTACHMENT.id },
      { scheduledDeletionAt: new Date(Date.UTC(2026, 8, 10 + ABSENCE_JUSTIFICATION_ATTACHMENT_RETENTION_DAYS)) },
    );
  });

  // terminalAt falls back to updatedAt when null — same fallback the
  // production code documents (an item whose terminalAt was somehow never
  // stamped must still produce a deterministic deadline, not a crash on
  // `.getTime()` of null).
  test('test_recompute_itemWithNullTerminalAt_fallsBackToUpdatedAt', async () => {
    const { service, attachmentRepo } = buildService({
      items: [{ id: 'item-1', status: 'closed_subject_removed', terminalAt: null, updatedAt: new Date('2026-09-03T00:00:00.000Z') }],
    });

    await service.recomputeRetentionSchedule('submission-1');

    expect(attachmentRepo.update).toHaveBeenCalledWith(
      { id: ATTACHMENT.id },
      { scheduledDeletionAt: new Date(Date.UTC(2026, 8, 3 + ABSENCE_JUSTIFICATION_ATTACHMENT_RETENTION_DAYS)) },
    );
  });
});

// RULE-JUST-19: the unattended retention sweep — the only caller of
// sweepDueAttachments (src/scripts/absence-justification-attachment-retention-sweep.ts).
// No prior coverage of either branch.
describe('AbsenceJustificationAttachmentService.sweepDueAttachments', () => {
  function buildService(dueAttachments: AbsenceJustificationAttachmentEntity[]) {
    const queryBuilder = createMockSelectQueryBuilder(dueAttachments);
    const attachmentRepo = createMockRepository({ createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) });

    const repositoriesByEntity = new Map<unknown, MockRepository>([[AbsenceJustificationAttachmentEntity, attachmentRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');

    const storage = { delete: jest.fn().mockResolvedValue(undefined) };

    const service = new AbsenceJustificationAttachmentService(
      tenantContext as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { service, attachmentRepo, storage, queryBuilder };
  }

  test('test_sweep_noDueAttachments_returnsZeroAndNeverDeletes', async () => {
    const { service, storage } = buildService([]);

    const result = await service.sweepDueAttachments();

    expect(result).toBe(0);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  test('test_sweep_dueAttachments_eliminatesEachAndReturnsCount', async () => {
    const due = [
      { id: 'attachment-1', storageKey: 'key-1' } as AbsenceJustificationAttachmentEntity,
      { id: 'attachment-2', storageKey: 'key-2' } as AbsenceJustificationAttachmentEntity,
    ];
    const { service, attachmentRepo, storage } = buildService(due);

    const result = await service.sweepDueAttachments();

    expect(result).toBe(2);
    expect(storage.delete).toHaveBeenCalledWith('key-1');
    expect(storage.delete).toHaveBeenCalledWith('key-2');
    expect(attachmentRepo.update).toHaveBeenCalledWith({ id: 'attachment-1' }, { storageKey: null, deletedAt: expect.any(Date) });
    expect(attachmentRepo.update).toHaveBeenCalledWith({ id: 'attachment-2' }, { storageKey: null, deletedAt: expect.any(Date) });
  });
});
