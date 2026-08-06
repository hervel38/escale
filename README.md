# Escale

Guide de phrases + révision espacée + test, en PWA installable, **entièrement hors-ligne**.
87 phrases de voyage sur 8 situations, en français, traduites en **espagnol et
anglais**. On bascule de langue dans l'application, et **chaque langue garde sa
propre progression**.

```
index.html               application complète (contenu + interface + logique)
manifest.webmanifest     métadonnées d'installation
sw.js                    service worker (cache hors-ligne)
icon-192.png             icônes
icon-512.png
icon-maskable-512.png
```

---

## Comment ça marche, en une phrase

Cette app **ne s'installe pas depuis un magasin**. On dépose ses fichiers sur un
hébergeur web, ce qui produit **une adresse (URL)** ; on ouvre cette adresse
dans Chrome **sur le téléphone**, et Chrome propose de l'installer comme une
application. D'où l'enchaînement en trois temps ci-dessous.

> **Pourquoi un hébergeur ?** L'installation et le mode hors-ligne exigent une
> adresse **https://**. Un fichier ouvert directement depuis le téléphone
> (`file://…`) s'affiche mais **ne s'installe pas**. L'hébergement est donc
> obligatoire, mais il est gratuit et ne demande pas de connaissances
> techniques par la voie ci-dessous.

---

## Étape 1 — Mettre les fichiers en ligne (une seule fois, de préférence sur ordinateur)

Voie la plus simple, **sans terminal ni compte GitHub : Netlify Drop.**

1. Sur un ordinateur, ouvrir **https://app.netlify.com/drop**.
2. Glisser-déposer le **dossier `escale`** (celui qui contient `index.html` et
   les autres fichiers) dans la zone indiquée.
3. Au bout de quelques secondes, Netlify affiche **une adresse** du type
   `https://escale-a1b2c3.netlify.app`. **C'est ton URL.** Note-la.

C'est tout : les fichiers sont en ligne, en https, gratuitement. (Un compte
gratuit est proposé pour conserver le site dans le temps ; sans compte, l'adresse
reste active mais temporaire.)

*Alternative* si tu préfères GitHub Pages : pousser les fichiers sur un dépôt,
puis **Settings → Pages → Deploy from a branch → main / (root)**. L'URL est alors
`https://<compte>.github.io/escale/`. Un dépôt **privé** requiert un plan payant
pour Pages ; Netlify Drop reste gratuit et privé.

---

## Étape 2 — Ouvrir cette URL sur le téléphone Android

1. **Sur le téléphone**, connecté en **WiFi ou en 4G/5G, peu importe** (ce
   premier chargement pèse environ 45 Ko, c'est indolore même en données
   mobiles).
2. Ouvrir l'application **Chrome**.
3. Taper — ou mieux, se faire envoyer par message et cliquer — **l'adresse
   obtenue à l'étape 1** (`https://escale-….netlify.app`).
4. L'application s'affiche.

Une connexion n'est nécessaire **que pour cette première ouverture** : elle sert
à télécharger l'app et à remplir son cache hors-ligne. Ensuite, plus besoin de
réseau.

---

## Étape 3 — Installer sur l'écran d'accueil

1. Dans Chrome, sur la page de l'app : menu **⋮** (en haut à droite) →
   **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
2. Confirmer. Une **icône Escale** apparaît dans le tiroir d'applications, comme
   n'importe quelle app.
3. La lancer une fois **avec du réseau** pour finir de constituer le cache.
   Après ça, elle fonctionne **sans connexion**, y compris à l'étranger.

Aucun APK, aucune signature, aucun réglage « sources inconnues », aucun compte
développeur. Les règles de vérification des développeurs Android qui encadrent le
sideload d'APK ne concernent pas les PWA.

> **Si l'option « Installer » n'apparaît pas :** vérifier que l'adresse commence
> bien par **https://** et non `http://` ou un chemin de fichier. Sur une adresse
> non sécurisée, Chrome n'offre pas l'installation.


---

## Voix hors-ligne (optionnel)

La prononciation utilise le moteur de synthèse vocale d'Android. Pour qu'elle
fonctionne **sans réseau**, le pack vocal de la langue visée doit être présent
sur l'appareil — **espagnol et/ou anglais**, selon les langues utilisées :

