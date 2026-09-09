import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Frente 07's audit trail for the attachment (RULE-JUST-11.2/11.3) — every
// access, for every role, INCLUDING the titular themselves and INCLUDING
// denied attempts. Append-only AT THE DATABASE LEVEL: privilege revoked from
// the application role plus a trigger that refuses UPDATE/DELETE for ANY
// role, the exact mechanism RULE-JUST-11.3 names by precedent
// (exam_session_event, see the AddExamArea migration) — "convenção de
// código não é controle aceitável" is the rule's own words for why grants
// alone are not enough. See the migration for the GRANT/REVOKE + trigger
// block, copied from exam_session_event's.
//
// access_result has a third outcome beyond granted/denied:
// deleted_unavailable, for an attempt against an attachment already
// eliminated (RULE-JUST-19.5) — without it this log could not tell "no
// permission" apart from "nothing left to open", and RULE-JUST-19.5 requires
// the caller-facing response to make exactly that distinction, never a
// generic error.
//
// attachment_owner_person_id is denormalized from the attachment (not from
// accessed_by_person_id, which is whoever DID the accessing — often a
// different person, e.g. the teacher). It exists purely to let the titular's
// own read policy ("see who opened MY attestado", RULE-JUST-11.4) be a flat
// column comparison, protected against falsification by the composite FK to
// absence_justification_attachment(id, person_id) in the migration — same
// pattern used throughout the Exam Area for the identical reason.
//
// ip_address/user_agent are stored per the confirmed decision in
// pending-decisions.md ("Anexo e log de acesso — DECIDIDOS em 2026-09-08") —
// they are themselves personal data and sit under the same restricted-access
// regime as the rest of this log.
@Entity({ name: 'absence_justification_attachment_access_log' })
export class AbsenceJustificationAttachmentAccessLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'attachment_id', type: 'uuid' })
  attachmentId: string;

  // Denormalized owner of the attachment — see entity comment above.
  @Column({ name: 'attachment_owner_person_id', type: 'uuid' })
  attachmentOwnerPersonId: string;

  // Whoever attempted the access — may be the titular, the subject-teacher,
  // or anyone else whose attempt was denied (RULE-JUST-11.2: every attempt
  // is logged, including denied ones, including the titular's own).
  @Column({ name: 'accessed_by_person_id', type: 'uuid' })
  accessedByPersonId: string;

  // granted | denied | deleted_unavailable — see entity comment above.
  @Column({ name: 'access_result', type: 'varchar', length: 30 })
  accessResult: string;

  // Free text on purpose, same reasoning already used for
  // exam_session_event.event_type: the allow-list of denial causes will grow
  // as the Backend Agent implements the RULE-JUST-24 narrow check, and a new
  // cause must not require a migration. The client-facing allow-list (what
  // gets shown to whom) is an application concern, not a DB one.
  @Column({ name: 'denial_reason', type: 'varchar', length: 60, nullable: true })
  denialReason: string | null;

  @Column({ name: 'ip_address', type: 'inet' })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  // Written by the server, never accepted from the client — same posture as
  // exam_session_event.occurredAt, for the same reason (RULE-JUST-11.5:
  // authorization and, by extension, its record, are never client-supplied).
  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt: Date;
}
