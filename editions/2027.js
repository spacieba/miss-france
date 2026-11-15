// ============================================================
// ÉDITION MISS FRANCE 2027 — élection du 12 décembre 2026
// Futuroscope Arena (Chasseneuil-du-Poitou, Vienne)
//
// Pour préparer l'édition suivante : copier ce fichier en
// editions/2028.js, le mettre à jour, puis définir la variable
// d'environnement EDITION=2028 (et l'ajouter à la table EDITIONS de src/app.js).
// ============================================================

// Liste des 31 candidates (source : Wikipédia « Miss France 2027 », novembre 2026).
// `name` sert d'identifiant dans les pronostics : ne pas le modifier une fois les pronostics ouverts.
// `photo` : photo principale ; `photos` : galerie (fichiers dans public/img/candidates/, 480 px de large).
// Photos récupérées sur les comptes Instagram des comités régionaux (novembre 2026).
const candidates = [
  { name: "Miss Alsace", person: "Chiara Blazevic", photo: '/img/candidates/alsace-1.jpg', photos: ['/img/candidates/alsace-1.jpg', '/img/candidates/alsace-2.jpg', '/img/candidates/alsace-3.jpg', '/img/candidates/alsace-4.jpg'] },
  { name: "Miss Aquitaine", person: "Solène Videau", photo: '/img/candidates/aquitaine-1.jpg', photos: ['/img/candidates/aquitaine-1.jpg', '/img/candidates/aquitaine-2.jpg', '/img/candidates/aquitaine-3.jpg', '/img/candidates/aquitaine-4.jpg'] },
  { name: "Miss Auvergne", person: "Lina Berthelier", photo: '/img/candidates/auvergne-1.jpg', photos: ['/img/candidates/auvergne-1.jpg', '/img/candidates/auvergne-2.jpg', '/img/candidates/auvergne-3.jpg', '/img/candidates/auvergne-4.jpg'] },
  { name: "Miss Bourgogne", person: "Ilona Perrot", photo: '/img/candidates/bourgogne-1.jpg', photos: ['/img/candidates/bourgogne-1.jpg', '/img/candidates/bourgogne-2.jpg', '/img/candidates/bourgogne-3.jpg', '/img/candidates/bourgogne-4.jpg'] },
  { name: "Miss Bretagne", person: "Margot Ferré-Bernard", photo: '/img/candidates/bretagne-1.jpg', photos: ['/img/candidates/bretagne-1.jpg', '/img/candidates/bretagne-2.jpg', '/img/candidates/bretagne-3.jpg', '/img/candidates/bretagne-4.jpg'] },
  { name: "Miss Centre-Val de Loire", person: "Justine Bourrelier", photo: '/img/candidates/centre-val-de-loire-1.jpg', photos: ['/img/candidates/centre-val-de-loire-1.jpg', '/img/candidates/centre-val-de-loire-2.jpg', '/img/candidates/centre-val-de-loire-3.jpg'] },
  { name: "Miss Champagne-Ardenne", person: "Céline Leduc", photo: '/img/candidates/champagne-ardenne-1.jpg', photos: ['/img/candidates/champagne-ardenne-1.jpg', '/img/candidates/champagne-ardenne-2.jpg', '/img/candidates/champagne-ardenne-3.jpg', '/img/candidates/champagne-ardenne-4.jpg'] },
  { name: "Miss Corse", person: "Satine Nomary", photo: '/img/candidates/corse-1.jpg', photos: ['/img/candidates/corse-1.jpg', '/img/candidates/corse-2.jpg', '/img/candidates/corse-3.jpg'] },
  { name: "Miss Côte d'Azur", person: "May Haoues", photo: '/img/candidates/cote-d-azur-1.jpg', photos: ['/img/candidates/cote-d-azur-1.jpg', '/img/candidates/cote-d-azur-2.jpg', '/img/candidates/cote-d-azur-3.jpg'] },
  { name: "Miss Franche-Comté", person: "Emma Ninot", photo: '/img/candidates/franche-comte-1.jpg', photos: ['/img/candidates/franche-comte-1.jpg', '/img/candidates/franche-comte-2.jpg', '/img/candidates/franche-comte-3.jpg', '/img/candidates/franche-comte-4.jpg'] },
  { name: "Miss Guadeloupe", person: "Julia Désirée", photo: '/img/candidates/guadeloupe-1.jpg', photos: ['/img/candidates/guadeloupe-1.jpg', '/img/candidates/guadeloupe-2.jpg', '/img/candidates/guadeloupe-3.jpg', '/img/candidates/guadeloupe-4.jpg'] },
  { name: "Miss Guyane", person: "Sandra Justine", photo: '/img/candidates/guyane-1.jpg', photos: ['/img/candidates/guyane-1.jpg', '/img/candidates/guyane-2.jpg', '/img/candidates/guyane-3.jpg', '/img/candidates/guyane-4.jpg'] },
  { name: "Miss Île-de-France", person: "Camilla Alash", photo: '/img/candidates/ile-de-france-1.jpg', photos: ['/img/candidates/ile-de-france-1.jpg', '/img/candidates/ile-de-france-2.jpg', '/img/candidates/ile-de-france-3.jpg', '/img/candidates/ile-de-france-4.jpg'] },
  { name: "Miss Languedoc", person: "Candice Gauch", photo: '/img/candidates/languedoc-1.jpg', photos: ['/img/candidates/languedoc-1.jpg', '/img/candidates/languedoc-2.jpg', '/img/candidates/languedoc-3.jpg', '/img/candidates/languedoc-4.jpg'] },
  { name: "Miss Limousin", person: "Élise Escuriol", photo: '/img/candidates/limousin-1.jpg', photos: ['/img/candidates/limousin-1.jpg', '/img/candidates/limousin-2.jpg', '/img/candidates/limousin-3.jpg', '/img/candidates/limousin-4.jpg'] },
  { name: "Miss Lorraine", person: "Léane Froment", photo: '/img/candidates/lorraine-1.jpg', photos: ['/img/candidates/lorraine-1.jpg', '/img/candidates/lorraine-2.jpg', '/img/candidates/lorraine-3.jpg', '/img/candidates/lorraine-4.jpg'] },
  { name: "Miss Martinique", person: "Maureen-Alycia Lucea-Merlin", photo: '/img/candidates/martinique-1.jpg', photos: ['/img/candidates/martinique-1.jpg', '/img/candidates/martinique-2.jpg', '/img/candidates/martinique-3.jpg', '/img/candidates/martinique-4.jpg'] },
  { name: "Miss Mayotte", person: "Emma Saïd Issouf", photo: '/img/candidates/mayotte-1.jpg', photos: ['/img/candidates/mayotte-1.jpg', '/img/candidates/mayotte-2.jpg', '/img/candidates/mayotte-3.jpg'] },
  { name: "Miss Midi-Pyrénées", person: "Carla Rachail", photo: '/img/candidates/midi-pyrenees-1.jpg', photos: ['/img/candidates/midi-pyrenees-1.jpg', '/img/candidates/midi-pyrenees-2.jpg', '/img/candidates/midi-pyrenees-3.jpg', '/img/candidates/midi-pyrenees-4.jpg'] },
  { name: "Miss Nord-Pas-de-Calais", person: "Shana Mendes", photo: '/img/candidates/nord-pas-de-calais-1.jpg', photos: ['/img/candidates/nord-pas-de-calais-1.jpg', '/img/candidates/nord-pas-de-calais-2.jpg', '/img/candidates/nord-pas-de-calais-3.jpg'] },
  { name: "Miss Normandie", person: "Pauline Gourlez", photo: '/img/candidates/normandie-1.jpg', photos: ['/img/candidates/normandie-1.jpg', '/img/candidates/normandie-2.jpg', '/img/candidates/normandie-3.jpg', '/img/candidates/normandie-4.jpg'] },
  { name: "Miss Nouvelle-Calédonie", person: "Lana Prost", photo: '/img/candidates/nouvelle-caledonie-1.jpg', photos: ['/img/candidates/nouvelle-caledonie-1.jpg', '/img/candidates/nouvelle-caledonie-2.jpg', '/img/candidates/nouvelle-caledonie-3.jpg', '/img/candidates/nouvelle-caledonie-4.jpg'] },
  { name: "Miss Pays de la Loire", person: "Maëlle Hamon", photo: '/img/candidates/pays-de-la-loire-1.jpg', photos: ['/img/candidates/pays-de-la-loire-1.jpg', '/img/candidates/pays-de-la-loire-2.jpg', '/img/candidates/pays-de-la-loire-3.jpg', '/img/candidates/pays-de-la-loire-4.jpg'] },
  { name: "Miss Picardie", person: "Marie Villez", photo: '/img/candidates/picardie-1.jpg', photos: ['/img/candidates/picardie-1.jpg', '/img/candidates/picardie-2.jpg', '/img/candidates/picardie-3.jpg', '/img/candidates/picardie-4.jpg'] },
  { name: "Miss Poitou-Charentes", person: "Mandy Goudal", photo: '/img/candidates/poitou-charentes-1.jpg', photos: ['/img/candidates/poitou-charentes-1.jpg', '/img/candidates/poitou-charentes-2.jpg', '/img/candidates/poitou-charentes-3.jpg', '/img/candidates/poitou-charentes-4.jpg'] },
  { name: "Miss Provence", person: "Ophélie Vitalbo", photo: '/img/candidates/provence-1.jpg', photos: ['/img/candidates/provence-1.jpg', '/img/candidates/provence-2.jpg', '/img/candidates/provence-3.jpg'] },
  { name: "Miss Réunion", person: "Laetitia Roguet", photo: '/img/candidates/reunion-1.jpg', photos: ['/img/candidates/reunion-1.jpg', '/img/candidates/reunion-2.jpg', '/img/candidates/reunion-3.jpg', '/img/candidates/reunion-4.jpg'] },
  { name: "Miss Rhône-Alpes", person: "Julia Grid-Costantino", photo: '/img/candidates/rhone-alpes-1.jpg', photos: ['/img/candidates/rhone-alpes-1.jpg', '/img/candidates/rhone-alpes-2.jpg', '/img/candidates/rhone-alpes-3.jpg', '/img/candidates/rhone-alpes-4.jpg'] },
  { name: "Miss Roussillon", person: "Juliette Gauthier", photo: '/img/candidates/roussillon-1.jpg', photos: ['/img/candidates/roussillon-1.jpg', '/img/candidates/roussillon-2.jpg', '/img/candidates/roussillon-3.jpg', '/img/candidates/roussillon-4.jpg'] },
  { name: "Miss Saint-Martin & Saint-Barthélemy", person: "Naïla Parotte", photo: '/img/candidates/saint-martin-saint-barthelemy-1.jpg', photos: ['/img/candidates/saint-martin-saint-barthelemy-1.jpg', '/img/candidates/saint-martin-saint-barthelemy-2.jpg', '/img/candidates/saint-martin-saint-barthelemy-3.jpg', '/img/candidates/saint-martin-saint-barthelemy-4.jpg'] },
  { name: "Miss Tahiti", person: "Leia Diard", photo: '/img/candidates/tahiti-1.jpg', photos: ['/img/candidates/tahiti-1.jpg', '/img/candidates/tahiti-2.jpg', '/img/candidates/tahiti-3.jpg', '/img/candidates/tahiti-4.jpg'] }
];