**Paramètres → Système → Langues et saisie → Sortie de synthèse vocale →
Moteur (Google) → Installer les données vocales → Espagnol** (et **Anglais**)

L'écran **Réglages** de l'app indique, pour la langue active, quelle voix a été
détectée ou signale son absence. Chaque pack est nettement plus lourd que l'app
elle-même (quelques dizaines de Mo) et sert à tout le système, pas seulement à
Escale. Ils sont facultatifs : sans eux, l'app fonctionne, seule la lecture à
voix haute est indisponible hors ligne.

---

## Basculer de langue

Dans l'app, deux façons de changer de langue : la **pastille** en haut à droite
(elle fait défiler les langues), ou le segment **« Langue cible »** dans
**Réglages**. Chaque langue a sa propre progression, indépendante des autres.

## Ajouter une langue ou enrichir le corpus

Tout le contenu tient dans le premier `<script>` de `index.html`, entre les
bandeaux `CONTENU` et `FIN DU CONTENU`. Rien d'autre n'est à toucher.

**Ajouter une langue** (par ex. l'italien) = deux gestes : une entrée dans
`LANGUES`, puis une clé `it` dans le `tr` de **chaque** phrase.

```js
const LANGUES = {
  es: { nom:"Espagnol", cible:"ES", bcp47:"es-ES", guide:"…" },
  en: { nom:"Anglais",  cible:"EN", bcp47:"en-GB", guide:"…" },
  it: { nom:"Italien",  cible:"IT", bcp47:"it-IT", guide:"…" }   // ← ajout
};

const ITEMS = [
  { id:"b1", cat:"base", fr:"Bonjour",
    tr:{ es:{ m:"Buenos días",  ph:"BOUEnoss DIass" },
         en:{ m:"Good morning", ph:"goud MOR-ninng" },
         it:{ m:"Buongiorno",   ph:"bouonDJORno" } } },           // ← ajout
  …
];
```

Points d'attention :

- Le français (`fr`) est **partagé** par toutes les langues. Ne le dupliquez pas
  par langue. Exception rare : si le texte français nomme la langue cible, on
  peut le surcharger pour une langue via `tr[<code>].fr` (c'est le cas de deux
  phrases seulement, `b7` et `b11`).
- Chaque langue déclarée dans `LANGUES` doit être présente dans le `tr` de
  **toutes** les phrases, sinon celles qui manquent planteront à l'affichage.
- Les `id` doivent être **uniques et stables** : c'est la clé de la progression
  enregistrée. Changer un `id` remet la phrase à zéro, dans toutes les langues.
- Dans `ph`, la syllabe en majuscules porte l'accent tonique. C'est la
  convention retenue ici, pas un standard.

Après modification, **incrémenter `CACHE` dans `sw.js`** (`escale-v1` →
`escale-v2`), sinon l'ancienne version continuera d'être servie depuis le cache.

---

## Répétition espacée

Cinq boîtes façon Leitner, intervalles en jours définis en tête de script :

```js
const INTERVALLES = [0, 1, 3, 7, 21];
```

- **Acquis** → boîte +1, réapparition après l'intervalle de la nouvelle boîte
- **Presque** → boîte inchangée, réapparition après le même intervalle
- **À revoir** → retour en boîte 1

Ces valeurs sont un réglage de départ choisi pour un usage court avant départ,
pas une constante canonique. Elles se modifient librement.

---

## Stockage

Les préférences (langue active, sens de révision, voix) sont dans `escale.meta` ;
la progression et les favoris de chaque langue dans une clé `escale.<langue>`
distincte (`escale.es`, `escale.en`…). D'où l'isolement des progressions. L'accès
est encapsulé dans un adaptateur qui bascule sur une mémoire volatile si
`localStorage` est indisponible (navigation privée, iframe cloisonnée) : l'app
reste utilisable, mais ne conserve rien.

L'option **Effacer** de l'écran Réglages ne remet à zéro que la **langue
active** ; pour tout effacer, videz les données du site depuis le navigateur.

Aucune donnée ne sort de l'appareil. Aucun réseau n'est sollicité après le
premier chargement.
