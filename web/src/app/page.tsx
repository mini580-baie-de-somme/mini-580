import Link from "next/link";
import { PostStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { postInclude } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { CLASS_GLOBE_LINKS } from "@/lib/constants";

const team = [
  {
    name: "Laurent",
    hull: "#268",
    role: "Modélisation 3D (Onshape), construction",
    detail: "Professeur de conception mécanique — congé 6 mois dès fév. 2026",
  },
  {
    name: "Marco",
    hull: "#269",
    role: "Sourcing matériaux, logistique",
    detail: "Ex-commerce — a appris à naviguer pour le projet",
  },
  {
    name: "Rodolphe",
    hull: "#270",
    role: "Programmation CNC, découpe CP",
    detail: "Professeur de conception mécanique",
  },
];

export default async function HomePage() {
  const latestPosts = await prisma.post.findMany({
    where: { status: PostStatus.PUBLISHED },
    include: postInclude,
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  return (
    <>
      <section className="hero-gradient border-b border-[#d4dde6]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-[#495867]">
            Chantier Naval de la Baie de Somme
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-[#0D131A] sm:text-5xl">
            Trois Class Globe 5.80 — coques #268, #269 et #270
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[#495867]">
            Les vieux fourneaux documentent la construction de trois voiliers de course
            océanique en contreplaqué époxy, depuis la Baie de Somme. Blog bilingue FR/EN,
            transparent et un peu swing manouche.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/blog"
              className="rounded-md bg-[#495867] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3a4654]"
            >
              Lire le blog
            </Link>
            <Link
              href="/timeline"
              className="rounded-md border border-[#495867] px-5 py-2.5 text-sm font-medium text-[#495867] hover:bg-white/60"
            >
              Timeline chantier
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-[#0D131A]">L&apos;équipe</h2>
        <p className="mt-2 max-w-2xl text-[#495867]">
          Amis depuis 25 ans — kitesurf, swing manouche — ils construisent trois bateaux car
          un Mini 5.80 est trop petit pour naviguer à trois.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {team.map((member) => (
            <div
              key={member.hull}
              className="rounded-lg border border-[#d4dde6] bg-white p-6 shadow-sm"
            >
              <span className="inline-block rounded bg-[#495867] px-2 py-0.5 text-xs font-bold text-white">
                {member.hull}
              </span>
              <h3 className="mt-3 text-lg font-semibold">{member.name}</h3>
              <p className="mt-1 text-sm font-medium text-[#495867]">{member.role}</p>
              <p className="mt-2 text-sm text-[#495867]/80">{member.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#d4dde6] bg-[#f4f7fa]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-[#0D131A]">Le chantier CNBS</h2>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div>
              <p className="text-[#495867] leading-relaxed">
                Atelier de 250 m² dans une grange près de Saint-Valéry-sur-Somme. Construction
                depuis les plans officiels Janusz Maderski, découpe CNC maison, modélisation 3D
                complète sur Onshape.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[#495867]">
                <li>• 80 plaques okoumé 10 mm (Allin)</li>
                <li>• Époxy Sicomin — quantités calculées en 3D</li>
                <li>• ~9 000 vis inox A4 316L (Les Inoxydables)</li>
              </ul>
            </div>
            <div className="rounded-lg border border-[#d4dde6] bg-white p-6">
              <h3 className="font-semibold">Class Globe 5.80</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href={CLASS_GLOBE_LINKS.website} className="text-[#495867] hover:underline" target="_blank" rel="noopener noreferrer">
                    Site officiel →
                  </a>
                </li>
                <li>
                  <a href={CLASS_GLOBE_LINKS.builders} className="text-[#495867] hover:underline" target="_blank" rel="noopener noreferrer">
                    Blogs constructeurs →
                  </a>
                </li>
                <li>
                  <a href={CLASS_GLOBE_LINKS.transat} className="text-[#495867] hover:underline" target="_blank" rel="noopener noreferrer">
                    Globe 5.80 Transat →
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {latestPosts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold text-[#0D131A]">Derniers articles</h2>
            <Link href="/blog" className="text-sm text-[#495867] hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
