import bcrypt from "bcrypt";
import { PostStatus, Hull } from "../web/src/generated/prisma/client";
import { createPrismaClient } from "../web/src/lib/prisma-client";
import { classMilestones } from "./seed-data/milestones";

const prisma = createPrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@classmini580.blog";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, name: "Admin Class Mini 5.80" },
    create: {
      email: adminEmail,
      name: "Admin Class Mini 5.80",
      passwordHash,
    },
  });

  const themes = [
    { slug: "fournisseurs", labelFr: "Fournisseurs", labelEn: "Suppliers" },
    { slug: "chantier", labelFr: "Chantier", labelEn: "Workshop" },
    { slug: "3d", labelFr: "Modélisation 3D", labelEn: "3D modeling" },
    { slug: "course", labelFr: "Course", labelEn: "Racing" },
  ];

  for (const t of themes) {
    await prisma.theme.upsert({
      where: { slug: t.slug },
      update: t,
      create: t,
    });
  }

  const themeMap = Object.fromEntries(
    (await prisma.theme.findMany()).map((t) => [t.slug, t.id])
  );

  const tags = [
    { name: "onshape", labelFr: "Onshape", labelEn: "Onshape" },
    { name: "okoume", labelFr: "Okoumé", labelEn: "Okoume plywood" },
    { name: "epoxy", labelFr: "Époxy", labelEn: "Epoxy" },
    { name: "equipe", labelFr: "Équipe", labelEn: "Team" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: tag,
      create: tag,
    });
  }

  const tagMap = Object.fromEntries(
    (await prisma.tag.findMany()).map((t) => [t.name, t.id])
  );

  for (const m of classMilestones) {
    await prisma.milestone.upsert({
      where: { slug: m.slug },
      update: m,
      create: m,
    });
  }

  const milestoneMap = Object.fromEntries(
    (await prisma.milestone.findMany()).map((m) => [m.slug, m.id])
  );

  const posts = [
    {
      slug: "presentation-des-protagonistes",
      titleFr: "Les personnages / About us",
      titleEn: "Meet the crew / About us",
      excerptFr:
        "Origine du projet, présentation de Laurent, Marco et Rodolphe — 25 ans d'amitié et trois coques.",
      excerptEn:
        "Project origin, meet Laurent, Marco and Rodolphe — 25 years of friendship and three hulls.",
      bodyFr: `Tout a commencé en janvier 2025, devant une vidéo YouTube sur les Mini 5.80. Laurent, Marco et Rodolphe — amis depuis 25 ans, kitesurf et swing manouche — décident de construire non pas un, mais trois bateaux : un Mini 5.80 est tout simplement trop petit pour naviguer à trois.

Laurent (#268), professeur de conception mécanique, prend en charge la modélisation 3D sur Onshape et la construction (congé de six mois validé dès février 2026). Marco (#269), ex-commerce, s'occupe du sourcing et de la logistique — et apprend à naviguer en cours de route. Rodolphe (#270), également professeur, programme la découpe CNC.

Les numéros de coque 268, 269 et 270 sont attribués. Le blog « Les vieux fourneaux » est enregistré sur le site officiel Class Globe 5.80. La transparence, l'humour et l'honnêteté guideront la documentation de ce chantier.`,
      bodyEn: `It all started in January 2025, watching a YouTube video about Mini 5.80 boats. Laurent, Marco and Rodolphe — friends for 25 years, into kitesurfing and gypsy swing — decided to build not one but three boats: a Mini 5.80 is simply too small to sail with three people.

Laurent (#268), mechanical design teacher, handles 3D modeling in Onshape and construction (six-month sabbatical from February 2026). Marco (#269), former sales, manages sourcing and logistics — and learns to sail along the way. Rodolphe (#270), also a teacher, programs the CNC cutting.

Hull numbers 268, 269 and 270 are assigned. The "Old Stoves" blog is registered on the official Class Globe 5.80 website. Transparency, humor and honesty will guide this build documentation.`,
      publishedAt: new Date("2026-03-25"),
      hulls: [Hull.HULL_268, Hull.HULL_269, Hull.HULL_270],
      themeSlugs: ["chantier"],
      tagNames: ["equipe"],
      milestoneSlug: "team-roles-defined",
    },
    {
      slug: "preparation-du-chantier",
      titleFr: "Préparation du chantier",
      titleEn: "Workshop setup",
      excerptFr:
        "Congé Laurent, rôles définis, premières courbes Onshape et découverte de Class Mini 5.80 Baie de Somme.",
      excerptEn:
        "Laurent's sabbatical, defined roles, first Onshape curves and discovering Class Mini 5.80 Baie de Somme.",
      bodyFr: `Février 2026 : le congé de Laurent est validé — six mois à temps plein sur le chantier. Les rôles sont clairs : Marco source les matériaux, Laurent modélise en 3D sur Onshape, Rodolphe prépare les programmes CNC.

Les premières captures 3D montrent les courbes et surfaces de coque et de pont. C'est enthousiasmant de voir le bateau prendre forme virtuellement avant la première plaque de contreplaqué.

La commande Allin est passée : 80 plaques de 10 mm okoumé marine (2500×1220 mm), livraison prévue fin 2025. Et puis la découverte de Class Mini 5.80 Baie de Somme — une grange de 250 m² mise à disposition par les voisins de Marco, près de Saint-Valéry-sur-Somme. Class Mini 5.80 Baie de Somme a trouvé son port d'attache.`,
      bodyEn: `February 2026: Laurent's sabbatical is confirmed — six months full-time at the workshop. Roles are clear: Marco sources materials, Laurent models in 3D on Onshape, Rodolphe prepares CNC programs.

First 3D screenshots show hull and deck curves and surfaces. It's exciting to see the boat take shape virtually before the first plywood sheet.

The Allin order is placed: 80 sheets of 10 mm marine okoume (2500×1220 mm), delivery expected late 2025. Then comes the discovery of Class Mini 5.80 Baie de Somme — a 250 m² barn offered by Marco's neighbors near Saint-Valéry-sur-Somme. Class Mini 5.80 Baie de Somme has found its home.`,
      publishedAt: new Date("2026-03-28"),
      hulls: [Hull.HULL_268, Hull.HULL_269, Hull.HULL_270],
      themeSlugs: ["chantier", "3d"],
      tagNames: ["onshape", "okoume"],
      milestoneSlug: "workshop-found",
      coverImageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80",
    },
    {
      slug: "choix-des-fournisseurs",
      titleFr: "Choix des fournisseurs",
      titleEn: "Choosing suppliers",
      excerptFr:
        "Sicomin, Les Inoxydables, Allin — et la leçon des 9 mm vs 10 mm okoumé.",
      excerptEn:
        "Sicomin, Les Inoxydables, Allin — and the 9 mm vs 10 mm okoume lesson.",
      bodyFr: `Avec le modèle 3D Onshape, nous calculons les quantités d'époxy et de fibres chez Sicomin — résines, stratification, tout est dimensionné numériquement.

Les Inoxydables fourniront environ 9 000 vis inox A4 316L (4×30 mm). Un chiffre qui fait réfléchir quand on voit les palettes arriver.

Pour le contreplaqué, Allin produit nos 80 plaques en okoumé 10 mm. Anecdote importante : nous avions commandé du 9 mm, mais Allin ne peut produire que du 10 mm. Après validation de l'architecte Janusz Maderski, la solution 10 mm okoumé + stratification 1000 g/m² est conforme aux plans. Le 9 mm okoumé initialement commandé n'était pas conforme (sapelli 9 mm requis selon les préconisations).

Leçon retenue : toujours vérifier la conformité aux plans avant de commander. La transparence inclut aussi nos erreurs.`,
      bodyEn: `With the Onshape 3D model, we calculate epoxy and fiber quantities from Sicomin — resins, laminates, everything is sized digitally.

Les Inoxydables will supply about 9,000 A4 316L stainless screws (4×30 mm). A number that makes you think when the pallets arrive.

For plywood, Allin produces our 80 sheets in 10 mm okoume. Important anecdote: we had ordered 9 mm, but Allin can only produce 10 mm. After architect Janusz Maderski's approval, the 10 mm okoume + 1000 g/m² lamination solution complies with the plans. The initially ordered 9 mm okoume was not compliant (9 mm sapelli required per specifications).

Lesson learned: always verify plan compliance before ordering. Transparency includes our mistakes too.`,
      publishedAt: new Date("2026-05-03"),
      hulls: [Hull.HULL_268, Hull.HULL_269, Hull.HULL_270],
      themeSlugs: ["fournisseurs"],
      tagNames: ["okoume", "epoxy"],
      milestoneSlug: "suppliers-chosen",
    },
  ];

  for (const p of posts) {
    const post = await prisma.post.upsert({
      where: { slug: p.slug },
      update: {
        titleFr: p.titleFr,
        titleEn: p.titleEn,
        excerptFr: p.excerptFr,
        excerptEn: p.excerptEn,
        bodyFr: p.bodyFr,
        bodyEn: p.bodyEn,
        status: PostStatus.PUBLISHED,
        publishedAt: p.publishedAt,
        coverImageUrl: p.coverImageUrl ?? null,
        authorId: admin.id,
      },
      create: {
        slug: p.slug,
        titleFr: p.titleFr,
        titleEn: p.titleEn,
        excerptFr: p.excerptFr,
        excerptEn: p.excerptEn,
        bodyFr: p.bodyFr,
        bodyEn: p.bodyEn,
        status: PostStatus.PUBLISHED,
        publishedAt: p.publishedAt,
        coverImageUrl: p.coverImageUrl ?? null,
        authorId: admin.id,
      },
    });

    await prisma.postHull.deleteMany({ where: { postId: post.id } });
    await prisma.postHull.createMany({
      data: p.hulls.map((hull) => ({ postId: post.id, hull })),
    });

    await prisma.postTheme.deleteMany({ where: { postId: post.id } });
    await prisma.postTheme.createMany({
      data: p.themeSlugs.map((slug) => ({
        postId: post.id,
        themeId: themeMap[slug],
      })),
    });

    await prisma.postTag.deleteMany({ where: { postId: post.id } });
    await prisma.postTag.createMany({
      data: p.tagNames.map((name) => ({
        postId: post.id,
        tagId: tagMap[name],
      })),
    });

    if (p.milestoneSlug) {
      await prisma.postMilestone.deleteMany({ where: { postId: post.id } });
      await prisma.postMilestone.create({
        data: {
          postId: post.id,
          milestoneId: milestoneMap[p.milestoneSlug],
        },
      });
    }
  }

  console.log("Seed complete:");
  console.log(`  Admin: ${adminEmail}`);
  console.log(`  Posts: ${posts.length}`);
  console.log(`  Milestones: ${classMilestones.length}`);
  console.log(`  Themes: ${themes.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
