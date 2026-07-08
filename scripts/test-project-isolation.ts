// Full cross-table project isolation check.
//
// The original spec for this script assumed Supabase (service role key,
// per-user RLS, "test users"). This app has none of that -- no Supabase,
// no auth, no users. It's single-tenant Railway Postgres where every
// table is scoped by `WHERE project_id = ...` in application code. So
// this is the same idea translated to what's actually here: two
// throwaway PROJECTS (not users), one row of every content type each,
// then every read query the app uses, scoped to project A, asserted to
// never return anything belonging to project B.
//
// Runs inside a transaction that's always rolled back at the end --
// leaves no fixture data behind, safe to run against a real database.
//
// Usage: DATABASE_URL=... node scripts/test-project-isolation.ts

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

const PROJECT_A = "a0000000-0000-0000-0000-00000000000a";
const PROJECT_B = "b0000000-0000-0000-0000-00000000000b";
const SESSION_A = "a1111111-0000-0000-0000-00000000000a";
const SESSION_B = "b1111111-0000-0000-0000-00000000000b";

const MARKER_A = "ISOLATION_TEST_SECRET_BELONGS_TO_PROJECT_A";
const MARKER_B = "ISOLATION_TEST_SECRET_BELONGS_TO_PROJECT_B";

type CheckResult = { name: string; pass: boolean; detail?: string };
const results: CheckResult[] = [];

function check(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
}

// Deterministic fixed-size vector -- same value for both projects, since
// the isolation guarantee under test is the WHERE clause, not embedding
// quality. See tests/memory-isolation.test.mjs for the same reasoning.
function vectorLiteral(): string {
  const values = Array.from({ length: 1536 }, (_, i) => Math.sin(i) * 0.01);
  return `[${values.join(",")}]`;
}

async function seed(tx: postgres.TransactionSql) {
  await tx`insert into projects (id, name) values (${PROJECT_A}, 'Isolation Test A')`;
  await tx`insert into projects (id, name) values (${PROJECT_B}, 'Isolation Test B')`;

  for (const [projectId, marker] of [
    [PROJECT_A, MARKER_A],
    [PROJECT_B, MARKER_B],
  ] as const) {
    await tx`
      insert into project_documents (project_id, name, file_type, file_data)
      values (${projectId}, ${marker}, 'text/plain', ${Buffer.from(marker)})
    `;
    await tx`
      insert into project_links (project_id, url, label)
      values (${projectId}, 'https://example.com', ${marker})
    `;
    await tx`
      insert into project_logs (project_id, entry)
      values (${projectId}, ${marker})
    `;
    await tx`
      insert into project_notes (project_id, meeting_date, content)
      values (${projectId}, current_date, ${marker})
    `;
  }

  await tx`
    insert into chat_sessions (id, project_id, title, provider, model)
    values (${SESSION_A}, ${PROJECT_A}, 'Chat', 'anthropic', 'claude-sonnet-5')
  `;
  await tx`
    insert into chat_sessions (id, project_id, title, provider, model)
    values (${SESSION_B}, ${PROJECT_B}, 'Chat', 'anthropic', 'claude-sonnet-5')
  `;
  await tx`
    insert into chat_messages (session_id, project_id, role, content)
    values (${SESSION_A}, ${PROJECT_A}, 'user', ${MARKER_A})
  `;
  await tx`
    insert into chat_messages (session_id, project_id, role, content)
    values (${SESSION_B}, ${PROJECT_B}, 'user', ${MARKER_B})
  `;

  const vector = vectorLiteral();
  await tx`
    insert into memory_embeddings (project_id, source_type, source_id, content_chunk, embedding)
    values (${PROJECT_A}, 'note', ${PROJECT_A}, ${MARKER_A}, ${vector}::vector)
  `;
  await tx`
    insert into memory_embeddings (project_id, source_type, source_id, content_chunk, embedding)
    values (${PROJECT_B}, 'note', ${PROJECT_B}, ${MARKER_B}, ${vector}::vector)
  `;

  return vector;
}

// Every project-scoped read query the app actually runs (mirrors the
// queries in app/(dashboard)/*-actions.ts and lib/rag/index.ts), each
// scoped to project A, each asserted to never surface project B's marker.
async function runChecks(tx: postgres.TransactionSql, vector: string) {
  const documents = await tx`
    select name from project_documents where project_id = ${PROJECT_A}
  `;
  check(
    "getDocuments(A) excludes B",
    documents.every((r) => r.name !== MARKER_B) && documents.some((r) => r.name === MARKER_A),
  );

  const links = await tx`
    select label from project_links where project_id = ${PROJECT_A}
  `;
  check(
    "getLinks(A) excludes B",
    links.every((r) => r.label !== MARKER_B) && links.some((r) => r.label === MARKER_A),
  );

  const logs = await tx`
    select entry from project_logs where project_id = ${PROJECT_A}
  `;
  check(
    "getLogs(A) excludes B",
    logs.every((r) => r.entry !== MARKER_B) && logs.some((r) => r.entry === MARKER_A),
  );

  const notes = await tx`
    select content from project_notes where project_id = ${PROJECT_A}
  `;
  check(
    "getNotes(A) excludes B",
    notes.every((r) => r.content !== MARKER_B) && notes.some((r) => r.content === MARKER_A),
  );

  const messagesRight = await tx`
    select content from chat_messages
    where session_id = ${SESSION_A} and project_id = ${PROJECT_A}
  `;
  check(
    "getMessages(sessionA, projectA) excludes B",
    messagesRight.every((r) => r.content !== MARKER_B) &&
      messagesRight.some((r) => r.content === MARKER_A),
  );

  // The mismatched-pair case /api/chat's own guard relies on: a real
  // session id with the WRONG project id must return nothing.
  const messagesWrong = await tx`
    select content from chat_messages
    where session_id = ${SESSION_A} and project_id = ${PROJECT_B}
  `;
  check("getMessages(sessionA, projectB) [mismatched] returns nothing", messagesWrong.length === 0);

  const memory = await tx`
    select content_chunk from memory_embeddings
    where project_id = ${PROJECT_A}
    order by embedding <-> ${vector}::vector
    limit 5
  `;
  check(
    "searchMemory(A) excludes B even with identical query vector",
    memory.every((r) => r.content_chunk !== MARKER_B) &&
      memory.some((r) => r.content_chunk === MARKER_A),
  );
}

async function main() {
  class RollbackSentinel extends Error {}

  await sql
    .begin(async (tx) => {
      const vector = await seed(tx);
      await runChecks(tx, vector);
      throw new RollbackSentinel(); // always roll back -- no fixture data left behind
    })
    .catch((err) => {
      if (!(err instanceof RollbackSentinel)) throw err;
    });

  const failed = results.filter((r) => !r.pass);

  console.log("\nProject isolation check results:\n");
  for (const r of results) {
    console.log(`  ${r.pass ? "✔ PASS" : "✘ FAIL"}  ${r.name}${r.detail ? ` -- ${r.detail}` : ""}`);
  }
  console.log(
    `\n${failed.length === 0 ? "PASS" : "FAIL"}: ${results.length - failed.length}/${results.length} checks passed\n`,
  );

  await sql.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("Isolation check crashed:", err);
  await sql.end();
  process.exit(1);
});
