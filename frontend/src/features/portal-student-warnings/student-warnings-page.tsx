import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, BellRing, FileCheck2, RotateCcw, X } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import {
  dismissJustificationNotice,
  listMyJustificationNotices,
  type AbsenceJustificationApprovalRevokedDetails,
  type AbsenceJustificationDecisionResultDetails,
  type AbsenceJustificationNotice,
} from '../portal-student-justifications/absence-justification-notice-api';
import { listMySchedule } from '../portal-student/student-schedule-api';
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
//
// RULE-JUST-22 notices are read-model events, not a recomputed number, so
// nothing about them requires this exact interval — reusing it for
// GET /v1/absence-justification-notices too is a simplicity choice (one
// poll cadence for the whole "área de avisos"), not a cost constraint on
// that endpoint's own account.
const WARNINGS_POLL_INTERVAL_MS = 60000;

const WARNING_TYPE_LABEL: Record<ActiveWarningEntry['warningType'], string> = {
  approaching_minimum: 'Perto do mínimo',
  below_minimum: 'Abaixo do mínimo',
};

const NOTICE_TYPE_LABEL: Record<AbsenceJustificationNotice['noticeType'], string> = {
  decision_result: 'Resultado de justificativa',
  approval_revoked: 'Revogação de aprovação',
};

// RULE-JUST-22.6: "os dois tipos aparecem em lista única, ordenada por
// recência" — the backend deliberately keeps GET /v1/me/warnings and
// GET /v1/absence-justification-notices as two separate read models (see
// AbsenceJustificationNoticeReadService's header comment: merging is a
// read-side concern left for whoever renders the "área de avisos", not the
// backend). This page is that single-list merge, done entirely client-side
// so neither existing endpoint has to change.
type FeedEntry =
  | { kind: 'frequency'; recency: number; warning: ActiveWarningEntry }
  | { kind: 'justification'; recency: number; notice: AbsenceJustificationNotice };

