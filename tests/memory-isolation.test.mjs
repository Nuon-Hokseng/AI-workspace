// Confirms a similarity search scoped to one project never returns another
// project's chunks -- even when the content and the embedding are
// identical, so the only thing that could be filtering results is the
// `where project_id = ...` clause, not anything about the vectors
// themselves.
//
// Uses synthetic embeddings (no OpenAI call, no API key needed): the
// isolation guarantee is a property of the WHERE clause, not of embedding
// quality, so there's nothing to gain from a real embedding here.
//
// Run with: npm test  (requires DATABASE_URL to point at a Postgres with
// the memory_embeddings migration applied)

import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

const PROJECT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const PROJECT_B = "bbbbbbbb-0000-0000-0000-000000000002";
const CHUNK_A = "cccccccc-0000-0000-0000-000000000003";
const CHUNK_B = "dddddddd-0000-0000-0000-000000000004";

const SAME_TEXT = "identical content chunk text, on purpose";

// A fixed 1536-dim vector -- same vector, same text, for both projects'
// chunks. If isolation ever broke, this is exactly the setup that would
// let project B's chunk slip into project A's results undetected by any
// "well the content was different" excuse.
function vectorLiteral() {
  const values = Array.from({ length: 1536 }, (_, i) => Math.sin(i) * 0.01);
  return `[${values.join(",")}]`;
}

test("similarity search scoped to project A never returns project B's chunks", async () => {
  await sql.begin(async (tx) => {
    await tx`insert into projects (id, name) values (${PROJECT_A}, 'RAG isolation test A')`;
    await tx`insert into projects (id, name) values (${PROJECT_B}, 'RAG isolation test B')`;

    const vector = vectorLiteral();

    await tx`
      insert into memory_embeddings (id, project_id, source_type, source_id, content_chunk, embedding)
      values (${CHUNK_A}, ${PROJECT_A}, 'note', ${PROJECT_A}, ${SAME_TEXT}, ${vector}::vector)
    `;
    await tx`
      insert into memory_embeddings (id, project_id, source_type, source_id, content_chunk, embedding)
      values (${CHUNK_B}, ${PROJECT_B}, 'note', ${PROJECT_B}, ${SAME_TEXT}, ${vector}::vector)
    `;

    const results = await tx`
      select id, content_chunk
      from memory_embeddings
      where project_id = ${PROJECT_A}
      order by embedding <-> ${vector}::vector
      limit 5
    `;

    assert.equal(results.length, 1, "expected exactly one chunk visible to project A");
    assert.equal(results[0].id, CHUNK_A);
    assert.notEqual(
      results[0].id,
      CHUNK_B,
      "project A's search must never return project B's chunk",
    );

    // Rolling back leaves no fixture data behind either way, but bail out
    // explicitly so a failed assertion can't accidentally get committed.
    throw new RollbackSentinel();
  }).catch((err) => {
    if (!(err instanceof RollbackSentinel)) throw err;
  });
});

class RollbackSentinel extends Error {}

test.after(async () => {
  await sql.end();
});
