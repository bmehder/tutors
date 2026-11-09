# Elm domain laboratory

Run `node temp-reference/domain-lab/run.mjs` from the repository root. Requires Elm 0.19.1 and Node. No app runtime dependency is added.

This isolated laboratory models opaque weekly Plan values, fixed one-hour Session records, validated Schedule values, and incomplete BookingDraft values. Package changes reset dependent allocations. `complete` rejects missing names, missing routines, mismatched hour allocations, invalid references, unsupported subjects, capacity/student-limit violations, availability conflicts, overlaps, and insufficient notice.

Student IDs, tutor IDs, subject IDs, and fixture times have validated constructors. Student names live in the draft; Catalog owns valid student identities. The production order must retain names and contact alongside a validated schedule. Contact collection and calendar adapters are not implemented here.

FixtureTime is an Eastern wall-clock minute offset from a fixture Monday. It is not a production instant or DST/calendar implementation. The fixture availability is illustrative. Production persistence, atomic reservations, and authentication are outside the lab.

Individual-session customization, skipped weeks, and variable durations have been removed from the active model. The React playground still has legacy internal types and is not an implementation of these Elm ADTs.

Build output and elm-stuff are ignored by Git. The scenario report exits unsuccessfully if any check fails.