// Aluno-only screen (roleContext.isStudent, same gating as the sibling
// portal-student pages) — RULE-FREQ-04 item 2's "área de avisos na home",
// extended by RULE-JUST-21/22 to carry a second, unrelated event type
// (justification decision results/revocations) in the SAME list.
export function StudentWarningsPage() {
  const queryClient = useQueryClient();

  const { data: warnings, isLoading: warningsLoading, error: warningsError } = useQuery({
    queryKey: ['student-warnings'],
    queryFn: listMyWarnings,
    refetchInterval: WARNINGS_POLL_INTERVAL_MS,
  });

  const { data: notices, isLoading: noticesLoading, error: noticesError } = useQuery({
    queryKey: ['student-justification-notices'],
    queryFn: listMyJustificationNotices,
    refetchInterval: WARNINGS_POLL_INTERVAL_MS,
  });

  const { data: schedule } = useQuery({ queryKey: ['student-schedule'], queryFn: listMySchedule });
  // classSessionId -> "matéria — turma" label. Notices only carry subjectId
  // (no subjectName) and classGroupId is not even on the notice at all —
  // resolving through a classSessionId that appears inside the notice's own
  // details (RULE-JUST-21 items 2-4) is the only path available without a
  // new backend field (flagged in the Frontend Implementation Summary).
  const classGroupSubjectLabelBySessionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of schedule ?? []) {
      map.set(entry.classSessionId, `${entry.subjectName} — ${entry.classGroupName}`);
    }
    return map;
  }, [schedule]);

  const dismissMutation = useMutation({
    mutationFn: dismissJustificationNotice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student-justification-notices'] }),
  });

  // Ranking below_minimum ahead of approaching_minimum is a presentation
  // choice the backend explicitly left to the UI (RULE-FREQ-07) — kept as a
  // SECONDARY tiebreaker below, since RULE-JUST-22.6 requires the merged
  // list's primary order to be recency, not severity.
  const feed = useMemo<FeedEntry[]>(() => {
    const warningEntries: FeedEntry[] = (warnings ?? []).map((warning) => ({
      kind: 'frequency',
      // ActiveWarningEntry carries no createdAt of its own — warningTypeSince
      // (when the warning last CHANGED type/appeared) is the closest proxy
      // for "recência" this endpoint offers.
      recency: new Date(warning.warningTypeSince).getTime(),
      warning,
    }));
    const noticeEntries: FeedEntry[] = (notices ?? []).map((notice) => ({
      kind: 'justification',
      recency: new Date(notice.createdAt).getTime(),
      notice,
    }));
    return [...warningEntries, ...noticeEntries].sort((a, b) => {
      if (a.recency !== b.recency) {
        return b.recency - a.recency;
      }
      const severity = (entry: FeedEntry) => (entry.kind === 'frequency' && entry.warning.warningType === 'below_minimum' ? 0 : 1);
      return severity(a) - severity(b);
    });
  }, [warnings, notices]);

  const isLoading = warningsLoading || noticesLoading;

  return (
    <section>
      <PageHeader
        icon={BellRing}
        area="portal"
        title="Meus avisos"
        description="Frequência acumulada por matéria em risco e resultado de pedidos de justificativa de falta, em uma lista única."
      />
      {isLoading && <Loading />}
      {warningsError && <ErrorBanner message={errorMessage(warningsError)} />}
      {noticesError && <ErrorBanner message={errorMessage(noticesError)} />}
      {!isLoading && feed.length === 0 && (
        <InfoBanner message="Nenhum aviso no momento." />
      )}
      {feed.length > 0 && (
        <ul className={styles.cardList}>
          {feed.map((entry) =>
            entry.kind === 'frequency' ? (
              <WarningCard key={`warning-${entry.warning.id}`} warning={entry.warning} />
            ) : (
              <NoticeCard
                key={`notice-${entry.notice.id}`}
                notice={entry.notice}
                subjectLabel={resolveNoticeSubjectLabel(entry.notice, classGroupSubjectLabelBySessionId)}
                onDismiss={() => dismissMutation.mutate(entry.notice.id)}
                isDismissing={dismissMutation.isPending && dismissMutation.variables === entry.notice.id}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function resolveNoticeSubjectLabel(notice: AbsenceJustificationNotice, labelBySessionId: Map<string, string>): string | null {
  const firstSessionId =
    notice.noticeType === 'decision_result'
      ? (notice.details as AbsenceJustificationDecisionResultDetails).items[0]?.classSessionId
      : (notice.details as AbsenceJustificationApprovalRevokedDetails).revocations[0]?.classSessionId;
  return firstSessionId ? (labelBySessionId.get(firstSessionId) ?? null) : null;
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
          <Badge label="Frequência" tone="neutral" />
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

// RULE-JUST-21/22: a justification notice, rendered as its own card type
// (rotulado com o seu tipo, RULE-JUST-22.6) — never sharing WarningCard's
// markup, since its content (approved/rejected counts, professor's motivo,
// frequency before/after) has nothing in common with a frequency warning's.
function NoticeCard({
  notice,
  subjectLabel,
  onDismiss,
  isDismissing,
}: {
  notice: AbsenceJustificationNotice;
  subjectLabel: string | null;
  onDismiss: () => void;
  isDismissing: boolean;
}) {
  const isRevocation = notice.noticeType === 'approval_revoked';
  return (
    <li className={`${styles.card} ${isRevocation ? styles.cardBelow : styles.cardApproaching}`}>
      <div className={styles.cardHeader}>
        {isRevocation ? (
          <RotateCcw size={22} className={styles.cardIconBelow} />
        ) : (
          <FileCheck2 size={22} className={styles.cardIconApproaching} />
        )}
        <div className={styles.cardHeading}>
          <p className={styles.cardSubject}>{subjectLabel ?? `Matéria ${notice.subjectId}`}</p>
          <p className={styles.cardClassGroup}>{new Date(notice.createdAt).toLocaleString('pt-BR')}</p>
        </div>
        <div className={styles.cardBadges}>
          <Badge label={NOTICE_TYPE_LABEL[notice.noticeType]} tone="neutral" />
          {/* Unlike ActiveWarningEntry.seenAt, this "Novo" badge is purely
              informational (RULE-JUST-22.2: "não some ao ser lido") — it
              disappears on the next poll once the backend stamps seenAt, but
              nothing else about the notice changes. */}
          {notice.seenAt === null && <Badge label="Novo" tone="info" />}
        </div>
      </div>

      {notice.noticeType === 'decision_result' ? (
        <DecisionResultBody details={notice.details as AbsenceJustificationDecisionResultDetails} />
      ) : (
        <RevocationBody details={notice.details as AbsenceJustificationApprovalRevokedDetails} />
      )}

      <button type="button" className={`secondary ${styles.dismissButton}`} onClick={onDismiss} disabled={isDismissing}>
        <X size={14} />
        {isDismissing ? 'Dispensando…' : 'Dispensar'}
      </button>
    </li>
  );
}

function DecisionResultBody({ details }: { details: AbsenceJustificationDecisionResultDetails }) {
  return (
    <div>
      <p>
        {details.approvedCount} {details.approvedCount === 1 ? 'aula abonada' : 'aulas abonadas'}, {details.rejectedCount}{' '}
        {details.rejectedCount === 1 ? 'aula rejeitada' : 'aulas rejeitadas'}.
      </p>
      {/* RULE-JUST-21 item 4: only present on an approval — this is the
          explanation for a frequency warning that may have just silently
          disappeared from this same list (RULE-JUST-21 item 5). */}
      {details.frequencyAfterPercentage !== null && (
        <p>
          Sua frequência {details.frequencyBeforePercentage !== null ? `passou de ${details.frequencyBeforePercentage}% ` : ''}
          para {details.frequencyAfterPercentage}%.
        </p>
      )}
      {details.rejectedCount > 0 && (
        <p>
          <small>
            {details.resendMayStillBeEligible
              ? 'Ainda pode ser possível enviar um novo pedido para a(s) aula(s) rejeitada(s), se o prazo permitir.'
              : 'O prazo para um novo pedido sobre a(s) aula(s) rejeitada(s) já encerrou.'}
          </small>
        </p>
      )}
      {details.items
        .filter((item) => item.status === 'rejected' && item.note)
        .map((item) => (
          <p key={item.classSessionId}>
            <small>Motivo da rejeição: {item.note}</small>
          </p>
        ))}
    </div>
  );
}

function RevocationBody({ details }: { details: AbsenceJustificationApprovalRevokedDetails }) {
  return (
    <div>
      {details.revocations.map((revocation, index) => (
        <p key={`${revocation.classSessionId}-${index}`}>
          Uma aprovação foi revogada. Motivo: {revocation.note}
        </p>
      ))}
    </div>
  );
}

// "YYYY-MM-DD" -> "DD/MM/AAAA" read as plain numbers, never through
// `new Date(...)`. These are calendar facts the backend renders verbatim via
// Postgres to_char for exactly this reason (frequency-warning-read.service.ts,
// decision 3) — parsing them back into a JS Date would reintroduce the
// local-midnight/UTC shift that decision exists to avoid.
function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
