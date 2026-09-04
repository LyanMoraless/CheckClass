import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, BellRing } from 'lucide-react';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { listMyWarnings, type ActiveWarningEntry } from './student-warnings-api';
import styles from './student-warnings-page.module.css';

// LOAD PARAMETER, NOT A UX KNOB. Read this before "tuning" the number below.
// Every poll of GET /v1/me/warnings makes FrequencyWarningReadService run
// LAZY RECONCILIATION first (AttendanceFrequencyEngineService.reconcileForPerson)
// — there is no scheduler/cron/queue anywhere in this project (see the
// service's own comment for the four staleness sources that have no event to
// hang off), so this poll IS the only thing that keeps a student's
// accumulated frequency current across every (turma, matéria) pair they
// have. The exam-panel (5s, exam-panel-page.tsx) and open-incident (4s,
// security-incident-detail-page.tsx) polling precedents are NOT a template
// to match here: pulling this toward their range would multiply that
// per-poll recompute's load by 12-15x for every open student tab, and cannot
// be done without first revisiting the approved architecture decision that
// accepted 60s as this endpoint's cost.
const WARNINGS_POLL_INTERVAL_MS = 60000;

const WARNING_TYPE_LABEL: Record<ActiveWarningEntry['warningType'], string> = {
  approaching_minimum: 'Perto do mínimo',
  below_minimum: 'Abaixo do mínimo',
};

// RULE-FREQ-07: two CONCEPTUALLY DIFFERENT warnings, not one generic warning
// that swaps text — below_minimum (already failing) must read as materially
// more serious than approaching_minimum (still passing, but close). This
// ranks below_minimum first; the .module.css gives each its own tint/icon so
// the difference is visible without reading the label.
const WARNING_SEVERITY_RANK: Record<ActiveWarningEntry['warningType'], number> = {
  below_minimum: 0,
  approaching_minimum: 1,
};

// "YYYY-MM-DD" -> "DD/MM/AAAA" read as plain numbers, never through
// `new Date(...)`. These are calendar facts the backend renders verbatim via
// Postgres to_char for exactly this reason (frequency-warning-read.service.ts,
// decision 3) — parsing them back into a JS Date would reintroduce the
// local-midnight/UTC shift that decision exists to avoid.
function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

// Aluno-only screen (roleContext.isStudent, same gating as the sibling
// portal-student pages) — RULE-FREQ-04 item 2's "área de avisos na home".
// EXCLUSIVE to the student by design (RULE-FREQ-04 addendum b): there is no
// admin/professor-facing equivalent, and none should ever be added here —
// GET /v1/me/warnings is the only endpoint that exists for this data.
export function StudentWarningsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-warnings'],
    queryFn: listMyWarnings,
    refetchInterval: WARNINGS_POLL_INTERVAL_MS,
  });

  // Ranking below_minimum ahead of approaching_minimum is a presentation
  // choice the backend explicitly left to the UI (it orders alphabetically
  // by turma/matéria only) — see the ORDER BY comment in
  // frequency-warning-read.service.ts.
  const warnings = [...(data ?? [])].sort(
    (a, b) => WARNING_SEVERITY_RANK[a.warningType] - WARNING_SEVERITY_RANK[b.warningType],
  );

  return (
    <section>
      <PageHeader
        icon={BellRing}
        area="portal"
        title="Meus avisos"
        description="Avisos de frequência acumulada por matéria (Controle B) — um aviso por matéria em risco, nunca um total agregado do aluno."
      />
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && data.length === 0 && (
        <InfoBanner message="Nenhum aviso no momento — sua frequência acumulada está dentro do exigido em todas as matérias." />
      )}
      {warnings.length > 0 && (
        <ul className={styles.cardList}>
          {warnings.map((warning) => (
            <WarningCard key={warning.id} warning={warning} />
          ))}
        </ul>
      )}
    </section>
  );
}

function WarningCard({ warning }: { warning: ActiveWarningEntry }) {
  const isBelowMinimum = warning.warningType === 'below_minimum';
  return (
    <li className={`${styles.card} ${isBelowMinimum ? styles.cardBelow : styles.cardApproaching}`}>
      <div className={styles.cardHeader}>
        {isBelowMinimum ? (
          <AlertOctagon size={22} className={styles.cardIconBelow} />
        ) : (
          <BellRing size={22} className={styles.cardIconApproaching} />
        )}
        <div className={styles.cardHeading}>
          <p className={styles.cardSubject}>{warning.subjectName}</p>
          <p className={styles.cardClassGroup}>{warning.classGroupName}</p>
        </div>
        <div className={styles.cardBadges}>
          <Badge label={WARNING_TYPE_LABEL[warning.warningType]} tone={isBelowMinimum ? 'danger' : 'warning'} />
          {/* seenAt null = this exact read is the first time this warning was
              ever shown to the student (RULE-FREQ-04 item 1) — the backend
              only stamps seen_at AFTER building this response, so this value
              is still the pre-stamp one. Disappears on the very next poll
              once the stamp lands, which is the intended lifetime of a
              "first access" indicator. */}
          {warning.seenAt === null && <Badge label="Novo" tone="info" />}
        </div>
      </div>
      <dl className={styles.cardGrid}>
        <div>
          <dt>Frequência acumulada</dt>
          <dd>{warning.frequencyPercentage}%</dd>
        </div>
        <div>
          <dt>Aulas consideradas</dt>
          <dd>
            {warning.presentCount} de {warning.consideredCount} aulas
          </dd>
        </div>
        <div>
          <dt>Mínimo exigido no período</dt>
          <dd>{warning.minPercentageApplied}%</dd>
        </div>
        <div>
          <dt>Período de apuração</dt>
          <dd>
            {formatDateOnly(warning.periodStartDate)} a {formatDateOnly(warning.periodEndDate)}
          </dd>
        </div>
      </dl>
    </li>
  );
}
