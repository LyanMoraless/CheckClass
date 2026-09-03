import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClassGroupEnrollmentEntity, ExamEntity, TenantEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { INSTITUTION_TYPES } from '../auth/tenant-bootstrap.service';
import { ACTIVE_ENROLLMENT_STATUS, AvailabilityState, EXAM_STATUSES } from './exam-vocabulary';

// Component 1 of the approved architecture: everything that answers "may
// this student be looking at / starting this exam right now?", and nothing
// else. It never writes — the session state is ExamSessionService's alone.
//
// Three independent gates, each from its own rule:
//   RULE-EXAM-02 — the tenant must be a faculdade/escola;
//   RULE-EXAM-16 — the student must hold an ACTIVE enrollment in the exam's
//                  class group;
//   RULE-EXAM-06 — the availability window says when the exam may be
//                  STARTED (never how long each student gets — that is the
//                  individual duration, ExamTimerService).
// Plus the publication gate confirmed on 2026-09-03: a DRAFT exam does not
// exist as far as a student is concerned.
@Injectable()
export class ExamAvailabilityService {
  constructor(private readonly tenantContext: TenantContextService) {}

  // Pure and side-effect free so the window logic can be exhaustively unit
  // tested without a database: RULE-EXAM-06's three states, decided only by
  // the window and the server clock.
  windowState(exam: Pick<ExamEntity, 'availableFrom' | 'availableUntil'>, now: Date): AvailabilityState {
    if (now < new Date(exam.availableFrom)) {
      return 'EXAM_NOT_AVAILABLE';
    }
    if (now > new Date(exam.availableUntil)) {
      return 'EXAM_CLOSED';
    }
    return 'EXAM_AVAILABLE';
  }

  isPublished(exam: Pick<ExamEntity, 'status'>): boolean {
    return exam.status === EXAM_STATUSES[1];
  }

  // RULE-EXAM-02, same institution-type gate mechanism already used to scope
  // features by tenant elsewhere. Read straight from the tenant registry
  // (which is not RLS-scoped — it has no tenant_id of its own), never from
  // anything the caller sends.
  async assertExamAreaEnabled(): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const tenant = await this.tenantContext.getManager().getRepository(TenantEntity).findOneBy({ id: tenantId });

    if (!tenant || !INSTITUTION_TYPES.includes(tenant.institutionType as (typeof INSTITUTION_TYPES)[number])) {
      throw new ForbiddenException('The Exam Area is only available to faculdade/escola institutions (RULE-EXAM-02)');
    }
  }

  // RULE-EXAM-16 (a): eligibility derives from the exam's class group, and
  // only an ACTIVE enrollment qualifies — a trancado/formado/evadido student
  // (RULE-INST-11) is not eligible, same criterion already used for app
  // check-in.
  async hasActiveEnrollment(personId: string, classGroupId: string): Promise<boolean> {
    const count = await this.tenantContext.getManager().getRepository(ClassGroupEnrollmentEntity).count({
      where: { personId, classGroupId, enrollmentStatus: ACTIVE_ENROLLMENT_STATUS },
    });
    return count > 0;
  }

  async activeEnrollmentClassGroupIds(personId: string): Promise<string[]> {
    const enrollments = await this.tenantContext.getManager().getRepository(ClassGroupEnrollmentEntity).find({
      where: { personId, enrollmentStatus: ACTIVE_ENROLLMENT_STATUS },
    });
    return [...new Set(enrollments.map((enrollment) => enrollment.classGroupId))];
  }

  // The gate for anything that merely READS an exam as a student (listing,
  // recovering a session after reload). Deliberately does not look at the
  // window: RULE-EXAM-11 requires a session to be recoverable even after the
  // window has closed, and the student must still be able to see that an
  // exam of theirs is not open yet.
  async assertStudentVisibility(personId: string, exam: ExamEntity): Promise<void> {
    await this.assertExamAreaEnabled();

    if (!this.isPublished(exam)) {
      // Same message as a missing exam on purpose: a DRAFT exam must not be
      // distinguishable from a nonexistent one by a student probing ids.
      throw new ForbiddenException(`exam ${exam.id} is not available to you`);
    }

    if (!(await this.hasActiveEnrollment(personId, exam.classGroupId))) {
      throw new ForbiddenException(
        `Person ${personId} has no active enrollment in class_group ${exam.classGroupId} (RULE-EXAM-16)`,
      );
    }
  }

  // The stricter gate, for STARTING an exam: everything above plus the
  // window being open right now (RULE-EXAM-06).
  async assertStartable(personId: string, exam: ExamEntity, now: Date): Promise<void> {
    await this.assertStudentVisibility(personId, exam);

    const state = this.windowState(exam, now);
    if (state !== 'EXAM_AVAILABLE') {
      throw new ForbiddenException(`exam ${exam.id} cannot be started: ${state} (RULE-EXAM-06)`);
    }
  }
}