// Quiz « univers Miss France »
const quizQuestions = [
  { id: 1, question: "En quelle année a eu lieu la première élection de Miss France ?", answers: ["1920", "1927", "1935", "1945"], correct: 1, points: 2, difficulty: "moyen" },
  { id: 2, question: "Quelle Miss France est devenue actrice dans James Bond ?", answers: ["Mareva Galanter", "Marine Lorphelin", "Iris Mittenaere", "Laury Thilleman"], correct: 0, points: 3, difficulty: "difficile" },
  { id: 3, question: "Combien de fois Jean-Pierre Foucault a-t-il présenté Miss France ?", answers: ["Plus de 20 fois", "Plus de 25 fois", "Plus de 30 fois", "Plus de 35 fois"], correct: 2, points: 2, difficulty: "moyen" },
  { id: 4, question: "Quelle Miss France a remporté Miss Univers en 2016 ?", answers: ["Flora Coquerel", "Iris Mittenaere", "Camille Cerf", "Marine Lorphelin"], correct: 1, points: 1, difficulty: "facile" },
  { id: 5, question: "Dans quelle ville se déroule généralement l'élection de Miss France ?", answers: ["Paris", "Nice", "Une ville différente chaque année", "Lille"], correct: 2, points: 1, difficulty: "facile" },
  { id: 6, question: "Quelle est la taille minimum requise pour participer à Miss France ?", answers: ["1m65", "1m70", "1m75", "Aucune restriction"], correct: 1, points: 2, difficulty: "moyen" },
  { id: 7, question: "Qui a créé le concours Miss France ?", answers: ["Maurice de Waleffe", "Jean-Pierre Foucault", "Geneviève de Fontenay", "Louis de Funès"], correct: 0, points: 3, difficulty: "difficile" },
  { id: 8, question: "Quelle Miss France est devenue Miss Univers en 1953 ?", answers: ["Christiane Martel", "Sylvie Tellier", "Muguette Fabris", "Denise Perrier"], correct: 0, points: 3, difficulty: "difficile" },
  { id: 9, question: "Combien y a-t-il de candidates en moyenne chaque année ?", answers: ["20", "25", "30", "35"], correct: 2, points: 1, difficulty: "facile" },
  { id: 10, question: "Qui présentait Miss France avant Jean-Pierre Foucault ?", answers: ["Patrick Sabatier", "Michel Drucker", "Yves Mourousi", "Patrick Sébastien"], correct: 2, points: 3, difficulty: "difficile" },
  { id: 11, question: "Quelle Miss France a eu le règne le plus long ?", answers: ["Iris Mittenaere", "Marine Lorphelin", "Malika Ménard", "Eve Gilles"], correct: 3, points: 2, difficulty: "moyen" },
  { id: 12, question: "Sur quelle chaîne est diffusé Miss France ?", answers: ["TF1", "France 2", "M6", "France 3"], correct: 0, points: 1, difficulty: "facile" },
  { id: 13, question: "Quelle est la durée du règne d'une Miss France ?", answers: ["6 mois", "1 an", "2 ans", "18 mois"], correct: 1, points: 1, difficulty: "facile" },
  { id: 14, question: "Qui est l'actuelle présidente de la société Miss France ?", answers: ["Geneviève de Fontenay", "Sylvie Tellier", "Alexia Laroche-Joubert", "Cindy Fabre"], correct: 2, points: 2, difficulty: "moyen" },
  { id: 15, question: "Quelle Miss France a participé à Danse avec les Stars ?", answers: ["Plusieurs", "Aucune", "Marine Lorphelin uniquement", "Iris Mittenaere uniquement"], correct: 0, points: 1, difficulty: "facile" },
  { id: 16, question: "Quel âge maximum peut avoir une candidate ?", answers: ["24 ans", "25 ans", "26 ans", "Pas de limite"], correct: 3, points: 2, difficulty: "moyen" },
  { id: 17, question: "Quelle région a gagné le plus de fois ?", answers: ["Île-de-France", "Provence", "Nord-Pas-de-Calais", "Normandie"], correct: 2, points: 3, difficulty: "difficile" },
  { id: 18, question: "Combien de Miss France ont remporté Miss Univers ?", answers: ["1", "2", "3", "4"], correct: 1, points: 3, difficulty: "difficile" },
  { id: 19, question: "Quelle Miss France est devenue chroniqueuse TV ?", answers: ["Plusieurs", "Aucune", "Malika Ménard uniquement", "Marine Lorphelin uniquement"], correct: 0, points: 1, difficulty: "facile" },
  { id: 20, question: "Quelle est la récompense principale de Miss France ?", answers: ["De l'argent", "Une voiture", "Un appartement", "Des cadeaux et contrats publicitaires"], correct: 3, points: 2, difficulty: "moyen" },
  { id: 21, question: "Qui était Miss France 2023 ?", answers: ["Indira Ampiot", "Eve Gilles", "Diane Leyre", "Amandine Petit"], correct: 0, points: 1, difficulty: "facile" },
  { id: 22, question: "Combien de dauphines sont élues ?", answers: ["1", "2", "3", "4"], correct: 3, points: 2, difficulty: "moyen" },
  { id: 23, question: "Quelle Miss France a chanté à l'Eurovision ?", answers: ["Amandine Petit", "Aucune", "Marine Lorphelin", "Laury Thilleman"], correct: 1, points: 2, difficulty: "moyen" },
  { id: 24, question: "Dans quel mois a lieu l'élection de Miss France ?", answers: ["Novembre", "Décembre", "Janvier", "Février"], correct: 1, points: 1, difficulty: "facile" },
  { id: 25, question: "Quelle Miss France a créé une association caritative ?", answers: ["Plusieurs", "Aucune", "Marine Lorphelin uniquement", "Iris Mittenaere uniquement"], correct: 0, points: 2, difficulty: "moyen" },
  { id: 26, question: "Combien de costumes portent les candidates pendant l'émission ?", answers: ["2", "3", "4", "5"], correct: 1, points: 2, difficulty: "moyen" },
  { id: 27, question: "Quelle Miss France a posé pour Playboy ?", answers: ["Aucune", "Une seule", "Plusieurs", "Toutes"], correct: 2, points: 3, difficulty: "difficile" },
  { id: 28, question: "Qui choisit Miss France ?", answers: ["Le jury uniquement", "Le public uniquement", "Le public et le jury", "Jean-Pierre Foucault"], correct: 2, points: 1, difficulty: "facile" },
  { id: 29, question: "Quelle est la marque de la couronne Miss France ?", answers: ["Chaumet", "Cartier", "Boucheron", "Van Cleef & Arpels"], correct: 0, points: 3, difficulty: "difficile" },
  { id: 30, question: "Combien de spectateurs en moyenne devant la TV ?", answers: ["3 millions", "5 millions", "7 millions", "10 millions"], correct: 2, points: 2, difficulty: "moyen" },
  { id: 31, question: "Qui a été élue Miss France 2026 ?", answers: ["Juliette Collet", "Hinaupoko Devèze", "Angélique Angarni-Filopon", "Victoire Dupuis"], correct: 1, points: 1, difficulty: "facile" },
  { id: 32, question: "Quelle région représentait Miss France 2026 ?", answers: ["Nouvelle-Calédonie", "Martinique", "Tahiti", "Normandie"], correct: 2, points: 2, difficulty: "moyen" },
  { id: 33, question: "Dans quelle ville a eu lieu l'élection de Miss France 2026 ?", answers: ["Amiens", "Poitiers", "Dijon", "Lille"], correct: 0, points: 2, difficulty: "moyen" },
  { id: 34, question: "Où se déroule l'élection de Miss France 2027 ?", answers: ["Au Zénith d'Amiens", "Au Futuroscope", "Au Puy du Fou", "À Disneyland Paris"], correct: 1, points: 2, difficulty: "moyen" }
];

