"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NouveauPostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleFr: "Nouvel article",
          titleEn: "New article",
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/connexion");
          return;
        }
        throw new Error("Create failed");
      }
      const post = await res.json();
      router.push(`/editeur/${post.id}`);
    } catch {
      setError("Impossible de créer l'article");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-semibold">Nouvel article</h1>
      <p className="mt-2 text-sm text-[#495867]">
        Un brouillon sera créé et ouvert dans l&apos;éditeur.
      </p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={create}
        disabled={loading}
        className="mt-6 rounded-md bg-[#495867] px-6 py-2.5 text-white hover:bg-[#3a4654] disabled:opacity-50"
      >
        {loading ? "Création…" : "Créer le brouillon"}
      </button>
    </div>
  );
}
