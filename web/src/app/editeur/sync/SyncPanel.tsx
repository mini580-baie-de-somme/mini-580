"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Summary = {
  id: string;
  slug: string;
  titleFr: string;
  status: string;
  updatedAt: string;
};

type StatusPayload = {
  configured: boolean;
  env?: string;
  message?: string;
  error?: string;
  onlyLocal?: Summary[];
  onlyPeer?: Summary[];
  both?: { local: Summary; peer: Summary; diverged: boolean }[];
  counts?: {
    local: number;
    peer: number;
    onlyLocal: number;
    onlyPeer: number;
    both: number;
  };
};

export function SyncPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Status failed");
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(
    label: string,
    fn: () => Promise<Response>
  ) {
    setBusy(label);
    setMessage(null);
    setError(null);
    try {
      const res = await fn();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? label);
      setMessage(JSON.stringify(data, null, 2));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  const isTest = status?.env === "test";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0D131A]">
            Synchronisation TEST ↔ PROD
          </h1>
          <p className="mt-1 text-sm text-[#495867]">
            Environnement actuel :{" "}
            <strong>{status?.env ?? "…"}</strong>
            {status?.configured === false && " — sync non configuré"}
          </p>
        </div>
        <Link
          href="/editeur"
          className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm text-[#495867]"
        >
          ← Éditeur
        </Link>
      </div>

      {loading && <p className="text-sm text-[#495867]">Chargement…</p>}
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}
      {message && (
        <pre className="overflow-auto rounded-md bg-[#f4f7fa] p-4 text-xs text-[#0D131A]">
          {message}
        </pre>
      )}

      {status?.configured && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isTest && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  run("pull-posts", () =>
                    fetch("/api/sync/pull-from-prod", { method: "POST" })
                  )
                }
                className="rounded-md bg-[#495867] px-4 py-3 text-left text-sm text-white hover:bg-[#3a4654] disabled:opacity-50"
              >
                <div className="font-medium">Tirer articles depuis PROD</div>
                <div className="mt-1 text-xs opacity-80">
                  Écrase les IDs communs · conserve les posts TEST-only
                </div>
              </button>
            )}
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                run("pull-catalog", () =>
                  fetch("/api/sync/catalog", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ direction: "pull" }),
                  })
                )
              }
              className="rounded-md border border-[#d4dde6] bg-white px-4 py-3 text-left text-sm hover:bg-[#f4f7fa] disabled:opacity-50"
            >
              <div className="font-medium">Tirer catalogue (peer → ici)</div>
              <div className="mt-1 text-xs text-[#495867]">
                Tags · Thèmes · Jalons timeline
              </div>
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                run("push-catalog", () =>
                  fetch("/api/sync/catalog", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ direction: "push" }),
                  })
                )
              }
              className="rounded-md border border-[#d4dde6] bg-white px-4 py-3 text-left text-sm hover:bg-[#f4f7fa] disabled:opacity-50"
            >
              <div className="font-medium">Pousser catalogue (ici → peer)</div>
              <div className="mt-1 text-xs text-[#495867]">
                Tags · Thèmes · Jalons timeline
              </div>
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void refresh()}
              className="rounded-md border border-[#d4dde6] bg-white px-4 py-3 text-left text-sm hover:bg-[#f4f7fa] disabled:opacity-50"
            >
              <div className="font-medium">Rafraîchir le statut</div>
              <div className="mt-1 text-xs text-[#495867]">
                {busy ? `En cours : ${busy}` : "Comparer TEST / PROD"}
              </div>
            </button>
          </section>

          {status.counts && (
            <p className="text-sm text-[#495867]">
              Local {status.counts.local} · Peer {status.counts.peer} · Communs{" "}
              {status.counts.both} · Seulement ici {status.counts.onlyLocal} ·
              Seulement peer {status.counts.onlyPeer}
            </p>
          )}

          {isTest && (status.onlyLocal?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-[#0D131A]">
                Sur TEST seulement — publier sur PROD
              </h2>
              <ul className="divide-y divide-[#eef3f7] overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
                {status.onlyLocal!.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <Link
                        href={`/editeur/${p.id}`}
                        className="font-medium text-[#0D131A] hover:text-[#495867]"
                      >
                        {p.titleFr}
                      </Link>
                      <div className="text-xs text-[#495867]">
                        {p.status} · {p.slug}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        run(`publish-${p.id}`, () =>
                          fetch("/api/sync/publish-to-prod", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ postId: p.id, publish: true }),
                          })
                        )
                      }
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      Publier sur PROD
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(status.both?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-[#0D131A]">
                Articles communs (même id)
              </h2>
              <ul className="divide-y divide-[#eef3f7] overflow-hidden rounded-lg border border-[#d4dde6] bg-white text-sm">
                {status.both!.map(({ local, peer, diverged }) => (
                  <li key={local.id} className="px-4 py-3">
                    <span className="font-medium">{local.titleFr}</span>
                    {diverged && (
                      <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        divergé
                      </span>
                    )}
                    <div className="mt-1 text-xs text-[#495867]">
                      local {new Date(local.updatedAt).toLocaleString("fr-FR")} ·
                      peer {new Date(peer.updatedAt).toLocaleString("fr-FR")}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
