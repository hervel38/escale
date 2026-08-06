# Escale — documentation technique

Cette documentation décrit **comment l'application est construite** et pourquoi.
Elle complète le `README.md`, qui couvre l'exploitation (déployer, installer,
changer de langue) sans redite ici.

Chaque affirmation ci-dessous a été relue sur le code livré. Les points que je
n'ai pas pu vérifier sur un appareil réel sont signalés explicitement comme
tels dans la section « Limites et incertitudes ».

---

## 1. En bref

Escale est une **PWA** (application web installable) mono-fichier pour la
logique applicative, sans backend, sans build, sans dépendance externe. Trois
usages : consulter un guide de phrases, réviser en répétition espacée, se tester
par QCM. Tout le contenu pédagogique est embarqué dans la page ; l'application
fonctionne intégralement hors-ligne après le premier chargement.

L'application est **multi-langue** : un même corpus de phrases **françaises** est
traduit vers plusieurs langues cibles (livré avec **espagnol** et **anglais**).
L'utilisateur bascule de langue depuis l'application, et **chaque langue conserve
sa propre progression**.

| Caractéristique | Valeur |
|---|---|
| Nature | PWA (HTML/CSS/JS statiques) |
| Dépendances runtime | Aucune (zéro bibliothèque) |
| Étape de build | Aucune |
| Backend | Aucun |
| Persistance | `localStorage`, sur l'appareil uniquement |
| Hors-ligne | Oui, via service worker |
| Contrainte de service | HTTPS obligatoire (ou `localhost`) |
| Contenu livré | 87 phrases françaises, 8 catégories, traduites en espagnol et anglais |
| Langues cibles | Espagnol, anglais (ajout d'une langue = données seules) |
| Progression | Isolée par langue |

Le choix de la PWA plutôt que d'un APK natif est documenté au niveau projet ;
en synthèse : pas de compilation, pas de signature, pas de compte développeur,
et une non-exposition aux règles de vérification des développeurs Android qui
encadrent le sideload d'APK.

---

## 2. Structure des fichiers

```
index.html               Application entière : contenu + interface + logique
manifest.webmanifest     Métadonnées d'installation (nom, icônes, couleurs)
sw.js                    Service worker — cache hors-ligne
icon-192.png             Icône 192×192 (usage général)
icon-512.png             Icône 512×512 (usage général)
icon-maskable-512.png    Icône 512×512 à zone de sécurité réduite (Android adaptatif)
README.md                Notice d'exploitation
DOCUMENTATION.md         Le présent document
```

`index.html` contient trois zones nettement séparées :

1. un **premier `<script>`** en tête de `<body>` : le contenu (données) —
   `ORIGINE`, `LANGUES`, `CATS`, `ITEMS` ;
2. un bloc **`<style>`** : le design system complet ;
3. un **second `<script>`** en fin de `<body>` : toute la logique applicative.

Cette séparation données / présentation / logique est délibérée : ajouter une
langue ou des phrases ne touche que la zone 1, retoucher l'apparence ne touche
que la zone 2.

---

## 3. Architecture d'exécution

Il n'y a pas de framework ni de routeur. L'architecture repose sur quatre
principes simples.

**Rendu par regénération de chaîne.** Chaque vue est reconstruite en assemblant
une chaîne HTML injectée via `innerHTML`. Il n'y a pas de DOM virtuel ni de
diffing : à l'échelle de l'application (une centaine de phrases), le coût est
négligeable et le code reste lisible d'un bout à l'autre.

**Un état unique en mémoire.** Un objet `S` porte tout l'état persistant
(progression, favoris, sens de révision, activation de la voix). Toute
modification passe par `S` puis `save()`. Aucune donnée d'état n'est dispersée
dans le DOM.

**Délégation d'événements unique.** Un seul `addEventListener("click", …)` sur
`document` traite l'ensemble des interactions, en identifiant la cible par
`closest(sélecteur)`. Conséquence importante : comme les vues sont regénérées,
aucun réattachement d'écouteur n'est nécessaire après un rendu.

**Quatre vues, une barre d'onglets.** Les sections `.view` sont toutes présentes
dans le DOM ; la navigation bascule la classe `.on`. La fonction `aller(vue)`
centralise ce basculement et déclenche le rendu de la vue concernée.

```
                    ┌──────────── S (état) ────────────┐
                    │  prog{}  favs[]  dir  tts         │
                    └───────┬───────────────────┬──────┘
                            │ save()            │ lecture
                            ▼                   │
                    localStorage           fonctions de rendu
                    (clé escale.<code>)         │
                                                ▼
   clic ─► écouteur unique ─► mutation de S ─► rendreXxx() ─► innerHTML
                                                ▲
                                          aller(vue) bascule .on
```

---

## 4. Modèle de données

### 4.1 Le catalogue de contenu

Le contenu tient en quatre constantes. La source est **commune** (français) ;
chaque phrase porte ses traductions, indexées par code de langue.

```js
const ORIGINE = "FR";                       // langue source, libellé gauche de l'en-tête

const LANGUES = {                            // une entrée par langue cible
  es: { nom:"Espagnol", cible:"ES", bcp47:"es-ES", guide:"…aide de lecture ES…" },
  en: { nom:"Anglais",  cible:"EN", bcp47:"en-GB", guide:"…aide de lecture EN…" }
};

const CATS = [ { id:"base", nom:"Bases" }, … ];

const ITEMS = [
  { id:"b1", cat:"base", fr:"Bonjour",
    tr:{ es:{ m:"Buenos días", ph:"BOUEnoss DIass" },
         en:{ m:"Good morning", ph:"goud MOR-ninng" } } }, …
];
```

Une entrée de `LANGUES` :

| Champ | Rôle |
|---|---|
| `nom` | Libellé humain (« Espagnol »). |
| `cible` | Code affiché dans l'en-tête et le sélecteur (« ES »). |
| `bcp47` | Étiquette de langue transmise à la synthèse vocale. |
| `guide` | Aide de lecture phonétique **propre à la langue** (HTML), affichée dans Réglages. |

Un `item` :

| Champ | Rôle | Contrainte |
|---|---|---|
| `id` | Clé de progression | **Unique et stable.** Le modifier réinitialise la phrase. |
| `cat` | Rattachement à une catégorie | Doit exister dans `CATS`. |
| `fr` | Phrase source, **partagée par toutes les langues** | — |
| `tr` | Traductions, une entrée par code de `LANGUES` | Doit couvrir chaque langue déclarée. |
| `tr[lg].m` | Phrase dans la langue cible | — |
| `tr[lg].ph` | Phonétique | Syllabe accentuée en MAJUSCULES (convention interne, non standard). |
| `tr[lg].fr` | **Optionnel.** Français de substitution pour cette langue seule | Voir ci-dessous. |

**Override français (`tr[lg].fr`).** Le français est partagé, sauf pour les
rares phrases dont le *texte français lui-même* nomme la langue cible. Deux
phrases sont concernées : « Je ne parle pas espagnol » (`b7`) et « Comment ça se
dit en espagnol ? » (`b11`). En mode anglais, leur entrée `en` fournit un `fr`
de substitution (« …anglais ») ; partout ailleurs, `tr[lg].fr` est absent et le
`fr` par défaut s'applique. Ce sont les **seules** exceptions au principe
« français strictement identique entre les langues ».

**Accès au contenu.** La logique ne lit jamais les champs bruts ; elle passe par
trois accesseurs qui résolvent la langue active (`META.langue`) :

```js
const mot  = it => it.tr[META.langue].m;              // phrase cible
const phon = it => it.tr[META.langue].ph;             // phonétique
const src  = it => it.tr[META.langue].fr || it.fr;    // français (override éventuel)
```

### 4.2 L'état de progression

Chaque phrase révisée reçoit une fiche, créée à la volée :

```js
const fiche = id => S.prog[id] || (S.prog[id] = { box:1, due:0, ok:0, ko:0 });
```

| Champ | Type | Sens |
|---|---|---|
| `box` | 1 à 5 | Boîte Leitner courante. |
| `due` | timestamp ms | Date de prochaine échéance. `0` = dû immédiatement. |
| `ok` | entier | Nombre de notations « Acquis ». |
| `ko` | entier | Nombre de notations « À revoir ». |

Deux fonctions dérivées :

```js
const dues   = () => ITEMS.filter(i => fiche(i.id).due <= Date.now());
const acquis = () => ITEMS.filter(i => fiche(i.id).box >= 4).length;
```

`S` (l'état de progression) est **rechargé à chaque changement de langue** :
`fiche`, `dues` et `acquis` opèrent donc toujours sur la progression de la langue
active. Les identifiants d'items étant communs, une même phrase a une fiche
distincte par langue.

`dues()` alimente le badge, la file de révision et l'écran Réglages ;
`acquis()` alimente le compteur d'en-tête et le tampon « ACQUIS » sur les billets
(seuil : boîte ≥ 4).

### 4.3 Schéma de persistance

La persistance est **à deux niveaux** : les préférences globales d'un côté, la
progression par langue de l'autre.

**Préférences globales** — clé `escale.meta`, une seule entrée :

```json
{ "langue": "es", "dir": "fr", "tts": true }
```

| Champ | Sens |
|---|---|
| `langue` | Code de la langue active (clé de `LANGUES`). |
| `dir` | Sens de révision : `"fr"` (source → cible) ou `"cible"` (cible → source). |
| `tts` | Synthèse vocale activée. |

**Progression** — une entrée **par langue**, clé `escale.<langue>` (p. ex.
`escale.es`, `escale.en`) :

```json
{
  "prog": { "b1": { "box": 3, "due": 1733500000000, "ok": 2, "ko": 0 }, … },
  "favs": ["t8", "s10"]
}
```

Conséquence directe : les progressions et favoris de chaque langue sont
**isolés** ; basculer de langue sauvegarde l'entrée courante puis charge l'autre.
Ajouter une langue à `LANGUES` crée automatiquement son propre espace au premier
usage, sans collision.

### 4.4 Adaptateur de stockage

L'accès n'est jamais direct. Un adaptateur `DB` encapsule `localStorage` et
bascule sur un objet mémoire volatile en cas d'indisponibilité (navigation
privée, contexte cloisonné) :

```js
const DB = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return mem[k] ?? null; } },
  set(k,v){ try { localStorage.setItem(k,v); }   catch(e){ mem[k] = v; } },
  del(k){ try { localStorage.removeItem(k); }     catch(e){ delete mem[k]; } }
};
```

Conséquence : dans un contexte sans stockage, l'application **reste utilisable**
mais **ne conserve rien** entre deux sessions. C'est un choix de robustesse, pas
un bug.

### 4.5 Changement de langue

`changerLangue(lg)` orchestre la bascule : il **sauvegarde** la progression de la
langue quittée, met à jour `META.langue` (persisté dans `escale.meta`),
**recharge** la progression de la nouvelle langue depuis `escale.<lg>`,
réinitialise les états volatils (carte de révision, quiz en cours), resélectionne
la voix (`bcp47` de la nouvelle langue), puis rafraîchit les libellés dépendants
de la langue et la vue courante. Deux points d'entrée dans l'interface :

- la **pastille** en haut à droite de l'en-tête, qui fait défiler les langues
  (`langueSuivante()`) ;
- le **segment** « Langue cible » de l'écran Réglages, qui sélectionne
  directement une langue.

Les éléments dépendants de la langue (bandeau, sens de révision affiché, aide de
lecture phonétique) sont regroupés dans `majLibelles()`, rappelé à chaque
bascule.

---

## 5. Les trois moteurs fonctionnels

### 5.1 Répétition espacée (vue Réviser)

Système de **Leitner à cinq boîtes**, intervalles paramétrés en tête de script :

```js
const INTERVALLES = [0, 1, 3, 7, 21];   // en jours, pour les boîtes 1 à 5
```

Sélection de la carte : parmi les phrases dues, celle de la **boîte la plus
basse** est présentée en premier (les moins sues d'abord).

Notation — comportement exact relu dans `noter(g)` :

| Bouton | `g` | Effet sur `box` | Compteur | Reprogrammation |
|---|---|---|---|---|
| À revoir | 1 | remis à `1` | `ko++` | `INTERVALLES[0]` = aujourd'hui |
| Presque | 2 | **inchangé** | aucun | intervalle de la boîte **courante** |
| Acquis | 3 | `+1` (plafond 5) | `ok++` | intervalle de la **nouvelle** boîte |

Dans tous les cas, `due` est recalculée par
`Date.now() + INTERVALLES[box-1] * JOUR`. Autrement dit « Presque » ne fait pas
progresser mais **repousse tout de même** l'échéance selon la boîte courante —
la phrase ne reviendra donc pas immédiatement.

> Ces intervalles sont un réglage de départ choisi pour un usage court avant un
> voyage, **pas** une constante canonique de la littérature sur la mémoire. Ils
> se modifient librement.

### 5.2 Test (vue Test)

Dix questions à choix multiple (4 options). Constitution du pool, relue dans
`nouveauQuiz()` :

1. tri de toutes les phrases par **boîte croissante** (les moins sues d'abord),
   départage aléatoire ;
2. on garde les **24 premières** ;
3. mélange, puis on retient **10 questions**.

Pour chaque question : l'énoncé est la phrase en langue cible, les 3 mauvaises
réponses sont tirées au hasard parmi les autres phrases. Le test **ne modifie
pas** la progression Leitner (les deux moteurs sont indépendants) ; il ne fait
qu'orienter la sélection vers les phrases fragiles.

Barème d'appréciation finale relu dans le code : ≥ 8 « Solide », ≥ 5 « Ça
vient », sinon « À retravailler dans le guide ».

### 5.3 Guide (vue Guide)

Liste filtrable de tous les billets. Filtres : **Tout**, **★ Favoris**, puis une
puce par catégorie. Chaque billet permet l'écoute et la mise en favori. Les
favoris sont indépendants de la progression : ils servent à garder quelques
phrases sous la main, sans lien avec les boîtes Leitner.

---

## 6. Synthèse vocale

La prononciation s'appuie sur l'API **Web Speech / `SpeechSynthesis`** du
navigateur, qui délègue au moteur de synthèse vocale du système.

- `chargerVoix()` sélectionne une voix dont la langue correspond au `bcp47` de la
  **langue active**, à défaut à son préfixe (`es`, `en`…) ; sinon aucune. Il est
  rappelé à chaque changement de langue.
- Le catalogue de voix se charge de façon **asynchrone** : l'événement
  `voiceschanged` déclenche une nouvelle tentative de sélection.
- `dire(txt)` lit le texte à débit réduit (`rate = .88`) si la voix est active.
- L'écran Réglages **affiche la voix détectée** ou signale son absence, ce qui
  sert de diagnostic sur l'appareil réel.

Le fonctionnement **hors-ligne** de la voix dépend de la présence du pack vocal
de la langue sur l'appareil (chemin d'installation dans le README). Ce point
n'a **pas** été vérifié sur un terminal physique — voir § 8.

---

## 7. Fonctionnement hors-ligne (service worker)

Stratégie **cache-first** sur une liste fermée de fichiers (la « coquille »).
Comme tout le contenu pédagogique est dans `index.html`, mettre la coquille en
cache suffit à rendre l'application entièrement hors-ligne.

Cycle de vie, relu dans `sw.js` :

- **`install`** : ouverture du cache courant (`escale-v2`), mise en cache de la
  liste `FICHIERS`, activation immédiate (`skipWaiting`).
- **`activate`** : suppression des caches dont le nom diffère de la version
  courante, prise de contrôle des clients ouverts (`clients.claim`).
- **`fetch`** : réponse depuis le cache si présente ; sinon requête réseau, avec
  mise en cache des seules ressources **same-origin** en réponse valide, et
  repli sur `index.html` en cas d'échec réseau.

> **Règle d'exploitation à ne pas oublier :** après toute modification d'un
> fichier, **incrémenter `CACHE`** dans `sw.js` (p. ex. `escale-v2` → `escale-v3`).
> Sans cela, l'ancienne version continue d'être servie depuis le cache.

Rappel de contrainte : service worker et installation PWA **exigent HTTPS** (ou
`localhost`). Un `file://` ouvre l'app mais n'active ni le cache ni
l'installation.

---

## 8. Limites et incertitudes

Distinction volontaire entre ce que j'ai vérifié et ce que je n'ai pas pu
vérifier.

**Vérifié (relu sur le code, testé en rendu automatisé et en DOM simulé sans
navigateur réel) :** intégrité du corpus bilingue (87 phrases, identifiants
uniques, catégories cohérentes, **traduction présente pour chaque langue**,
aucun champ vide) ; overrides français limités à `b7` et `b11` ; rendu des
billets ; navigation entre vues ; cycle de notation Leitner ; déroulé du QCM ;
pose de favori. **Bascule de langue** vérifiée : mise à jour de l'en-tête, du
bandeau et de l'aide phonétique ; **isolement des progressions** (une notation en
espagnol laisse l'anglais vierge, et réciproquement) ; persistance des
préférences globales. Aucune erreur JavaScript levée pendant ces tests.

**Non vérifié (nécessite un appareil réel) :**

- **Voix hors-ligne.** Que `SpeechSynthesis` parle sans réseau dépend du pack
  vocal installé sur l'appareil ; je ne peux pas le confirmer dans l'abstrait.
  À valider sur ton téléphone via l'écran Réglages.
- **Reconnaissance vocale.** L'application **n'en propose pas.** Je le mentionne
  car c'est une extension naturelle : l'API web de reconnaissance requiert
  souvent une connexion, et je ne sais pas affirmer de façon fiable si un mode
  hors-ligne existe sur toutes les versions récentes d'Android.
- **Rendu sur l'ensemble des versions de Chrome Android.** Testé en
  environnement automatisé, pas sur un parc de terminaux.

**Dette technique — résolue :**

- L'ancien champ de langue cible nommé `es` (qui portait ce nom quelle que soit
  la langue) a **disparu** avec le passage au multi-langue. Les traductions
  vivent désormais dans `tr[<code>]`, structurellement propre. Le refactor
  multi-langue a réglé cette dette au passage.

**Qualité du corpus :**

- Les 87 phrases françaises et leurs traductions **espagnoles et anglaises** ont
  été générées puis relues par mes soins — ce **n'est pas** une relecture par un
  locuteur natif. La réserve vaut pour **chaque** langue cible, et doublement
  pour l'anglais qui vient d'être ajouté. Avant tout usage à enjeu (santé,
  démêlés), une validation humaine des catégories concernées est recommandée.
- Les **phonétiques anglaises** sont des approximations pour francophone : deux
  sons anglais (les deux « th ») n'existent pas en français et ne sont rendus
  que grossièrement. Elles visent l'intelligibilité, pas la justesse.

---

## 9. Points d'extension

| Objectif | Où intervenir | Remarque |
|---|---|---|
| Ajouter une langue cible | une entrée dans `LANGUES` + une clé dans le `tr` de **chaque** item | Sélecteur, stockage isolé et bascule fonctionnent alors sans autre modification. |
| Ajouter des phrases | tableau `ITEMS` | Identifiants uniques et stables ; couvrir chaque langue dans `tr`. |
| Corriger une traduction | `tr[<code>].m` / `.ph` de l'item | Le `fr` partagé n'est pas touché. |
| Ajuster le français d'une phrase pour une langue | `tr[<code>].fr` | Override ciblé (cf. `b7`, `b11`). |
| Ajouter une catégorie | tableau `CATS` + `cat` des items | Le filtre apparaît automatiquement. |
| Modifier le rythme de révision | `INTERVALLES` (tête du 2ᵉ script) | Le nombre de boîtes = longueur du tableau. |
| Modifier le seuil « acquis » | fonction `acquis()` (`box >= 4`) | Impacte compteur et tampon. |
| Changer l'apparence | bloc `<style>` (variables `:root`) | Thème clair/sombre gérés par variables CSS. |

---

## 10. Confidentialité

Aucune donnée ne quitte l'appareil. Aucun appel réseau n'est émis après le
premier chargement (hors, le cas échéant, requêtes du moteur vocal système hors
du périmètre de l'application). Les préférences résident dans `escale.meta`, la
progression et les favoris dans une clé `escale.<langue>` par langue, toutes dans
le `localStorage` du navigateur. L'effacement depuis l'écran Réglages efface la
progression de **la langue courante** ; l'effacement des données du site depuis
le navigateur efface **tout** définitivement.