// ============================================================
// QUESTIONNAIRE CULTURE G
// ⚠️ Le questionnaire officiel 2027 n'est pas encore publié : en attendant,
// c'est celui passé par les candidates Miss France 2026 qui est utilisé.
// Le remplacer ici dès sa publication, puis mettre à jour `cultureGLabel`.
// Types : "single" (correct = index), "multiple" (correct = [index]), "text" (correct = [réponses acceptées]).
// ============================================================
const cultureGQuestions = {
  actualite: {
    name: "Actualité",
    totalPoints: 10,
    questions: [
      { id: "actu1", question: "Quelle est la capitale de l'Ukraine, pays encore au cœur de l'actualité internationale en 2025 ?", type: "text", correct: ["Kiev", "Kyiv"], points: 1 },
      { id: "actu2", question: "Quel droit fondamental pour les femmes a été inscrit dans la Constitution française le 8 mars 2024 ?", type: "text", correct: ["IVG", "avortement", "le libre recours à l'IVG", "droit à l'avortement", "droit à l'IVG"], points: 1 },
      { id: "actu3", question: "Quel événement organisé par le vidéaste Squeezie a eu lieu sur le circuit Bugatti du Mans en octobre dernier ?", type: "text", correct: ["GP Explorer", "GP Explorer 3", "Grand Prix Explorer"], points: 1 },
      { id: "actu4", question: "À quelle espèce animale Jane Goodall, décédée en octobre dernier, a-t-elle consacré sa carrière ?", type: "text", correct: ["chimpanzés", "chimpanzé", "singes", "singe"], points: 1 },
      { id: "actu5", question: "Quel produit alimentaire à base de framboises congelées est devenu un phénomène viral sur TikTok ?", type: "text", correct: ["Franui", "Franuì"], points: 1 },
      { id: "actu6", question: "Quel club de football a remporté la Ligue des Champions en mai 2025 ?", type: "text", correct: ["PSG", "Paris Saint-Germain", "Paris SG"], points: 1 },
      { id: "actu7", question: "Vrai ou faux : le DSA a été mis en place pour réglementer les services numériques ?", type: "single", answers: ["Vrai", "Faux"], correct: 0, points: 1, bonus: { question: "De quel nom DSA est-il l'acronyme ?", correct: ["Digital Services Act"], points: 0.5 } },
      { id: "actu8", question: "Quelle personnalité décédée en 2024 a fait son entrée au Panthéon le 9 octobre 2025 ?", type: "text", correct: ["Robert Badinter", "Badinter"], points: 1 },
      { id: "actu9", question: "Quelle est la nationalité de María Corina Machado qui a reçu le prix Nobel de la paix en octobre dernier ?", type: "text", correct: ["vénézuélienne", "vénézuelienne", "venezuelienne", "Venezuela"], points: 1 },
      { id: "actu10", question: "Quel joueur a remporté le tournoi de Roland-Garros en juin 2025 ?", type: "text", correct: ["Carlos Alcaraz", "Alcaraz"], points: 1 }
    ]
  },
  histoire_geo: {
    name: "Histoire / Géographie",
    totalPoints: 10,
    questions: [
      { id: "hg1", question: "En quelle année a eu lieu la chute du mur de Berlin ?", type: "single", answers: ["1979", "1981", "1989", "1991"], correct: 2, points: 1 },
      { id: "hg2", question: "Qui était le premier empereur de Rome ?", type: "single", answers: ["Jules César", "Auguste", "Astérix", "Trajan"], correct: 1, points: 1 },
      { id: "hg3", question: "Quel mot est cité en premier dans La Marseillaise ?", type: "single", answers: ["Compagnes", "Campagnes", "Citoyens", "Armes"], correct: 1, points: 1 },
      { id: "hg4", question: "Quel roi a construit le célèbre château de Chambord et est associé à la Renaissance française ?", type: "single", answers: ["François Ier", "Louis XIV", "Henri II", "Louis XV"], correct: 0, points: 1 },
      { id: "hg5", question: "Quel événement historique a-t-on commémoré en France le 8 mai 2025 ?", type: "single", answers: ["Les 80 ans de l'abolition de la peine de mort", "Les 80 ans de la fête du Travail", "Les 80 ans de la fin de la guerre froide", "Les 80 ans de la fin de la Seconde Guerre mondiale en Europe"], correct: 3, points: 1 },
      { id: "hg6", question: "Qui proclame officiellement les résultats de l'élection présidentielle en France ?", type: "single", answers: ["Conseil d'État", "Conseil constitutionnel", "Cour de cassation", "Assemblée nationale"], correct: 1, points: 1, bonus: { question: "Quand aura lieu la prochaine élection présidentielle en France ?", correct: ["2027"], points: 0.5 } },
      { id: "hg7", question: "Lesquels de ces dieux appartiennent à la mythologie égyptienne ?", type: "multiple", answers: ["Râ", "Anubis", "Apollon", "Osiris"], correct: [0, 1, 3], points: 1 },
      { id: "hg8", question: "Laquelle de ces inventions est la plus ancienne ?", type: "single", answers: ["Photographie", "Téléphone", "Radio", "Télévision"], correct: 0, points: 1 },
      { id: "hg9", question: "La Préhistoire prend fin avec :", type: "single", answers: ["La disparition des dinosaures", "L'invention de l'écriture", "La chute de l'empire romain", "L'invention des smartphones"], correct: 1, points: 1 },
      { id: "hg10", question: "Quel est le plus grand désert du monde par sa superficie ?", type: "single", answers: ["Sahara", "Gobi", "Antarctique", "Kalahari"], correct: 2, points: 1 }
    ]
  },
  arts: {
    name: "Arts et Divertissements",
    totalPoints: 12,
    questions: [
      { id: "art1", question: "Quel est l'autre nom donné à la Joconde ?", type: "single", answers: ["Lisa Maria", "Mona Lisa", "Dona Amalia", "Il n'y en a pas d'autre"], correct: 1, points: 1, bonus: { question: "Qui a peint La Joconde ?", correct: ["Léonard de Vinci", "Leonard de Vinci", "De Vinci", "Vinci"], points: 0.5 } },
      { id: "art2", question: "Lesquels de ces films sont l'adaptation d'une œuvre littéraire ?", type: "multiple", answers: ["Le Comte de Monte-Cristo", "Hunger Games", "Harry Potter", "Dune"], correct: [0, 1, 2, 3], points: 1 },
      { id: "art3", question: "Qui a sculpté le Penseur de Rodin ?", type: "single", answers: ["Léonard de Vinci", "Picasso", "Rodin", "Camille Claudel"], correct: 2, points: 1 },
      { id: "art4", question: "Lequel de ces longs métrages de Walt Disney est le plus ancien ?", type: "single", answers: ["La Petite Sirène", "La Belle et la Bête", "Blanche-Neige", "Peter Pan"], correct: 2, points: 1 },
      { id: "art5", question: "Pour quelle série Owen Cooper a-t-il été le plus jeune acteur à recevoir un Emmy Awards à seulement 15 ans ?", type: "single", answers: ["Stranger Things", "La chronique des Bridgerton", "Mercredi", "Adolescence"], correct: 3, points: 1 },
      { id: "art6", question: "Quelle information est fausse concernant la Vénus de Milo ?", type: "single", answers: ["Il lui manque les deux bras", "Il lui manque la tête", "Un drapé lui couvre le bas du corps", "Elle est seins nus"], correct: 1, points: 1 },
      { id: "art7", question: "Quels sont les points communs entre The Voice, Star Academy, NRJ Music Awards ?", type: "multiple", answers: ["Ils sont animés par la même personne", "Ils sont diffusés sur TF1", "Ils sont tournés à Cannes", "Ils sont dédiés à la chanson"], correct: [0, 1, 3], points: 1, bonus: { question: "Qui les présente ?", correct: ["Nikos Aliagas", "Nikos", "Aliagas"], points: 0.5 } },
      { id: "art8", question: "Quel peintre a donné son nom à une couleur ?", type: "single", answers: ["Yves Klein", "Claude Monet", "Gustave Klimt", "Salvador Dalí"], correct: 0, points: 1, bonus: { question: "Quelle est cette couleur ?", correct: ["bleu", "bleu Klein"], points: 0.5 } },
      { id: "art9", question: "Quel écrivain est l'auteur de « Vingt mille lieues sous les mers » ?", type: "single", answers: ["Jules Verne", "Guy de Maupassant", "Émile Zola", "Victor Hugo"], correct: 0, points: 1 },
      { id: "art10", question: "Quelle chanteuse francophone interprète le titre « Ensemble » aux côtés d'Aliocha Schneider ?", type: "single", answers: ["Angèle", "Aya Nakamura", "Charlotte Cardin", "Clara Luciani"], correct: 2, points: 1 },
      { id: "art11", question: "Qui est le nouveau directeur artistique des collections femme et homme chez Dior ?", type: "single", answers: ["Maria Grazia Chiuri", "Jonathan Anderson", "Karl Lagerfeld", "Hedi Slimane"], correct: 1, points: 1 },
      { id: "art12", question: "Quel est le youtubeur français qui cumule à ce jour le plus d'abonnés sur YouTube ?", type: "single", answers: ["Tibo InShape", "Squeezie", "Loft Girl", "Cyprien"], correct: 0, points: 1 }
    ]
  },
  sciences: {
    name: "Sciences",
    totalPoints: 6,
    questions: [
      { id: "sci1", question: "Quel composant du corps humain transporte l'oxygène dans le sang grâce à l'hémoglobine ?", type: "single", answers: ["Les globules blancs", "Les plaquettes", "Le plasma", "Les globules rouges"], correct: 3, points: 1 },
      { id: "sci2", question: "Pourquoi la Lune présente-t-elle des phases (croissant, quartier, pleine Lune) ?", type: "single", answers: ["La Lune change de taille tous les 28 jours", "Les phases varient selon la distance entre la Lune et la Terre", "Elles dépendent de la portion de Lune éclairée par le Soleil et visible depuis la Terre", "Des nuages interstellaires la recouvrent occasionnellement"], correct: 2, points: 1 },
      { id: "sci3", question: "Une année bissextile compte combien de jours ?", type: "text", correct: ["366", "366 jours"], points: 1 },
      { id: "sci4", question: "Quel est l'aliment qui ne pourrit jamais, même après 3000 ans ?", type: "single", answers: ["Le fromage", "Le miel", "Le chocolat", "Un vieux burger oublié sous un lit"], correct: 1, points: 1 },
      { id: "sci5", question: "Sur une bicyclette classique, laquelle des deux roues est motrice ?", type: "single", answers: ["Les deux roues", "La roue avant", "La roue arrière", "Aucune"], correct: 2, points: 1 },
      { id: "sci6", question: "En mathématiques, un nombre premier est un nombre…", type: "single", answers: ["Pair", "Plus grand que 10", "Qui se termine par 1", "Divisible uniquement par 1 et lui-même"], correct: 3, points: 1, bonus: { question: "Quel est le nombre premier qui arrive juste après 17 ?", correct: ["19"], points: 0.5 } }
    ]
  },
  probleme: {
    name: "Problème",
    totalPoints: 3,
    questions: [
      { id: "prob1", question: "Si l'avion qui vous a emmené en Martinique volait à 840 km/h, quelle distance avez-vous parcouru en 2h15 ?", type: "text", correct: ["1890", "1890 km", "1890km", "1 890 km"], points: 3 }
    ]
  },
  miss: {
    name: "Le monde des Miss",
    totalPoints: 4,
    questions: [
      { id: "miss1", question: "Quelle est l'année de règne de la première Miss Martinique élue Miss France ?", type: "text", correct: ["2025"], points: 1 },
      { id: "miss2", question: "Combien de Miss France Jean-Pierre Foucault a-t-il déjà couronnées ?", type: "text", correct: ["30"], points: 1 },
      { id: "miss3", question: "En quelle année Camille Cerf a-t-elle été élue Miss France ?", type: "text", correct: ["2014", "2015", "6 décembre 2014"], points: 1, info: "Elle est Miss France 2015, élue le 6 décembre 2014" },
      { id: "miss4", question: "Dans quelle ville aura lieu l'élection de Miss Univers dans quelques jours ?", type: "text", correct: ["Pak Kret", "Bangkok", "Thaïlande"], points: 1 }
    ]
  },
  francais: {
    name: "Français",
    totalPoints: 10,
    questions: [
      { id: "fr1", question: "Combien pèse un éléphant ?", type: "single", answers: ["Trois cent kilos", "Trois cents kilos"], correct: 1, points: 1 },
      { id: "fr2", question: "Et un hippopotame ?", type: "single", answers: ["Trois cent cinquante kilos", "Trois cents cinquante kilos"], correct: 0, points: 1 },
      { id: "fr3", question: "Pour l'Académie française, que dit-on fréquemment, bien que cela soit une faute ?", type: "single", answers: ["En vélo", "À cheval", "En voiture"], correct: 0, points: 1 },
      { id: "fr4", question: "Quel mot n'est pas du genre masculin ?", type: "single", answers: ["Hémisphère", "Tentacule", "Pétale", "Octave"], correct: 3, points: 1 },
      { id: "fr5", question: "Complétez : \"Il ne faut pas en faire tout un...\"", type: "text", correct: ["fromage"], points: 0.5 },
      { id: "fr5b", question: "Complétez : \"Rira bien qui rira...\"", type: "text", correct: ["le dernier"], points: 0.5 },
      { id: "fr5c", question: "Complétez : \"Il ne faut pas se mettre ... en tête\"", type: "text", correct: ["martel"], points: 0.5 },
      { id: "fr5d", question: "Complétez : \"Ça ne casse pas trois pattes...\"", type: "text", correct: ["à un canard", "a un canard"], points: 0.5 },
      { id: "fr6", question: "Quel mot se termine toujours par un « S » au singulier comme au pluriel ?", type: "multiple", answers: ["Bigoudis", "Canaris", "Soucis"], correct: [0, 1, 2], points: 1 },
      { id: "fr7", question: "Dans quelle phrase y a-t-il une faute ?", type: "single", answers: ["Tu as été élue", "Vous avez été sacrée", "Nous avons été photographié", "Elles ont été sauvées"], correct: 2, points: 1 },
      { id: "fr8", question: "Comment écrire : « je veux faire ……… de la bande » ?", type: "single", answers: ["Parti", "Partis", "Partie", "Partit"], correct: 2, points: 1 },
      { id: "fr9", question: "Lequel de ces mots n'est pas un palindrome ?", type: "single", answers: ["Rêver", "Rire", "Stats", "Coloc"], correct: 1, points: 1 },
      { id: "fr10", question: "Les abeilles sont importantes pour l'agriculture surtout parce qu'elles…", type: "single", answers: ["Pollonisent les plantes", "Pollinisent les plantes", "Pallonisent les plantes", "Polonnisent les plantes"], correct: 1, points: 1 }
    ]
  },
  anglais: {
    name: "Anglais",
    totalPoints: 10,
    questions: [
      { id: "en1", question: "Which letter doesn't appear in the name of any U.S. state?", type: "single", answers: ["Q", "Z", "X", "J"], correct: 0, points: 1 },
      { id: "en2", question: "How many sides are there on a french STOP sign?", type: "single", answers: ["3 sides", "6 sides", "8 sides", "10 sides"], correct: 2, points: 1 },
      { id: "en3", question: "How long is the presidential term in the United States?", type: "single", answers: ["3 years", "4 years", "5 years", "7 years"], correct: 1, points: 1 },
      { id: "en4", question: "A t-shirt costs €16. There is a 25% discount throughout the store. You also get an additional €3 off. How much will you pay for the t-shirt?", type: "text", correct: ["9", "9€", "9 euros", "9 €"], points: 1 },
      { id: "en5", question: "In what year did the first man walk on the Moon?", type: "single", answers: ["1967", "1969", "1971", "1973"], correct: 1, points: 1, bonus: { question: "Who was he?", correct: ["Neil Armstrong", "Armstrong"], points: 0.5 } },
      { id: "en6", question: "Complete: \"Every year, Miss France ... a beautiful crown.\" (Use the verb To wear)", type: "text", correct: ["wears"], points: 1 },
      { id: "en7", question: "Complete: \"I .... to become Miss France when I was a little girl.\" (past tense)", type: "text", correct: ["dreamed", "wished", "wanted"], points: 1 },
      { id: "en8", question: "Complete: \"This is ... amazing opportunity for all the contestants.\"", type: "text", correct: ["an"], points: 1 },
      { id: "en9", question: "Complete: \"The candidates come .... all regions of France.\"", type: "text", correct: ["from"], points: 1 },
      { id: "en10", question: "Complete: \"The crown is .... than last year's.\" (Use shine)", type: "text", correct: ["shinier"], points: 1 }
    ]
  },
  logique: {
    name: "Logique",
    totalPoints: 3,
    questions: [
      { id: "log1", question: "Quel mot peut-on associer à ces trois définitions : Un novice, une combinaison de travail, une couleur.", type: "single", answers: ["Rouge", "Bleu", "Blanc", "Jaune"], correct: 1, points: 1 },
      { id: "log6", question: "3 poissons sont dans un seau. L'un meurt. Combien en reste-t-il ?", type: "text", correct: ["3"], points: 1, info: "Il est mort mais toujours dans le seau !" },
      { id: "log7", question: "Si avant-hier on était mardi, quel jour serons-nous après-demain ?", type: "text", correct: ["samedi", "Samedi"], points: 1 }
    ]
  }
};

module.exports = {
  year: 2027,                          // Titre décerné : Miss France 2027
  electionDate: '2026-12-12',          // Date de la soirée
  venue: 'Futuroscope Arena (Vienne)',
  cultureGLabel: 'Le vrai test passé par les candidates Miss France 2026 (le questionnaire 2027 arrive bientôt !)',
  candidates,
  quizQuestions,
  cultureGQuestions
};
