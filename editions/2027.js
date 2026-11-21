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
// QUESTIONNAIRE CULTURE G — test officiel passé par les candidates Miss France 2027
// (publié le 20 novembre 2026 ; questions : 75secondes.fr, corrigé : alouette.fr).
// Écarts avec le test officiel (80 points) :
//  - la question des 4 silhouettes d'actrices (images) n'est pas reprise ;
//  - seules 5 des 10 énigmes de logique ont été publiées ;
//  - les corrigés Anglais et Logique ne sont pas publiés : réponses établies par nos soins.
// Types : "single" (correct = index), "multiple" (correct = [index]), "text" (correct = [réponses acceptées]).
// ============================================================
const cultureGQuestions = {
  actualite: {
    name: "Actualités",
    totalPoints: 11,
    questions: [
      { id: "actu1", question: "Lors des élections de mi-mandat de novembre 2026 aux États-Unis, quel parti a remporté la majorité des sièges à la Chambre des représentants ?", type: "single", answers: ["Le Parti républicain", "Le Parti libertarien", "Le Parti démocrate", "Le Parti vert"], correct: 2, points: 1 },
      { id: "actu2", question: "Pourquoi Emmanuel Macron ne peut-il pas se présenter à l'élection présidentielle de 2027 ?", type: "single", answers: ["Parce qu'il faut avoir moins de 50 ans", "Parce que la Constitution limite à deux les mandats consécutifs", "Parce qu'un ancien président doit attendre dix ans avant de se représenter", "Parce que le président est désormais élu par le Parlement"], correct: 1, points: 1 },
      { id: "actu3", question: "Dans quel département de Nouvelle-Aquitaine un incendie exceptionnel a-t-il parcouru environ 42 000 hectares durant l'été 2026 ?", type: "single", answers: ["La Dordogne", "La Corrèze", "La Charente", "La Gironde"], correct: 3, points: 1 },
      { id: "actu4", question: "Comment s'appelait la mission spatiale de Sophie Adenot en 2026 ?", type: "single", answers: ["Artémis", "Epsilon", "Odysseus", "Spoutnik"], correct: 1, points: 1 },
      { id: "actu5", question: "Quel anniversaire a été commémoré en France le 14 juillet 2026, en hommage aux victimes d'un attentat terroriste ?", type: "single", answers: ["Les cinq ans de l'attentat de Strasbourg", "Les dix ans de l'attentat de Nice", "Les quinze ans des attentats de Paris", "Les vingt ans de l'attentat de Toulouse"], correct: 1, points: 1 },
      { id: "actu6", question: "Qui est le nouveau directeur de la Star Academy ?", type: "single", answers: ["Michael Goldman", "Mosimann", "Nikos", "Florent Pagny"], correct: 1, points: 1 },
      { id: "actu7", question: "Quelle footballeuse a remporté le Ballon d'Or féminin 2026 ?", type: "single", answers: ["Aitana Bonmatí", "Sam Kerr", "Ada Hegerberg", "Alexia Putellas"], correct: 3, points: 1 },
      { id: "actu8", question: "Dans quels pays s'est déroulée la Coupe du monde de football 2026 ? (plusieurs réponses attendues)", type: "multiple", answers: ["États-Unis", "Canada", "Espagne", "Mexique"], correct: [0, 1, 3], points: 1 },
      { id: "actu9", question: "Quelle artiste a remporté quatre trophées aux Victoires de la musique 2026 ?", type: "single", answers: ["Helena", "Charlotte Cardin", "Theodora", "Santa"], correct: 2, points: 1 },
      { id: "actu10", question: "Quel artiste détient, après l'édition 2026, le record du nombre total de trophées remportés depuis la création des NRJ Music Awards ?", type: "single", answers: ["Gims", "M. Pokora", "David Guetta", "Kendji Girac"], correct: 1, points: 1 },
      { id: "actu11", question: "Quel magazine de télévision, partenaire officiel de Miss France, fête ses 40 ans en 2026 ?", type: "single", answers: ["Télé 7 Jours", "Télé-Loisirs", "Télé Star", "Paris Match"], correct: 1, points: 1 }
    ]
  },
  numerique: {
    name: "Numérique & web",
    totalPoints: 5,
    questions: [
      { id: "num1", question: "Le Z Event, dont l'ultime édition s'est tenue en septembre 2026, est avant tout…", type: "single", answers: ["Un tournoi d'e-sport", "Un marathon caritatif en streaming", "Un festival de musique électronique", "Une cérémonie récompensant les influenceurs"], correct: 1, points: 1 },
      { id: "num2", question: "Quelle créatrice de contenu, devenue célèbre en reproduisant des silhouettes de haute couture avec des vêtements de seconde main, a défilé pour Chanel en 2026 ?", type: "single", answers: ["Rachel Ojuromi (@giverachelashot)", "Léna Mahfouf (@lenamahfouf)", "Nava Rose (@the.navarose)", "Angelica Hicks (@angelicahicks)"], correct: 0, points: 1 },
      { id: "num3", question: "En 2026, quel âge était au cœur des débats français sur la limitation de l'accès aux réseaux sociaux pour les mineurs ?", type: "single", answers: ["13 ans", "15 ans", "16 ans", "18 ans"], correct: 1, points: 1 },
      { id: "num4", question: "Quel numéro national peut être contacté en France pour obtenir de l'aide face au cyberharcèlement ?", type: "single", answers: ["3018", "3637", "112", "3630"], correct: 0, points: 1 },
      { id: "num5", question: "Un « deepfake » est…", type: "single", answers: ["Un logiciel qui protège les données personnelles", "Un système de paiement crypté", "Un compte anonyme sur un réseau social", "Une image, une vidéo ou un son truqué grâce notamment à l'IA"], correct: 3, points: 1 }
    ]
  },
  arts: {
    name: "Arts",
    totalPoints: 8,
    questions: [
      { id: "art1", question: "Qui a créé la saga cinématographique Star Wars ?", type: "single", answers: ["James Cameron", "George Lucas", "Christopher Nolan", "Steven Spielberg"], correct: 1, points: 1 },
      { id: "art2", question: "Dans Le Dîner de cons, quelle passion occupe François Pignon pendant son temps libre ?", type: "single", answers: ["Construire des maquettes en allumettes", "Collectionner des nains de jardin", "Dresser des pigeons voyageurs", "Fabriquer des meubles pour maisons de poupées"], correct: 0, points: 1 },
      { id: "art3", question: "Quelle actrice interprète Mercredi Addams dans la série Mercredi ?", type: "single", answers: ["Zendaya", "Sydney Sweeney", "Jenna Ortega", "Millie Bobby Brown"], correct: 2, points: 1 },
      { id: "art4", question: "Quel acteur de la série Stranger Things connaît également un grand succès dans la musique sous le nom de Djo ?", type: "single", answers: ["Finn Wolfhard", "Charlie Heaton", "Noah Schnapp", "Joe Keery"], correct: 3, points: 1 },
      { id: "art5", question: "À quel compositeur doit-on Les Quatre Saisons ?", type: "single", answers: ["Mozart", "Beethoven", "Vivaldi", "Chopin"], correct: 2, points: 1 },
      { id: "art6", question: "Frida Kahlo était originaire de quel pays ?", type: "single", answers: ["Espagne", "Mexique", "Argentine", "Chili"], correct: 1, points: 1 },
      { id: "art7", question: "Claude Monet est l'une des grandes figures de quel mouvement artistique pictural ?", type: "single", answers: ["Le cubisme", "Le pop art", "Le surréalisme", "L'impressionnisme"], correct: 3, points: 1 },
      { id: "art8", question: "Dans Les Misérables, pour quelle raison Jean Valjean est-il initialement condamné au bagne ?", type: "single", answers: ["Il a participé à une révolte contre le roi.", "Il a volé un pain pour nourrir des enfants.", "Il a été accusé d'un meurtre qu'il n'a pas commis.", "Il a tenté de voler la couronne de France."], correct: 1, points: 1 }
    ]
  },
  mode: {
    name: "Mode",
    totalPoints: 4,
    questions: [
      { id: "mode1", question: "À la fin du XIXe siècle, quelle activité a particulièrement contribué à faire accepter le port de la culotte bouffante et du pantalon chez les femmes ?", type: "single", answers: ["La danse classique", "La bicyclette", "L'escrime", "Le théâtre"], correct: 1, points: 1 },
      { id: "mode2", question: "À quoi servait à l'origine la toute petite poche située à l'avant d'un jean Levi's, dont la première version a été créée en 1873 ?", type: "single", answers: ["À ranger une montre de poche", "À conserver une pièce pour le téléphone", "À ranger un ticket de train", "À transporter une miniature de parfum"], correct: 0, points: 1 },
      { id: "mode3", question: "Quel couturier a popularisé le smoking féminin dans les années 1960 ?", type: "single", answers: ["Jean Paul Gaultier", "Pierre Cardin", "Stella McCartney", "Yves Saint Laurent"], correct: 3, points: 1 },
      { id: "mode4", question: "Matthieu Blazy dirige aujourd'hui la création de quelle maison ?", type: "single", answers: ["Chanel", "Dior", "Balmain", "Zara"], correct: 0, points: 1 }
    ]
  },
  histoire: {
    name: "Histoire & citoyenneté",
    totalPoints: 10,
    questions: [
      { id: "hist1", question: "Quel roi est associé à la Révolution française ?", type: "single", answers: ["Louis XIV", "Louis XV", "Louis XVI", "Louis XVIII"], correct: 2, points: 1 },
      { id: "hist2", question: "En 1791, quelle femme rédige la Déclaration des droits de la femme et de la citoyenne ?", type: "single", answers: ["Simone Veil", "Louise Michel", "Olympe de Gouges", "Simone de Beauvoir"], correct: 2, points: 1 },
      { id: "hist3", question: "Quel monument était flambant neuf à l'Exposition universelle de Paris en 1889 ?", type: "single", answers: ["L'Arc de Triomphe", "Le Sacré-Cœur", "La pyramide du Louvre", "La tour Eiffel"], correct: 3, points: 1 },
      { id: "hist4", question: "Le 18 juin 1940, le général de Gaulle a lancé son célèbre appel depuis…", type: "single", answers: ["Alger", "Londres", "Paris", "Washington"], correct: 1, points: 1 },
      { id: "hist5", question: "Selon l'article 1er de la Constitution française, comment la République française est-elle définie ?", type: "single", answers: ["Une République fédérale, laïque et monarchique", "Une République fédérale, démocratique et sociale", "Une République indivisible, laïque, démocratique et sociale", "Une République indivisible, monarchique et sociale"], correct: 2, points: 1 },
      { id: "hist6", question: "Lequel de ces événements a eu lieu en premier ?", type: "single", answers: ["Mai 68", "Les premiers pas de l'Homme sur la Lune", "La chute du mur de Berlin", "La mise en circulation de l'euro"], correct: 0, points: 1 },
      { id: "hist7", question: "Quel grand conflit mondial a pris fin en 1918 ?", type: "single", answers: ["La guerre de Cent Ans", "La guerre froide", "La Première Guerre mondiale", "La Seconde Guerre mondiale"], correct: 2, points: 1 },
      { id: "hist8", question: "Lorsque les médias annoncent qu'une réunion a lieu « à Matignon », qui travaille normalement dans ce bâtiment ?", type: "single", answers: ["Le président de la République", "Le Premier ministre", "Le président de l'Assemblée nationale", "Le ministre de la Justice"], correct: 1, points: 1 },
      { id: "hist9", question: "En France, si le président de la République démissionne, qui assure provisoirement ses fonctions ?", type: "single", answers: ["Le Premier ministre", "Le président de l'Assemblée nationale", "Le président du Sénat", "Le ministre de l'Intérieur"], correct: 2, points: 1 },
      { id: "hist10", question: "Combien d'étoiles compte le drapeau de l'Union européenne ?", type: "single", answers: ["12", "21", "27", "32"], correct: 0, points: 1 }
    ]
  },
  regions: {
    name: "France & régions",
    totalPoints: 4,
    questions: [
      { id: "reg1", question: "Avec quel pays la France partage-t-elle sa plus longue frontière terrestre ?", type: "single", answers: ["L'Espagne", "L'Allemagne", "La Belgique", "Le Brésil"], correct: 3, points: 1 },
      { id: "reg2", question: "Grâce à ses territoires ultramarins, la France est présente dans combien des trois océans : Atlantique, Indien et Pacifique ?", type: "single", answers: ["Un seul", "Deux", "Trois", "Aucun"], correct: 2, points: 1 },
      { id: "reg3", question: "Laquelle de ces traditions françaises est inscrite au patrimoine culturel immatériel de l'UNESCO ?", type: "single", answers: ["Le repas gastronomique des Français", "La galette des rois", "La chasse aux œufs de Pâques", "Le réveillon du Nouvel An"], correct: 0, points: 1 },
      { id: "reg4", question: "Comment s'appelle la danse traditionnelle tahitienne, notamment mise à l'honneur lors du Heiva i Tahiti ?", type: "single", answers: ["Le haka", "Le 'ori Tahiti", "Le maloya", "Le séga"], correct: 1, points: 1 }
    ]
  },
  miss: {
    name: "Histoire des Miss",
    totalPoints: 3,
    questions: [
      { id: "miss1", question: "Quelle Miss France a été la première élue lors d'une élection retransmise en direct à la télévision ?", type: "single", answers: ["Sophie Thalmann", "Nathalie Marquay", "Linda Hardy", "Mareva Galanter"], correct: 1, points: 1 },
      { id: "miss2", question: "En quelle année le concours Miss World a-t-il été créé ?", type: "single", answers: ["1945", "1951", "1962", "1970"], correct: 1, points: 1 },
      { id: "miss3", question: "Qui a été sacrée Miss France au Futuroscope ? (plusieurs réponses attendues)", type: "multiple", answers: ["Rachel Legrain-Trapani", "Patricia Spehar", "Angélique Angarni-Filopon", "Malika Ménard"], correct: [0, 1, 2], points: 1 }
    ]
  },
  sciences: {
    name: "Sciences",
    totalPoints: 6,
    questions: [
      { id: "sci1", question: "Quel est le plus grand organe du corps humain ?", type: "single", answers: ["Le foie", "Les poumons", "La peau", "L'intestin"], correct: 2, points: 1 },
      { id: "sci2", question: "Les antibiotiques sont conçus principalement pour lutter contre…", type: "single", answers: ["Les virus", "Les bactéries", "Les allergies", "Les champignons uniquement"], correct: 1, points: 1 },
      { id: "sci3", question: "Une pieuvre possède huit bras. Mais combien de cœurs a-t-elle ?", type: "single", answers: ["Un", "Deux", "Trois", "Huit"], correct: 2, points: 1 },
      { id: "sci4", question: "Le son peut-il se propager dans le vide ?", type: "single", answers: ["Oui, plus vite", "Oui, plus lentement", "Non", "Uniquement à très haute fréquence"], correct: 2, points: 1 },
      { id: "sci5", question: "Lors d'un orage, pourquoi voit-on généralement l'éclair avant d'entendre le tonnerre ?", type: "single", answers: ["Parce que l'éclair se produit avant le tonnerre", "Parce que la lumière se déplace plus vite que le son", "Parce que le vent ralentit le son", "Parce que le tonnerre vient des nuages plus élevés"], correct: 1, points: 1 },
      { id: "sci6", question: "Un produit coûte 120 €. Après une réduction de 20 %, son prix augmente de 25 %. Quel est son prix final ?", type: "single", answers: ["115 €", "120 €", "125 €", "130 €"], correct: 1, points: 1 }
    ]
  },
  francais: {
    name: "Français",
    totalPoints: 8,
    questions: [
      { id: "fr1", question: "Comment écrit-on 2 800 en toutes lettres ?", type: "single", answers: ["Deux milles huit cent", "Deux mille huit cent", "Deux milles huit cents", "Deux mille huit cents"], correct: 3, points: 1 },
      { id: "fr2", question: "Quelle phrase est correctement écrite ?", type: "single", answers: ["Elle est sensée arriver à 18 heures.", "Elle est censée arriver à 18 heures.", "Elle est censé arriver à 18 heures.", "Elle est sensé arriver à 18 heures."], correct: 1, points: 1 },
      { id: "fr3", question: "Laquelle de ces phrases est correcte ?", type: "single", answers: ["Il faut pallier à ce problème.", "Il faut pallier de ce problème.", "Il faut pallier ce problème.", "Il faut pallier avec ce problème."], correct: 2, points: 1 },
      { id: "fr4", question: "Quelle expression signifie « découvrir un secret » ?", type: "single", answers: ["Découvrir le poteau rose", "Découvrir le pot aux roses", "Découvrir le pot au rose", "Découvrir le poteau aux roses"], correct: 1, points: 1 },
      { id: "fr5", question: "Que désigne le mot « coquecigrue » ?", type: "single", answers: ["Une ancienne coiffure féminine", "Une danse folklorique", "Une idée extravagante ou une absurdité", "Une variété de poule"], correct: 2, points: 1 },
      { id: "fr6", question: "Parmi ces quatre expressions, laquelle n'est pas un pléonasme ?", type: "single", answers: ["Monter en haut", "Prévoir à l'avance", "Sortir dehors", "Monter sur scène"], correct: 3, points: 1 },
      { id: "fr7", question: "Lequel de ces prénoms n'est pas l'anagramme du nom d'un pays ?", type: "single", answers: ["Marco", "Liam", "Daniel", "Nabil"], correct: 2, points: 1, info: "Marco → Maroc, Liam → Mali, Nabil → Liban" },
      { id: "fr8", question: "Quelle est la forme correcte du verbe « résoudre » à la troisième personne du pluriel du présent de l'indicatif ?", type: "single", answers: ["Ils résolvent", "Ils résoudent", "Ils résoluent", "Ils résoudront"], correct: 0, points: 1 }
    ]
  },
  anglais: {
    name: "Anglais",
    totalPoints: 10,
    questions: [
      { id: "en1", question: "A Summer Abroad (1/8) — \"When Emma turned eighteen, she _____ (to decide) to spend a month in Ireland.\"", type: "single", answers: ["decide", "decided", "decides", "was deciding"], correct: 1, points: 1 },
      { id: "en2", question: "(2/8) — \"She _____ (never / to fly) on her own before, so she felt excited but also a little worried.\"", type: "single", answers: ["has never flown", "never flew", "had never flown", "had never flied"], correct: 2, points: 1 },
      { id: "en3", question: "(3/8) — \"At first, everyday conversations _____ (to be) difficult.\"", type: "single", answers: ["was", "were", "are", "been"], correct: 1, points: 1 },
      { id: "en4", question: "(4/8) — \"Emma was not used to speaking English all day, even though she had studied the language _____ she was twelve.\"", type: "single", answers: ["for", "since", "during", "from"], correct: 1, points: 1 },
      { id: "en5", question: "(5/8) — \"One afternoon, while she _____ (to walk) through a small town, she got lost.\"", type: "single", answers: ["walks", "was walking", "has walked", "had walked"], correct: 1, points: 1 },
      { id: "en6", question: "(6/8) — \"A woman invited her to a local music festival. There, Emma _____ (to meet) people from several countries.\"", type: "single", answers: ["met", "meeted", "meets", "has met"], correct: 0, points: 1 },
      { id: "en7", question: "(7/8) — \"By the end of the evening, she had made new _____ and felt much more confident.\"", type: "single", answers: ["friends", "friendly", "friend", "friendships"], correct: 0, points: 1 },
      { id: "en8", question: "(8/8) — \"Back home, Emma realised that the best part of her _____ had not been the places she visited.\"", type: "single", answers: ["trip", "travel", "way", "road"], correct: 0, points: 1 },
      { id: "en9", question: "About the text you just completed: what helped Emma become more confident?", type: "single", answers: ["Avoiding conversations with strangers", "Meeting people and dealing with an unexpected situation", "Studying English only from books", "Travelling with her family"], correct: 1, points: 1 },
      { id: "en10", question: "What is the main message of the text?", type: "single", answers: ["Travelling is enjoyable only when everything goes as planned.", "Learning a language is impossible without living abroad.", "New experiences can help people become more independent.", "Visiting famous places is the most important part of a trip."], correct: 2, points: 1 }
    ]
  },
  logique: {
    name: "Logique",
    totalPoints: 5,
    questions: [
      { id: "log1", question: "Un berger possède 17 moutons. Tous sauf 9 s'enfuient. Combien lui en reste-t-il ?", type: "single", answers: ["8", "9", "17", "0"], correct: 1, points: 1 },
      { id: "log2", question: "Dans une course, vous dépassez la personne qui est deuxième. À quelle place êtes-vous désormais ?", type: "single", answers: ["Première", "Deuxième", "Troisième", "Quatrième"], correct: 1, points: 1 },
      { id: "log3", question: "Dans une voiture, il y a 2 pères, 2 fils, 1 grand-père et 1 petit-fils. Combien y a-t-il de personnes dans la voiture ?", type: "single", answers: ["3", "4", "5", "6"], correct: 0, points: 1, info: "Un grand-père, son fils et son petit-fils" },
      { id: "log4", question: "5 machines fabriquent 5 objets en 5 minutes. Combien faut-il de temps à 100 machines identiques pour fabriquer 100 objets ?", type: "single", answers: ["1 minute", "5 minutes", "20 minutes", "100 minutes"], correct: 1, points: 1 },
      { id: "log5", question: "Deux pièces totalisent 30 centimes. L'une des deux n'est pas une pièce de 10 centimes. Quelles sont ces deux pièces ?", type: "single", answers: ["10 centimes et 20 centimes", "15 centimes et 15 centimes", "25 centimes et 5 centimes", "C'est impossible"], correct: 0, points: 1, info: "L'une n'est pas une pièce de 10 centimes… mais l'autre, si !" }
    ]
  }
};

module.exports = {
  year: 2027,                          // Titre décerné : Miss France 2027
  electionDate: '2026-12-12',          // Date de la soirée
  semiFinalists: 12,                   // Qualifiées au premier tour (12 en 2026, 15 certaines années) : à fixer AVANT l'ouverture des pronostics
  venue: 'Futuroscope Arena (Vienne)',
  cultureGLabel: 'Le vrai test passé par les candidates Miss France 2027',
  candidates,
  quizQuestions,
  cultureGQuestions
};
