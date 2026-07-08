import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { decrypt, encrypt, maskKey } from "@/lib/crypto";
import { isKnownProvider } from "@/lib/llm/models";

export async function GET() {
  const rows = await sql<{ provider: string; encrypted_key: string }[]>`
    select provider, encrypted_key from api_keys
  `;

  const keys = rows.map((row) => ({
    provider: row.provider,
    masked: maskKey(decrypt(row.encrypted_key)),
  }));

  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const { provider, apiKey } = (await req.json()) as {
    provider?: string;
    apiKey?: string;
  };

  if (!provider || !isKnownProvider(provider)) {
    return new Response(`Unknown provider: ${provider}`, { status: 400 });
  }
  if (!apiKey?.trim()) {
    return new Response("apiKey is required", { status: 400 });
  }

  const trimmed = apiKey.trim();
  const encrypted = encrypt(trimmed);

  await sql`
    insert into api_keys (provider, encrypted_key)
    values (${provider}, ${encrypted})
    on conflict (provider) do update set encrypted_key = excluded.encrypted_key
  `;

  return NextResponse.json({ provider, masked: maskKey(trimmed) });
}

export async function DELETE(req: Request) {
  const { provider } = (await req.json()) as { provider?: string };

  if (!provider || !isKnownProvider(provider)) {
    return new Response(`Unknown provider: ${provider}`, { status: 400 });
  }

  await sql`delete from api_keys where provider = ${provider}`;

  return NextResponse.json({ provider });
}
