import { Injectable } from '@nestjs/common';
import { ClassGroupSubjectTeacherEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

// RULE-JUST-24's narrow authorization primitive: "é o professor responsável
// por esta matéria, nesta turma" — deliberately NOT LeadershipScopeService,
// which walks the leadership chain RULE-JUST-08/24 explicitly exclude from
// attachment/category/motivo access. Mirrors, at the application layer, the
// exact EXISTS predicate every teacher_subject_scope RLS policy in the
// AddAbsenceJustification migration already runs at the row level — this is
// the defense-in-depth half (a clear ForbiddenException instead of a "0 rows
// affected"/empty result), never a substitute for RLS.
@Injectable()
export class TeacherSubjectScopeService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async isSubjectTeacher(personId: string, classGroupId: string, subjectId: string): Promise<boolean> {
    const manager = this.tenantContext.getManager();
    const count = await manager.getRepository(ClassGroupSubjectTeacherEntity).count({
      where: { personId, classGroupId, subjectId },
    });
    return count > 0;
  }
}
