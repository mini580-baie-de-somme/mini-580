"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function NouveauPostPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function create() {
      try {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/connexion");
            return;
          }
          throw new Error("Create failed");
        }
        const post = await res.json();
        router.replace(`/editeur/${post.id}`);
      } catch {
        setError("Impossible de créer l'article");
      }
    }

    void create();
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-semibold">Nouvel article</h1>
      <p className="mt-2 text-sm text-[#495867]">
        Création du brouillon en base…
      </p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
