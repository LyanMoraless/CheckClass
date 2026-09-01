import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { errorMessage } from '../../lib/api-client';
import { listStudents, type EnrollmentStatus, type Student, type StudentEnrollment } from './students-api';

// RULE-INST-11 (business-rules/references/institution-management-rules.md):
// fixed 4-value enum — same Portuguese labels already used in the rule's own
// text (Ativo/Trancado/Formado/Evadido), not invented here.
const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: 'Ativo',
  on_leave: 'Trancado',
  graduated: 'Formado',
  withdrawn: 'Evadido',
};

// Read-only view — gated MANAGE_USERS server-side (RULE-INST-12), same
// permission already used by GET /v1/users. No form here: creating a person
// stays exclusively a Usuários responsibility (see link below); this screen
// only adds the dedicated course/class-group/enrollment-status view on top
// of the basic data Usuários already shows.
export function StudentsPage() {
  const { data: students, isLoading, error } = useQuery({ queryKey: ['students'], queryFn: listStudents });

  return (
    <section>
      <h1>Alunos</h1>
      <p>
        <small>
          Visão dedicada de matrícula dos alunos — mostra curso/turma atual e situação de matrícula, além dos dados
          básicos já exibidos em Usuários. Para cadastrar uma nova pessoa, use a tela <Link to="/users">Usuários</Link>.
        </small>
      </p>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {students && (
        <DataTable<Student>
          rows={students}
          getRowKey={(student) => student.personId}
          emptyMessage="Nenhum aluno com matrícula ainda."
          columns={[
            { header: 'Nome completo', cell: (student) => student.fullName },
            { header: 'Possui login', cell: (student) => (student.hasLoginCredential ? 'Sim' : 'Não') },
            { header: 'Matrículas', cell: (student) => <EnrollmentsList enrollments={student.enrollments} /> },
          ]}
        />
      )}
    </section>
  );
}

// One row per student, not per enrollment (the other reasonable option per
// the DataTable contract, which has no row-span/grouping support): repeating
// a row per enrollment would duplicate this student's name/login across
// several rows whenever they have more than one simultaneous enrollment
// (RULE-ATT-06 already treats that as a normal case elsewhere in the
// system), making "how many distinct students" harder to read at a glance.
// A nested list inside a single "Matrículas" cell keeps one row per person
// while still surfacing every enrollment.
function EnrollmentsList({ enrollments }: { enrollments: StudentEnrollment[] }) {
  if (enrollments.length === 0) {
    return <span>—</span>;
  }
  return (
    <ul>
      {enrollments.map((enrollment) => (
        <li key={enrollment.classGroupId}>
          {enrollment.subjectName} — {enrollment.classGroupName} ({enrollment.courseName}):{' '}
          {ENROLLMENT_STATUS_LABELS[enrollment.enrollmentStatus]}
        </li>
      ))}
    </ul>
  );
}
