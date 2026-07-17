/**
 * Class Mini 5.80 Baie de Somme — timeline milestones (FR/EN).
 * Pré-chantier (sortOrder 0–9) + mandatory Class Globe build steps (10–21).
 * Source: classglobe580.com builders blog checklist + project blog content.
 */
export type MilestoneSeed = {
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  milestoneDate: Date;
  sortOrder: number;
};

export const classMilestones: MilestoneSeed[] = [
  {
    slug: "project-start",
    titleFr: "Lancement du projet",
    titleEn: "Project launch",
    descriptionFr: "Janvier 2025 — décision de construire trois Class Globe 5.80.",
    descriptionEn: "January 2025 — decision to build three Class Globe 5.80 boats.",
    milestoneDate: new Date("2025-01-15"),
    sortOrder: 0,
  },
  {
    slug: "workshop-found",
    titleFr: "Atelier Class Mini 5.80 Baie de Somme trouvé",
    titleEn: "Class Mini 5.80 Baie de Somme workshop secured",
    descriptionFr: "Grange 250 m² — Baie de Somme.",
    descriptionEn: "250 m² barn workshop — Baie de Somme.",
    milestoneDate: new Date("2026-02-01"),
    sortOrder: 1,
  },
  {
    slug: "plans-purchased",
    titleFr: "Achat des plans officiels",
    titleEn: "Official plans purchased",
    descriptionFr:
      "Plans Class Globe 5.80 achetés — numéros de coque #268, #269 et #270 attribués.",
    descriptionEn:
      "Class Globe 5.80 plans purchased — hull numbers #268, #269 and #270 assigned.",
    milestoneDate: new Date("2025-02-01"),
    sortOrder: 2,
  },
  {
    slug: "builder-blog-registered",
    titleFr: "Blog constructeur enregistré",
    titleEn: "Builder blog registered",
    descriptionFr:
      "« Les vieux fourneaux » inscrit sur le site officiel classglobe580.com.",
    descriptionEn: '"Old Stoves" blog registered on the official classglobe580.com site.',
    milestoneDate: new Date("2025-03-01"),
    sortOrder: 3,
  },
  {
    slug: "team-roles-defined",
    titleFr: "Rôles de l'équipe définis",
    titleEn: "Team roles defined",
    descriptionFr:
      "Laurent (#268) modélisation 3D et construction · Marco (#269) sourcing · Rodolphe (#270) CNC.",
    descriptionEn:
      "Laurent (#268) 3D modeling and build · Marco (#269) sourcing · Rodolphe (#270) CNC.",
    milestoneDate: new Date("2025-06-01"),
    sortOrder: 4,
  },
  {
    slug: "sabbatical-confirmed",
    titleFr: "Congé Laurent validé",
    titleEn: "Laurent's sabbatical confirmed",
    descriptionFr: "Six mois à temps plein sur le chantier dès février 2026.",
    descriptionEn: "Six months full-time on the build from February 2026.",
    milestoneDate: new Date("2026-01-15"),
    sortOrder: 5,
  },
  {
    slug: "plywood-ordered",
    titleFr: "Commande contreplaqué",
    titleEn: "Plywood order placed",
    descriptionFr: "80 plaques 10 mm okoumé marine chez Allin (2500×1220 mm).",
    descriptionEn: "80 sheets of 10 mm marine okoume from Allin (2500×1220 mm).",
    milestoneDate: new Date("2025-11-15"),
    sortOrder: 6,
  },
  {
    slug: "modeling-3d-started",
    titleFr: "Modélisation 3D démarrée",
    titleEn: "3D modeling started",
    descriptionFr: "Premières courbes et surfaces coque/pont sur Onshape.",
    descriptionEn: "First hull and deck curves and surfaces in Onshape.",
    milestoneDate: new Date("2026-01-01"),
    sortOrder: 7,
  },
  {
    slug: "suppliers-chosen",
    titleFr: "Fournisseurs retenus",
    titleEn: "Suppliers chosen",
    descriptionFr: "Sicomin (époxy), Les Inoxydables (visserie A4), Allin (contreplaqué).",
    descriptionEn: "Sicomin (epoxy), Les Inoxydables (A4 screws), Allin (plywood).",
    milestoneDate: new Date("2026-05-03"),
    sortOrder: 8,
  },
  {
    slug: "cnc-programming",
    titleFr: "Préparation programmes CNC",
    titleEn: "CNC programming prep",
    descriptionFr: "Rodolphe prépare les programmes de découpe CP et Douglas.",
    descriptionEn: "Rodolphe prepares CNC cutting programs for plywood and Douglas.",
    milestoneDate: new Date("2026-06-01"),
    sortOrder: 9,
  },
  {
    slug: "making-frames",
    titleFr: "Montage des couples",
    titleEn: "Making frames",
    descriptionFr: "Étape classe — couples et lisses.",
    descriptionEn: "Class step — frames and stringers.",
    milestoneDate: new Date("2026-09-01"),
    sortOrder: 10,
  },
  {
    slug: "setting-up-frames",
    titleFr: "Pose couples et lisses",
    titleEn: "Setting up frames and stringers",
    descriptionFr: "Étape classe obligatoire.",
    descriptionEn: "Mandatory class build step.",
    milestoneDate: new Date("2026-10-01"),
    sortOrder: 11,
  },
  {
    slug: "hull-plating",
    titleFr: "Plaquage coque",
    titleEn: "Hull plating",
    descriptionFr: "Plaquage de la coque en contreplaqué.",
    descriptionEn: "Plywood hull plating.",
    milestoneDate: new Date("2026-11-01"),
    sortOrder: 12,
  },
  {
    slug: "hull-epoxy-fairing",
    titleFr: "Stratification et ponçage coque",
    titleEn: "Hull epoxy sheeting and fairing",
    descriptionFr: "Imprégnation époxy et fairing.",
    descriptionEn: "Epoxy sheeting and fairing.",
    milestoneDate: new Date("2027-01-01"),
    sortOrder: 13,
  },
  {
    slug: "roll-hull-deck",
    titleFr: "Retournement et pont",
    titleEn: "Roll hull and deck plating",
    descriptionFr: "Retournement, plaquage pont et fairing.",
    descriptionEn: "Hull roll, deck plating and glass-fairing.",
    milestoneDate: new Date("2027-03-01"),
    sortOrder: 14,
  },
  {
    slug: "internal-fit",
    titleFr: "Aménagement intérieur",
    titleEn: "Internal plywood fit and crash box",
    descriptionFr: "Cloisons, crash box avant.",
    descriptionEn: "Internal fit-out and forward crash box.",
    milestoneDate: new Date("2027-05-01"),
    sortOrder: 15,
  },
  {
    slug: "keel-floors",
    titleFr: "Sols de quille",
    titleEn: "Keel floors",
    descriptionFr: "Installation des sols de quille.",
    descriptionEn: "Keel floor installation.",
    milestoneDate: new Date("2027-06-01"),
    sortOrder: 16,
  },
  {
    slug: "weighing-hull",
    titleFr: "Pesée coque",
    titleEn: "Weighing hull",
    descriptionFr: "Pesée officielle de la coque.",
    descriptionEn: "Official hull weighing.",
    milestoneDate: new Date("2027-07-01"),
    sortOrder: 17,
  },
  {
    slug: "rudder",
    titleFr: "Construction gouvernail",
    titleEn: "Rudder construction",
    descriptionFr: "Fabrication du gouvernail.",
    descriptionEn: "Rudder build.",
    milestoneDate: new Date("2027-08-01"),
    sortOrder: 18,
  },
  {
    slug: "keel",
    titleFr: "Construction quille",
    titleEn: "Keel construction and weighing",
    descriptionFr: "Quille lest plomb — pesée.",
    descriptionEn: "Lead keel — construction and weighing.",
    milestoneDate: new Date("2027-09-01"),
    sortOrder: 19,
  },
  {
    slug: "deck-hardware",
    titleFr: "Trappes et équipement pont",
    titleEn: "Companionway, hatches, deck hardware",
    descriptionFr: "Trappe, portes étanches, hublots.",
    descriptionEn: "Companionway hatch, watertight doors, deck hatches.",
    milestoneDate: new Date("2027-10-01"),
    sortOrder: 20,
  },
  {
    slug: "safety-rails",
    titleFr: "Pulpit, pushpit, sécurité",
    titleEn: "Handrails, pushpit/pulpit, safety",
    descriptionFr: "Main courante, bout de focs, points harnais.",
    descriptionEn: "Handrails, bowsprit, safety harness attachments.",
    milestoneDate: new Date("2027-11-01"),
    sortOrder: 21,
  },
];
