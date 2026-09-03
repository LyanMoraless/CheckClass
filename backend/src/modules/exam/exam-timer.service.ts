import { Injectable } from '@nestjs/common';
import { ExamSessionEntity } from '../../database/entities';

const MS_PER_MINUTE = 60_000;

// Component 2 of the approved architecture, and the backend's whole
// implementation of RULE-EXAM-07: the server is the source of truth of exam
// time. Every method here is pure — the timer never reads or writes the
// database, it only turns instants into decisions, which is what makes it
// exhaustively unit testable and what keeps time logic out of the frontend.
//
// The frontend receives one absolute expiresAt and does nothing but render a
// countdown from it. On reload the SAME absolute instant is served again
// (RULE-EXAM-11) — there is no "recompute from now" path anywhere in this
// class, on purpose: that is precisely the bug that would hand a student a
// fresh exam period for free.
@Injectable()
export class ExamTimerService {
  // NULL duration = no time limit, which is not the same as "until the
  // window closes" (RULE-EXAM-06). A session with no deadline is closed by
  // the window instead, as ABANDONED — see ExamSessionService.
  expiryAt(startedAt: Date, durationMinutes: number | null): Date | null {
    if (durationMinutes === null) {
      return null;
    }
    return new Date(startedAt.getTime() + durationMinutes * MS_PER_MINUTE);
  }

  // RULE-EXAM-08's trigger. Revalidated on EVERY relevant operation
  // (answering, reporting an event, finishing), never trusted from the
  // client's own clock.
  hasExpired(session: Pick<ExamSessionEntity, 'expiresAt'>, now: Date): boolean {
    if (session.expiresAt === null) {
      return false;
    }
    return now.getTime() >= new Date(session.expiresAt).getTime();
  }

  remainingMs(session: Pick<ExamSessionEntity, 'expiresAt'>, now: Date): number | null {
    if (session.expiresAt === null) {
      return null;
    }
    return Math.max(0, new Date(session.expiresAt).getTime() - now.getTime());
  }
}
