/**
 * Import the 3 Blogger articles as DRAFT posts (ready for editorial review).
 *
 * Usage (from repo root, with DATABASE_URL set):
 *   node scripts/import-blogger-drafts.mjs
 *
 * On VPS TEST:
 *   docker run --rm --network mini580_test \
 *     -e DATABASE_URL='postgresql://mini580:PASS@db:5432/mini580_test' \
 *     -v "$PWD/scripts:/scripts" -w /scripts \
 *     node:22-bookworm-slim bash -c "npm i pg bcrypt && node import-blogger-drafts.mjs"
 */
import pg from "pg";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";

function cuidish() {
  return "c" + randomBytes(12).toString("hex");
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@classmini580.blog";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "changeme123";

const IMG_COURBES =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgjWsVeM2KZesGz1FkLccIQQzx3yrfP1BJv0sxTTJ1wKrssJ1BWqsJ67mwrzeH7rr_FuHLsRPgmgk0TqQ9K9-Q2InTYzvtWvUdRlBiOWdR10HxmLBBRmcEY9VshxUx1SZ-tpGUtxKQWRAX7Oa3NpB8GZWjwki0enhED38egsujsf7JOCt7CGKxIu7bJJYDS/s1600/Onshape%20courbes.png";
const IMG_SURFACES =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgjNInSel08jgQ0cWFFCwxHhcGOh-sA-luB-8TT5rovzXvdLy5psWEOLy4Uo9H12lHi5uYuYuZeYuRtxGFlcecAqJ_ryxdwv9O2Sny972rinU0aMiMyNFJoLy4az422NU1tsyeAGxNaQ9QGxPXhyOZqPtzYEt5uHEr0PxaMK9VyI1b1s_QuRPYoP4-_aT81/s1600/Onshape%20surfaces.png";

const posts = [
  {
    slug: "presentation-des-protagonistes",
    titleFr: "Les personnages",
    titleEn: "About us",
    excerptFr:
      "Tout a commencé en janvier 2025 avec une vidéo YouTube sur les Mini 5.80 — et l'idée de construire non pas un, mais trois bateaux.",
    excerptEn:
      "It all started in January 2025 with a YouTube video about the Mini 5.80 — and the idea to build not one but three boats.",
    bodyFr: `Tout a commencé en janvier 2025, avec une excellente idée… ou une très mauvaise, on hésite encore. Une vidéo YouTube sur les Mini 5.80, partagée presque par hasard. Puis cette phrase, lancée sans trop y croire : « et si on construisait un bateau ? »

En temps normal, ça s'arrête là. Pas chez nous.

Nous sommes trois copains, amis depuis 25 ans. On partage déjà pas mal de choses : beaucoup de kitesurf, et aussi la section rythmique d'un groupe de swing manouche. Autant dire qu'on a un certain sens de la cohésion — ce qui, espérons-le, aidera aussi avec la colle et les serre-joints.

Côté navigation, c'est une autre histoire. Rodolphe et Laurent ont bien un voilier depuis quelques années, mais sans prétendre maîtriser grand-chose. Et Marco, au moment de cette brillante idée, ne savait tout simplement pas naviguer. Depuis, il a acheté un bateau — preuve que le projet commence à avoir des effets secondaires.

Et comme le Mini 5.80 est trop petit pour naviguer à trois… ben… on va en faire trois. Logique, non ?

Il nous reste encore quelques détails à régler — acheter les plans, trouver un atelier.

Aujourd'hui, l'aventure est lancée. Laurent a pris six mois pour démarrer le chantier, Rodolphe passera filer un coup de main quand il pourra, et Marco apprend à naviguer entre deux étapes de construction.

Tout est sous contrôle. Enfin, on croit.

— Source Blogger : 25 mars 2026 · Les vieux fourneaux · coques #268 #269 #270`,
    bodyEn: `It all started in January 2025, with a great idea… or a terrible one — we're still not sure. A YouTube video about the Mini 5.80, shared almost by accident. Then this sentence, thrown out half-jokingly: “what if we built a boat?”

Normally, that's where it ends. Not with us.

We're three friends who've known each other for 25 years. We already share quite a lot: plenty of kitesurfing, and we also make up the rhythm section of a gypsy swing band. So yes, we do have a certain sense of timing and teamwork — which will hopefully come in handy with glue and clamps too.

As for sailing… that's a different story. Rodolphe and Laurent have had a sailboat for a few years, but without claiming to have mastered much. And Marco, at the time of this brilliant idea, simply didn't know how to sail. Since then, he's bought a boat — proof that the project is already having side effects.

And since a Mini 5.80 is a bit too small for three people to sail together… well… we'll just build three. Makes sense, right?

There are still a few minor details to sort out — like buying the plans and finding a workshop.

But the adventure has officially begun. Laurent has taken six months off to kick things off, Rodolphe will lend a hand whenever he can, and Marco is learning to sail in between building sessions.

Everything is under control. At least, we think so.

— Source Blogger: 25 March 2026 · Les vieux fourneaux · hulls #268 #269 #270`,
    originalDate: "2026-03-25",
    themeSlugs: ["chantier"],
    tagNames: ["equipe"],
    hulls: ["HULL_268", "HULL_269", "HULL_270"],
    coverImageUrl: null,
    images: [],
  },
  {
    slug: "preparation-du-chantier",
    titleFr: "Préparation du chantier",
    titleEn: "Workshop setup",
    excerptFr:
      "Congé Laurent, rôles, premières courbes Onshape, commande Allin et découverte de la grange CNBS (250 m²).",
    excerptEn:
      "Laurent's leave, roles, first Onshape curves, Allin order and discovering the CNBS barn (250 m²).",
    bodyFr: `À ce stade, le projet est encore… un projet. Nous sommes fin mars, les plans viennent tout juste d'arriver, et pour l'instant, on est surtout dans l'organisation — avec un mélange d'excitation et de « bon, par où on commence ? ».

Premier point clé : le temps. Laurent a posé un congé de six mois pour lancer sérieusement le chantier. On attend encore la réponse, mais si tout se passe bien, il devrait être disponible à partir du 1er février 2026. Autant dire que ça conditionne pas mal la suite.

En attendant, on s'organise. Répartition des rôles, assez naturelle finalement.

Marco, qui était dans le commerce, prend en charge le sourcing. Sa mission : trouver le contreplaqué marine certifié Lloyd's, conforme aux spécifications de l'architecte, et dénicher un atelier capable d'accueillir le chantier.

Laurent, prof de conception mécanique, s'attaque de son côté à la modélisation 3D sur Onshape. À partir du plan des formes de la liasse, il commence à reconstruire la géométrie générale de la coque et du pont. Un travail précis, pas toujours spectaculaire, mais essentiel pour bien comprendre les volumes et préparer la fabrication. Petit à petit, les lignes du bateau apparaissent à l'écran.

De son côté, Rodolphe, prof de conception mécanique également, se positionne déjà sur la suite : à partir de ces modèles 3D, il développera les programmes nécessaires pour piloter la CNC et découper à la fois le contreplaqué et le Douglas massif pour les pièces structurelles.

Les bonnes nouvelles :

Laurent a obtenu son congé. On y va !

Après avoir contacté à peu près tous les fabricants et revendeurs français, comparé les options et relancé quelques interlocuteurs, Marco a trouvé une piste sérieuse pour le CP. Le choix se porte sur Allin, un fabricant français qui nous propose un tarif raisonnable (pour un volume conséquent). On commande 80 plaques de 10 mm en tout okoumé (leur gamme Marine +) pour une livraison prévue début décembre 2025.

Et puis il y a LA super nouvelle : les voisins de Marco ont très gentiment accepté de nous mettre à disposition la grange de 250 m² qui se trouve au bout de son jardin. Autant dire qu'on ne rêvait pas mieux. Le projet a désormais un vrai point d'ancrage — entre nous on l'appelle déjà : le CNBS (Chantier Naval de la Baie de Somme).

Pour l'instant, rien n'est encore construit, mais tout commence à s'aligner. Le bois est en route, l'atelier est trouvé, et même une première coque virtuelle prend forme. Le projet quitte doucement le papier pour entrer dans le réel.

— Source Blogger : 28 mars 2026 · Les vieux fourneaux`,
    bodyEn: `At this stage, the project is still… just a project. It's the end of March, the plans have just arrived, and for now we're mostly in the organization phase — with a mix of excitement and “so… where do we start?”

First key point: time. Laurent has applied for a six-month leave to properly kick off the build. We're still waiting for confirmation, but if all goes well, he should be available starting February 1st, 2026. Needless to say, that has a big impact on what comes next.

In the meantime, we're getting organized. The roles have been divided up quite naturally.

Marco, who comes from a commercial background, is in charge of sourcing. His mission: find Lloyd's-certified marine plywood that meets the designer's specifications, and secure a workshop to host the build.

Laurent, a mechanical design teacher, is focusing on the 3D modeling in Onshape. Using the lines plan from the drawings, he's starting to rebuild the overall geometry of the hull and deck. It's precise work, not always the most spectacular, but essential to fully understand the shapes and prepare for the build. Little by little, the boat's lines are taking shape on the screen.

On his side, Rodolphe, also a mechanical design teacher, is already looking ahead. Based on the 3D models, he will develop the programs needed to run the CNC and cut both the plywood and the solid Douglas for the structural parts.

The good news:

Laurent got his leave approved. We're on!

After contacting pretty much every manufacturer and supplier in France, comparing options and following up with a few leads, Marco found a solid solution for the plywood. The choice goes to Allin, a French manufacturer offering us a reasonable price (for a significant volume). We've ordered 80 sheets of 10 mm okoumé (their Marine+ range), with delivery expected in early December 2025.

And then there's the BIG news: Marco's neighbors have very kindly agreed to let us use the 250 m² barn at the end of his garden. Honestly, we couldn't have hoped for better. The project now has a real home — we're already calling it the CNBS (Chantier Naval de la Baie de Somme).

For now, nothing has been built yet, but everything is starting to come together. The wood is on its way, the workshop is secured, and even a first virtual hull is taking shape. The project is slowly moving from paper into reality.

— Source Blogger: 28 March 2026 · Les vieux fourneaux`,
    originalDate: "2026-03-28",
    themeSlugs: ["chantier", "3d"],
    tagNames: ["onshape", "okoume"],
    hulls: ["HULL_268", "HULL_269", "HULL_270"],
    coverImageUrl: IMG_COURBES,
    images: [
      { url: IMG_COURBES, captionFr: "Premières courbes Onshape", captionEn: "First Onshape curves", sortOrder: 0 },
      { url: IMG_SURFACES, captionFr: "Premières surfaces Onshape", captionEn: "First Onshape surfaces", sortOrder: 1 },
    ],
  },
  {
    slug: "choix-des-fournisseurs",
    titleFr: "Choix des fournisseurs",
    titleEn: "Choosing suppliers",
    excerptFr:
      "Sicomin, Les Inoxydables, Allin — et la leçon des 9 mm vs 10 mm okoumé validée par Janusz Maderski.",
    excerptEn:
      "Sicomin, Les Inoxydables, Allin — and the 9 mm vs 10 mm okoume lesson validated by Janusz Maderski.",
    bodyFr: `On est en mai : le chantier avance moins vite que ce qu'on voudrait, mais il avance.

À titre d'info pour ceux que ça intéresse, on vous fait une petite liste des fournisseurs. On a aucun intérêt commercial, on n'est pas sponsorisé (malheureusement) mais ça nous a pris beaucoup de temps de les choisir et si ça peut vous en faire économiser un peu…

Pour tout ce qui concerne le collage et la stratification, nous avons décidé de travailler avec Sicomin. Au-delà de la qualité reconnue de leurs produits, nous avons particulièrement apprécié les échanges avec leur service technique, qui s'est montré disponible, précis et de très bon conseil pour orienter nos choix. Grâce au travail de modélisation 3D, nous avons pu leur fournir des données assez précises : surfaces collées, surfaces imprégnées, surfaces stratifiées. À partir de là, ils ont pu nous proposer une liste complète des produits adaptés (résines, fibres, charges, consommables) ainsi que les quantités nécessaires. Nous serons livrés en deux temps au fil du projet : une première partie pour l'assemblage des structures et l'imprégnation, puis une seconde pour la stratification.

Côté visserie, direction Les Inoxydables. On part sur de l'inox A4 316L, histoire d'être tranquilles dans le temps. Au programme : environ 9 000 vis en 4×30 mm… plus quelques kilos de vis plus longues pour le reste. Dit comme ça, ça paraît anecdotique — on verra surtout ce que ça représente vraiment le jour où le colis arrivera.

Enfin, pour le contreplaqué, comme évoqué précédemment, notre choix s'est porté sur Allin. Et là, petite frayeur… qui se termine bien. Au départ, nous étions partis sur du 9 mm tout okoumé, une référence présente à leur catalogue. Une commande loin d'être anodine : 80 plaques de 2500 × 1220 mm. Sauf qu'après commande et règlement, Allin nous informe qu'ils ne pourront finalement produire que du 10 mm, probablement pour des questions de disponibilité des plis. Geste commercial appréciable : le 10 mm sera facturé au prix du 9 mm.

Sur le moment, on accepte… avant même de vérifier la compatibilité avec les plans. Petit moment de solitude. Après vérification et validation auprès de l'architecte, notre choix s'avère finalement cohérent : en 10 mm okoumé, avec une stratification de 1000 g/m², on compense l'utilisation de l'okoumé par rapport au sapelli (acajou), qui lui aurait été prescrit en 9 mm.

Et c'est là qu'on réalise notre erreur initiale : commander du 9 mm tout okoumé n'était en fait pas conforme aux préconisations. On est donc passés tout près de se retrouver avec 80 plaques inutilisables… comme quoi, parfois, un imprévu peut aussi être une très bonne nouvelle.

Rien de très spectaculaire à ce stade, mais ces décisions sont importantes. Ce sont elles qui vont nous accompagner tout au long du chantier — autant partir sur des bases solides.

— Source Blogger : 3 mai 2026 · Les vieux fourneaux`,
    bodyEn: `It's May now. The project is moving a bit slower than we would like… but it is moving forward.

For those who might be interested, here's a small list of the suppliers we chose. We have absolutely no commercial interest here, we're not sponsored (unfortunately), but it took us quite a while to find the right partners, so if it can save future builders a bit of time, even better.

For everything related to bonding and fiberglass work, we decided to work with Sicomin. Beyond the well-known quality of their products, we really appreciated the discussions with their technical team, who were available, precise, and genuinely helpful in guiding our choices. Thanks to the 3D modeling work, we were able to provide fairly accurate data: bonded surfaces, impregnated surfaces, laminated surfaces, etc. Based on that, they helped us build a complete list of suitable products (resins, fiberglass, fillers, consumables) along with the required quantities. Deliveries will happen in two stages throughout the build: first for structural assembly and wood sealing, then later for fiberglass lamination.

For fasteners, we went with Les Inoxydables. The plan is to use A4 316L stainless steel throughout, so hopefully we won't have to think about corrosion ever again. The shopping list includes around 9,000 screws in 4×30 mm… plus a few extra kilos of longer screws for everything else. Written like that, it doesn't sound like much — we'll probably understand it better once the package actually arrives.

Finally, for the plywood, as mentioned before, we chose Allin. And that part came with a small scare… that ended up turning out quite well.

Initially, we had ordered 9 mm full okoumé plywood, a standard reference in their catalog. Not exactly a small order: 80 sheets of 2500 × 1220 mm. But after the order had been placed and paid for, Allin informed us that they would only be able to manufacture 10 mm sheets, most likely due to veneer availability. Nice commercial gesture on their side: they offered the 10 mm at the same price as the 9 mm.

At first, we accepted… before actually checking whether it matched the designer's specifications. Slight moment of panic.

After reviewing the plans and getting confirmation from Janusz, it turns out the 10 mm okoumé with 1000 g/m² fiberglass sheathing is perfectly suitable, compensating for the use of okoumé instead of sapele (mahogany), which would normally have been used in 9 mm.

And that's when we realized our original mistake: ordering 9 mm full okoumé was actually not compliant with the recommendations in the first place.

So we came very close to ending up with 80 unusable plywood sheets… which proves that sometimes, unexpected problems can turn into very good news.

Nothing very spectacular at this stage, but these decisions matter. They're the foundations that will stay with us throughout the whole build — so we'd rather start on solid ground.

— Source Blogger: 3 May 2026 · Les vieux fourneaux`,
    originalDate: "2026-05-03",
    themeSlugs: ["fournisseurs"],
    tagNames: ["okoume", "epoxy"],
    hulls: ["HULL_268", "HULL_269", "HULL_270"],
    coverImageUrl: null,
    images: [],
  },
];

const themes = [
  { slug: "fournisseurs", labelFr: "Fournisseurs", labelEn: "Suppliers" },
  { slug: "chantier", labelFr: "Chantier", labelEn: "Workshop" },
  { slug: "3d", labelFr: "Modélisation 3D", labelEn: "3D modeling" },
  { slug: "course", labelFr: "Course", labelEn: "Racing" },
];

const tags = [
  { name: "onshape", labelFr: "Onshape", labelEn: "Onshape" },
  { name: "okoume", labelFr: "Okoumé", labelEn: "Okoume plywood" },
  { name: "epoxy", labelFr: "Époxy", labelEn: "Epoxy" },
  { name: "equipe", labelFr: "Équipe", labelEn: "Team" },
  { name: "blogger", labelFr: "Migré Blogger", labelEn: "Migrated from Blogger" },
];

async function upsertTheme(client, t) {
  const existing = await client.query(`SELECT id FROM "Theme" WHERE slug = $1`, [t.slug]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE "Theme" SET "labelFr" = $2, "labelEn" = $3 WHERE slug = $1`,
      [t.slug, t.labelFr, t.labelEn]
    );
    return existing.rows[0].id;
  }
  const id = cuidish();
  await client.query(
    `INSERT INTO "Theme" (id, slug, "labelFr", "labelEn") VALUES ($1, $2, $3, $4)`,
    [id, t.slug, t.labelFr, t.labelEn]
  );
  return id;
}

async function upsertTag(client, t) {
  const existing = await client.query(`SELECT id FROM "Tag" WHERE name = $1`, [t.name]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE "Tag" SET "labelFr" = $2, "labelEn" = $3 WHERE name = $1`,
      [t.name, t.labelFr, t.labelEn]
    );
    return existing.rows[0].id;
  }
  const id = cuidish();
  await client.query(
    `INSERT INTO "Tag" (id, name, "labelFr", "labelEn", "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
    [id, t.name, t.labelFr, t.labelEn]
  );
  return id;
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    let adminId;
    const adminRes = await client.query(`SELECT id FROM "User" WHERE email = $1`, [ADMIN_EMAIL]);
    if (adminRes.rows[0]) {
      adminId = adminRes.rows[0].id;
      await client.query(
        `UPDATE "User" SET "passwordHash" = $2, name = $3 WHERE id = $1`,
        [adminId, passwordHash, "Admin Class Mini 5.80"]
      );
    } else {
      adminId = cuidish();
      await client.query(
        `INSERT INTO "User" (id, email, name, "passwordHash", "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
        [adminId, ADMIN_EMAIL, "Admin Class Mini 5.80", passwordHash]
      );
    }

    const themeMap = {};
    for (const t of themes) themeMap[t.slug] = await upsertTheme(client, t);

    const tagMap = {};
    for (const t of tags) tagMap[t.name] = await upsertTag(client, t);

    for (const p of posts) {
      const existing = await client.query(`SELECT id FROM "Post" WHERE slug = $1`, [p.slug]);
      let postId;
      if (existing.rows[0]) {
        postId = existing.rows[0].id;
        await client.query(
          `UPDATE "Post" SET
            "titleFr" = $2, "titleEn" = $3,
            "excerptFr" = $4, "excerptEn" = $5,
            "bodyFr" = $6, "bodyEn" = $7,
            status = 'DRAFT', "publishedAt" = NULL,
            "coverImageUrl" = $8, "authorId" = $9, "updatedAt" = NOW()
           WHERE id = $1`,
          [
            postId,
            p.titleFr,
            p.titleEn,
            p.excerptFr,
            p.excerptEn,
            p.bodyFr,
            p.bodyEn,
            p.coverImageUrl,
            adminId,
          ]
        );
      } else {
        postId = cuidish();
        await client.query(
          `INSERT INTO "Post" (
            id, slug, "titleFr", "titleEn", "excerptFr", "excerptEn",
            "bodyFr", "bodyEn", status, "authorId", "coverImageUrl",
            "publishedAt", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', $9, $10, NULL, $11::timestamptz, NOW()
          )`,
          [
            postId,
            p.slug,
            p.titleFr,
            p.titleEn,
            p.excerptFr,
            p.excerptEn,
            p.bodyFr,
            p.bodyEn,
            adminId,
            p.coverImageUrl,
            p.originalDate,
          ]
        );
      }

      await client.query(`DELETE FROM "PostHull" WHERE "postId" = $1`, [postId]);
      for (const hull of p.hulls) {
        await client.query(`INSERT INTO "PostHull" ("postId", hull) VALUES ($1, $2)`, [
          postId,
          hull,
        ]);
      }

      await client.query(`DELETE FROM "PostTheme" WHERE "postId" = $1`, [postId]);
      for (const slug of p.themeSlugs) {
        await client.query(
          `INSERT INTO "PostTheme" ("postId", "themeId") VALUES ($1, $2)`,
          [postId, themeMap[slug]]
        );
      }

      const allTags = [...p.tagNames, "blogger"];
      await client.query(`DELETE FROM "PostTag" WHERE "postId" = $1`, [postId]);
      for (const name of allTags) {
        await client.query(`INSERT INTO "PostTag" ("postId", "tagId") VALUES ($1, $2)`, [
          postId,
          tagMap[name],
        ]);
      }

      await client.query(`DELETE FROM "PostImage" WHERE "postId" = $1`, [postId]);
      for (const img of p.images) {
        await client.query(
          `INSERT INTO "PostImage" (id, "postId", url, "captionFr", "captionEn", "sortOrder")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [cuidish(), postId, img.url, img.captionFr, img.captionEn, img.sortOrder]
        );
      }

      console.log(`✓ DRAFT ${p.slug}`);
    }

    await client.query("COMMIT");
    console.log("\nImport complete — 3 Blogger posts as DRAFT.");
    console.log(`Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log("Review at /editeur then publish when ready.");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
