// Code-review finding: 'APP_CHECKIN' used to be triplicated as an
// independent string literal in AppCheckinService, IdentificationService,
// and the SeedAppCheckinFactorType migration's seed value — three places
// that had to be kept in sync by hand with no compiler help. Extracted here
// as the one shared constant for the two application services that need it.
//
// The migration deliberately does NOT import this — migrations run standalone
// (independent of the application bundle, potentially against an older
// compiled version of it) and shouldn't depend on application source code.
// Its own literal is intentionally kept, with a comment pointing back here so
// the two stay in sync by convention/review rather than by import.
export const APP_CHECKIN_FACTOR_CODE = 'APP_CHECKIN';
