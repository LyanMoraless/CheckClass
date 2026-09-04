// RULE-FREQ-02: the reporting period Controle B accumulates frequency over.
// Exactly these three values for every institution — like RULE-ATT-14's
// post_tolerance_behavior and unlike the factor list (RULE-ATT-13), this set
// is not extensible, and there is no free/custom periodicity.
//
// The calendar arithmetic each value maps to (2, 3 and 6 months) deliberately
// does NOT live here: this enum is the vocabulary shared by the config
// surface and the database CHECK, while the slicing of
// class_group.term_start_date/term_end_date into concrete windows belongs to
// the attendance-frequency module that owns Controle B.
export enum AccumulatedFrequencyPeriod {
  BIMESTER = 'bimester',
  TRIMESTER = 'trimester',
  SEMESTER = 'semester',
}
