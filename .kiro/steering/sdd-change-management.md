# SDD Change Management

## Source of truth

The versioned files under `.kiro/specs/` are the primary source of truth for
MindFlow. Product code, database migrations, tests, API contracts, and general
documentation must remain consistent with those specifications.

The MindFlow specification is composed of:

- `.kiro/specs/mindflow/requirements.md`
- `.kiro/specs/mindflow/design.md`
- `.kiro/specs/mindflow/tasks.md`
- `.kiro/specs/mindflow/traceability.md`

Do not create a second specification tree under `/specs`. A duplicated source
of truth makes change detection and traceability ambiguous.

## Required workflow for specification changes

When any file under `.kiro/specs/**` changes, the agent must:

1. Determine the Git comparison range and inspect the specification diff.
2. Classify each affected requirement as new, modified, or removed.
3. Extract and normalize requirement identifiers such as `3`, `3.1`, and
   `REQ-3.1` to the canonical form `REQ-3.1`.
4. Consult `traceability.md` before proposing implementation changes.
5. Analyze impact on architecture, database, backend, frontend, API,
   automated tests, tasks, and documentation.
6. Identify contradictions between requirements, design, tasks, code, and
   tests.
7. Produce or update an SDD Change Impact Report before implementation.
8. Run the smallest relevant tests first, followed by the appropriate
   regression suite after implementation.

## Change gate

The agent must not silently implement a changed requirement. Before changing
product code, it must report:

- the requirement identifiers affected;
- the old and new behavior;
- the files and tests likely to be affected;
- missing or ambiguous traceability;
- required design, task, migration, API, and documentation changes;
- risks and backward-compatibility considerations.

If a requirement is ambiguous or conflicts with another specification, stop
and request clarification. If traceability is missing, report the gap and add
updating the matrix to the required actions.

## Impact analysis rules

Evaluate every changed requirement against these areas:

| Area | Questions to evaluate |
| --- | --- |
| Architecture | Does the change alter components, boundaries, dependencies, data flow, or deployment? |
| Database | Does it alter models, constraints, relations, migrations, seed data, or retention? |
| Backend | Does it alter services, controllers, validation, scheduling, serialization, or error handling? |
| Frontend | Does it alter pages, components, validation, messages, states, or accessibility? |
| API | Does it alter routes, payloads, status codes, authentication, or response contracts? |
| Tests | Which unit, property, integration, E2E, smoke, or regression tests represent the requirement? |
| Documentation | Must design, tasks, README, API documentation, or operational guidance change? |

## Traceability rules

- Every acceptance criterion must have a stable identifier.
- Existing numeric identifiers remain valid and are normalized as `REQ-x.y`.
- Implementation and tests should reference the same requirement identifier.
- A completed implementation task does not prove continued compliance; the
  related automated test is the executable evidence.
- Removed requirements must trigger a review for obsolete code, tests, API
  behavior, database structures, and documentation. Removal is never an
  instruction to delete code automatically.

## CI behavior

The SDD review workflow is evidence generation, not an autonomous product-code
writer. It must:

- use Git as the change detector;
- use the specification diff as the analysis input;
- generate a Markdown impact report;
- publish the report in the workflow summary and as an artifact;
- fail when specification changes cannot be traced to the matrix.

The workflow must not modify or commit application code.
