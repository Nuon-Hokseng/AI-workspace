"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROVIDERS, type ProviderId } from "@/lib/llm/models";

type KeyMap = Record<ProviderId, string | null>;

function emptyKeyMap(): KeyMap {
  return Object.fromEntries(PROVIDERS.map((p) => [p.id, null])) as KeyMap;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<KeyMap | null>(null);

  useEffect(() => {
    fetch("/api/keys")
      .then((res) => res.json())
      .then((data: { keys: { provider: ProviderId; masked: string }[] }) => {
        const map = emptyKeyMap();
        for (const k of data.keys) map[k.provider] = k.masked;
        setKeys(map);
      });
  }, []);

  if (!keys) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => (
        <ApiKeyRow
          key={p.id}
          providerId={p.id}
          label={p.label}
          masked={keys[p.id]}
          onSaved={(masked) => setKeys((prev) => ({ ...(prev ?? emptyKeyMap()), [p.id]: masked }))}
          onRemoved={() => setKeys((prev) => ({ ...(prev ?? emptyKeyMap()), [p.id]: null }))}
        />
      ))}
    </div>
  );
}

function ApiKeyRow({
  providerId,
  label,
  masked,
  onSaved,
  onRemoved,
}: {
  providerId: ProviderId;
  label: string;
  masked: string | null;
  onSaved: (masked: string) => void;
  onRemoved: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    const apiKey = value.trim();
    if (!apiKey) return;
    setBusy(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, apiKey }),
      });
      if (res.ok) {
        const data = await res.json();
        onSaved(data.masked);
        setValue("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      onRemoved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="w-28 shrink-0">
        <Label>{label}</Label>
        <p className="truncate text-xs text-muted-foreground">{masked ?? "Not set"}</p>
      </div>
      <Input
        type="password"
        placeholder={masked ? "Replace key…" : "Paste API key…"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
      />
      <Button size="sm" onClick={handleSave} disabled={busy || !value.trim()}>
        Save
      </Button>
      {masked && (
        <Button size="sm" variant="outline" onClick={handleRemove} disabled={busy}>
          Remove
        </Button>
      )}
    </div>
  );
}
