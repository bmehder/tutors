# Executable domain slice — Phase 1

A small, isolated Elm model for testing the scheduling ideas in `docs/domain-model.md`. It is not connected to the React playground or a database and has no UI. It is not the final Lustre implementation.

## Run

Requires Elm 0.19.1 and Node:

```sh
node domain-lab/run.mjs
```

Run from the repository root. The runner compiles the actual Elm domain and scenarios, reports each scenario, and exits nonzero if any fails. Only `elm/core` and `elm/json` are needed. Build output and `elm-stuff` are ignored.

## Domain boundary

`Schedule`, `Plan`, `Sessions`, IDs, and fixture times have private constructors. Plans are proposals: `weekly` rejects zero sessions, but only `schedule`, `addPlan`, and `customize` validate them as part of a schedule. Each returns a `Result`. No invalid replacement schedule is returned on failure, and the original immutable value remains usable. This is one validation boundary, not repeated UI-level defensive checks.

The public ID and fixture-time constructors return `Maybe` for invalid input. Test fixture creation fails loudly if its data is wrong. Contact information, catalog editing, identity allocation, and storage are deliberately absent from this executable slice.

## Explicit fixture limitations

- `FixtureTime` is an integer minute position on a local Eastern fixture timeline. It is **not** a production timestamp or calendar implementation. Day zero represents Monday, January 4, 2027; test lessons are before the spring clock change. The final calendar/date validation, DST handling, midnight behavior, and named time conversion are not tested by this representation.
- The 24-hour notice in scenarios is a test input, not an adopted policy.
- Catalogs and availability are supplied, valid fixture data. The lab does not validate catalog construction, solve concurrency, reserve real tutors, process payments, or send messages.
- External reservations are supplied as input. There is no automatic global booking lookup.
- Initial/new reservations check notice. An unchanged already accepted start does not expire when adding another plan or re-saving an occurrence. A changed start or tutor checks notice anew. Other rescheduling/cancellation policies remain outside this slice.
- Group tutoring is excluded by the singular `student` field. Contacting the company is a product boundary, not an implemented request workflow.
- This is scenario testing, not fuzz testing or proof of all invariants. It does not yet discover and rank available alternatives.

## Results

29/29 scenarios passed on November 8, 2026. See `tests/Scenarios.elm` for actual inputs and assertions. The port runner uses Elm itself for all domain calculations, not a second JavaScript implementation.

The domain document remains the design reference. Only the concepts needed for this executable slice have been translated; differences and unresolved behavior are documented instead of silently treated as final design choices.
