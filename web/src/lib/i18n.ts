import type { Locale } from "./locale";

const messages = {
  "nav.home": { fr: "Accueil", en: "Home" },
  "nav.blog": { fr: "Blog", en: "Blog" },
  "nav.gallery": { fr: "Galerie", en: "Gallery" },
  "nav.timeline": { fr: "Timeline", en: "Timeline" },
  "nav.editor": { fr: "Articles", en: "Posts" },
  "nav.milestones": { fr: "Jalons", en: "Milestones" },
  "nav.sync": { fr: "Sync", en: "Sync" },
  "nav.login": { fr: "Connexion", en: "Sign in" },
  "nav.openMenu": { fr: "Ouvrir le menu", en: "Open menu" },
  "nav.closeMenu": { fr: "Fermer le menu", en: "Close menu" },
  "nav.sectionSite": { fr: "Site", en: "Site" },
  "nav.sectionEditor": { fr: "Édition", en: "Editor" },
  "nav.sectionAccount": { fr: "Compte", en: "Account" },

  "footer.tagline": {
    fr: "Construction de trois Class Globe 5.80 — coques #268, #269 et #270.",
    en: "Building three Class Globe 5.80 boats — hulls #268, #269 and #270.",
  },
  "footer.officialSite": { fr: "Site officiel", en: "Official website" },
  "footer.builderBlogs": { fr: "Blogs constructeurs", en: "Builder blogs" },
  "footer.transat": { fr: "Globe 5.80 Transat", en: "Globe 5.80 Transat" },
  "footer.credit": {
    fr: "Les vieux fourneaux — documentation bilingue FR/EN",
    en: "Les vieux fourneaux — bilingual FR/EN documentation",
  },

  "home.heroLabel": { fr: "Class Mini 5.80 Baie de Somme", en: "Class Mini 5.80 Baie de Somme" },
  "home.heroTitle": {
    fr: "Trois Class Globe 5.80 — coques #268, #269 et #270",
    en: "Three Class Globe 5.80 — hulls #268, #269 and #270",
  },
  "home.heroSubtitle": {
    fr: "Les vieux fourneaux documentent la construction de trois voiliers de course océanique en contreplaqué époxy, depuis la Baie de Somme. Blog bilingue FR/EN, transparent et un peu swing manouche.",
    en: "Les vieux fourneaux document the build of three ocean-racing plywood-epoxy sailboats from the Baie de Somme. Bilingual FR/EN blog — transparent, with a touch of swing manouche.",
  },
  "home.readBlog": { fr: "Lire le blog", en: "Read the blog" },
  "home.galleryCta": { fr: "Galerie photos", en: "Photo gallery" },
  "home.timelineCta": { fr: "Timeline chantier", en: "Build timeline" },
  "home.teamTitle": { fr: "L'équipe", en: "The crew" },
  "home.teamIntro": {
    fr: "Amis depuis 25 ans — kitesurf, swing manouche — ils construisent trois bateaux car un Mini 5.80 est trop petit pour naviguer à trois.",
    en: "Friends for 25 years — kitesurf, swing manouche — they're building three boats because one Mini 5.80 is too small for three.",
  },
  "home.yardTitle": { fr: "Le chantier Class Mini 5.80 Baie de Somme", en: "The Class Mini 5.80 Baie de Somme yard" },
  "home.yardText": {
    fr: "Atelier de 250 m² dans une grange près de Saint-Valéry-sur-Somme. Construction depuis les plans officiels Janusz Maderski, découpe CNC maison, modélisation 3D complète sur Onshape.",
    en: "250 m² workshop in a barn near Saint-Valéry-sur-Somme. Build from official Janusz Maderski plans, in-house CNC cutting, full 3D modelling on Onshape.",
  },
  "home.yardBullet1": { fr: "80 plaques okoumé 10 mm (Allin)", en: "80 okoumé 10 mm sheets (Allin)" },
  "home.yardBullet2": {
    fr: "Époxy Sicomin — quantités calculées en 3D",
    en: "Sicomin epoxy — quantities calculated in 3D",
  },
  "home.yardBullet3": {
    fr: "~9 000 vis inox A4 316L (Les Inoxydables)",
    en: "~9,000 A4 316L stainless screws (Les Inoxydables)",
  },
  "home.classGlobe": { fr: "Class Globe 5.80", en: "Class Globe 5.80" },
  "home.officialLink": { fr: "Site officiel →", en: "Official site →" },
  "home.buildersLink": { fr: "Blogs constructeurs →", en: "Builder blogs →" },
  "home.transatLink": { fr: "Globe 5.80 Transat →", en: "Globe 5.80 Transat →" },
  "home.latestPosts": { fr: "Derniers articles", en: "Latest posts" },
  "home.viewAll": { fr: "Tout voir →", en: "View all →" },

  "team.laurent.role": {
    fr: "Modélisation 3D (Onshape), construction",
    en: "3D modelling (Onshape), construction",
  },
  "team.laurent.detail": {
    fr: "Professeur de conception mécanique — congé 6 mois dès fév. 2026",
    en: "Mechanical design teacher — 6-month leave from Feb 2026",
  },
  "team.marco.role": { fr: "Sourcing matériaux, logistique", en: "Materials sourcing, logistics" },
  "team.marco.detail": {
    fr: "Ex-commerce — a appris à naviguer pour le projet",
    en: "Former sales — learned to sail for the project",
  },
  "team.rodolphe.role": {
    fr: "Programmation CNC, découpe CP",
    en: "CNC programming, plywood cutting",
  },
  "team.rodolphe.detail": {
    fr: "Professeur de conception mécanique",
    en: "Mechanical design teacher",
  },

  "blog.title": { fr: "Blog de construction", en: "Build blog" },
  "blog.subtitle": {
    fr: "Articles anti-chronologiques — filtres par coque, thème ou mot-clé.",
    en: "Reverse-chronological posts — filter by hull, theme or keyword.",
  },
  "blog.empty": { fr: "Aucun article publié.", en: "No published posts yet." },
  "blog.search": { fr: "Rechercher…", en: "Search…" },
  "blog.filter": { fr: "Filtrer", en: "Filter" },
  "blog.hull": { fr: "Coque:", en: "Hull:" },
  "blog.theme": { fr: "Thème:", en: "Theme:" },
  "blog.tag": { fr: "Tag:", en: "Tag:" },
  "blog.readMore": { fr: "Lire l'article →", en: "Read article →" },

  "gallery.title": { fr: "Galerie chantier", en: "Yard gallery" },
  "gallery.subtitle": {
    fr: "Toutes les photos des articles publiés — tri par date ou jalon, filtres coque / thème / tag.",
    en: "All photos from published posts — sort by date or milestone, filter by hull / theme / tag.",
  },
  "gallery.search": { fr: "Rechercher une photo…", en: "Search photos…" },
  "gallery.filter": { fr: "Filtrer", en: "Filter" },
  "gallery.sort": { fr: "Tri:", en: "Sort:" },
  "gallery.sortDate": { fr: "Date", en: "Date" },
  "gallery.sortMilestone": { fr: "Jalon", en: "Milestone" },
  "gallery.milestone": { fr: "Jalon:", en: "Milestone:" },
  "gallery.count": { fr: "{n} photo(s)", en: "{n} photo(s)" },
  "gallery.empty": {
    fr: "Aucune photo pour ces filtres.",
    en: "No photos match these filters.",
  },
  "gallery.untitled": { fr: "Sans titre", en: "Untitled" },
  "gallery.slideshow": { fr: "Diaporama", en: "Slideshow" },
  "gallery.prev": { fr: "Précédente", en: "Previous" },
  "gallery.next": { fr: "Suivante", en: "Next" },
  "gallery.play": { fr: "Auto (5 s)", en: "Auto (5 s)" },
  "gallery.pause": { fr: "Pause", en: "Pause" },
  "gallery.close": { fr: "Fermer", en: "Close" },

  "timeline.title": { fr: "Timeline du chantier", en: "Build timeline" },
  "timeline.subtitle": {
    fr: "Jalons de construction Class Globe et articles du blog, ordonnés chronologiquement.",
    en: "Class Globe build milestones and blog posts in chronological order.",
  },
  "timeline.empty": { fr: "Aucun jalon pour le moment.", en: "No milestones yet." },

  "login.title": { fr: "Connexion éditeur", en: "Editor sign-in" },
  "login.subtitle": {
    fr: "Accès réservé aux membres de l'équipe Class Mini 5.80 Baie de Somme (allowlist email).",
    en: "Access restricted to Class Mini 5.80 Baie de Somme team members (email allowlist).",
  },
  "login.email": { fr: "Email", en: "Email" },
  "login.password": { fr: "Mot de passe", en: "Password" },
  "login.submit": { fr: "Se connecter", en: "Sign in" },
  "login.loading": { fr: "Connexion…", en: "Signing in…" },
  "login.failed": { fr: "Connexion impossible", en: "Sign-in failed" },
  "login.network": { fr: "Erreur réseau", en: "Network error" },

  "article.gallery": { fr: "Galerie photos", en: "Photo gallery" },
  "article.back": { fr: "Retour au blog", en: "Back to blog" },

  "editor.title": { fr: "Éditeur", en: "Editor" },
  "editor.newPost": { fr: "Nouvel article", en: "New post" },
  "editor.logout": { fr: "Déconnexion", en: "Sign out" },
  "editor.search": { fr: "Rechercher un article…", en: "Search posts…" },
  "editor.filter": { fr: "Filtrer", en: "Filter" },
  "editor.status": { fr: "Statut:", en: "Status:" },
  "editor.status.all": { fr: "Tous", en: "All" },
  "editor.status.draft": { fr: "Brouillon", en: "Draft" },
  "editor.status.published": { fr: "Publié", en: "Published" },
  "editor.status.archived": { fr: "Archivé", en: "Archived" },
  "editor.colTitle": { fr: "Titre", en: "Title" },
  "editor.colHulls": { fr: "Coques", en: "Hulls" },
  "editor.colStatus": { fr: "Statut", en: "Status" },
  "editor.colUpdated": { fr: "Modifié", en: "Updated" },
  "editor.empty": { fr: "Aucun article.", en: "No posts." },
  "editor.loading": { fr: "Chargement…", en: "Loading…" },
  "editor.loadingMore": { fr: "Chargement…", en: "Loading more…" },
  "editor.loadError": { fr: "Impossible de charger les articles.", en: "Failed to load posts." },
  "editor.count": { fr: "{n} article(s)", en: "{n} post(s)" },
  "editor.notOnProd": { fr: "hors PROD", en: "not on PROD" },
  "editor.archive": { fr: "Archiver", en: "Archive" },
  "editor.unarchive": { fr: "Désarchiver", en: "Unarchive" },
  "editor.delete": { fr: "Supprimer", en: "Delete" },
  "editor.deleteConfirm": {
    fr: "Supprimer définitivement « {title} » ?",
    en: "Permanently delete “{title}”?",
  },
  "editor.publishProd": { fr: "Publier PROD", en: "Publish to PROD" },
  "editor.publishProdConfirm": {
    fr: "Publier cet article sur PROD ?",
    en: "Publish this post to PROD?",
  },
  "editor.publishProdDone": { fr: "Publié sur PROD", en: "Published to PROD" },
  "editor.archiveFailed": { fr: "Échec archivage", en: "Archive failed" },
  "editor.deleteFailed": { fr: "Échec suppression", en: "Delete failed" },
  "editor.publishProdFailed": { fr: "Échec publication PROD", en: "PROD publish failed" },
  "editor.dangerZone": { fr: "Zone sensible", en: "Danger zone" },
} as const satisfies Record<string, Record<Locale, string>>;

export type MessageKey = keyof typeof messages;

export function t(key: MessageKey, locale: Locale): string {
  return messages[key][locale];
}
