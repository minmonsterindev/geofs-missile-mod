# GeoFS — Missile & Bomb Mod

Missiles air-air et bombes pour les avions militaires de [GeoFS](https://www.geo-fs.com/).
100 % autonome : aucun modèle 3D ni texture externe, tout est généré (géométrie Cesium et
couleurs par instance).

Version **1.23.1** : le mod **ne fournit plus d'avion**. Le MiG-31 LEGO est retiré et vit
désormais dans son propre projet ; les fichiers de `assets/mig31/` restent dans le dépôt mais
plus rien ne les charge. Le rendu des munitions a été refait : les pièces ne sont plus des
entités dynamiques (Cesium détruisait et recréait une primitive par pièce **à chaque image**),
mais des géométries cuites une fois dans un seul `Primitive` par munition. Le script se met à
jour tout seul depuis GitHub.

## Installation (Tampermonkey)

**Méthode recommandée — mise à jour automatique :**

1. Installe l'extension **Tampermonkey** (Chrome, Edge, Firefox, Opera, Safari).
2. Ouvre <https://raw.githubusercontent.com/minmonsterindev/geofs-missile-mod/main/geofs-mig31-autoupdate.user.js>
   et clique sur **Installer**.
3. Vérifie que le script est **activé** (interrupteur vert), puis va sur
   <https://www.geo-fs.com/geofs.php>.

Ce petit fichier ne contient pas le mod : à chaque ouverture de GeoFS il télécharge la dernière
version de [`geofs-missile-mod.user.js`](geofs-missile-mod.user.js) et l'exécute. Il n'y a donc
plus rien à réinstaller après une mise à jour du dépôt. Le mod se protège d'un double
chargement, garder l'ancien script installé ne gêne pas.

**Méthode manuelle :**

1. Tableau de bord Tampermonkey → onglet **+** → supprime tout le contenu.
2. Colle l'intégralité de [`geofs-missile-mod.user.js`](geofs-missile-mod.user.js), puis `Ctrl+S`.
3. Le script porte `@updateURL` / `@downloadURL` : Tampermonkey le met à jour tout seul
   (Tableau de bord → **Paramètres → Vérifier les mises à jour**, par défaut toutes les 12 h).

La console (`F12`) affiche `[MissileMod] v1.23.1 prêt`.

## Commandes

| Touche | Action |
|--------|--------|
| `L` | Armer / désarmer le système |
| `Q` | Tirer un missile (ou larguer une bombe si l'avion n'a pas de missiles) |
| `*` | Choisir le type de missile (avant l'armement) |
| `²` `$` `!` `:` | Larguer une bombe |
| `U` | Changer de cible |
| `D` | Réarmer (missiles + bombes) |
| `Maj + D` | Mode **calibrage** des points d'emport |

Touches libres uniquement : GeoFS utilise déjà `A B C E F G H J K M N O P R S T V X Z`, les
flèches, `Espace`, `Entrée`, `Tab`, `<` `>`, `;` et les chiffres. Les symboles sont reconnus
même si ta disposition de clavier demande `Maj` ou `AltGr`. Tout est remappable dans
`CFG.keys` (format `'l'`, `'shift+l'` ou tableau de touches).

## Types de missiles (`*`)

Sélection **avant d'armer** : `*` fait défiler les types, le HUD et la couleur des missiles
sous les ailes changent immédiatement. Une fois armé, `*` refuse de changer (il faut
désarmer) et chaque missile déjà tiré garde les performances de son type.

| Missile | Vitesse | Agilité | Portée |
|---------|---------|---------|--------|
| AIM-120 AMRAAM | 900 m/s | 1,6 | 40 km |
| AIM-9X Sidewinder | 760 m/s | 2,8 | 15 km |
| R-77 Adder | 860 m/s | 2,0 | 30 km |
| R-73 Archer | 720 m/s | 3,0 | 12 km |
| MBDA Meteor | 1000 m/s | 1,5 | 60 km |
| AIM-54 Phoenix | 950 m/s | 1,1 | 80 km |

La portée affichée dans le HUD (`Contacts (xx km)`) et le verrouillage automatique suivent le
missile choisi : avec un R-73, pas de lock à 30 km.

## Couleurs

Aucun fichier distant : chaque pièce est une géométrie Cesium (cylindre ou boîte) colorée par
instance via `PerInstanceColorAppearance`. Le corps, l'ogive, la ceinture d'identification, le
culot et les ailettes gardent donc leur couleur, mais plus de texture : une texture de 64×64
sur un corps de 18 cm ne se voyait pas, et `PerInstanceColorAppearance` permet surtout de
fondre **toutes** les pièces d'une munition dans un seul appel de dessin.

## Calcul de la position

Une seule matrice fait tout. `playerFrame()` lit la position (`llaLocation`) et l'orientation
(`object3d.worldRotation`, sinon `object3d.rotation`, sinon cap/assiette/roulis), redresse la
base (avant normalisé, vertical rendu perpendiculaire à l'avant), puis construit une matrice
modèle → ECEF dont les colonnes sont (gauche, avant, haut, position).

Un emport n'est plus qu'un point de coordonnées modèle transformé par cette matrice
(`Matrix4.multiplyByPoint`) : plus d'addition de trois axes à la main. Une orientation
légèrement arrondie ne peut donc plus cisailler les emports, et la position comme l'orientation
des missiles sortent de la même base.

Piège Cesium : `new Cesium.Matrix4(a, b, c, …)` **ignore ses arguments** et rend l'identité.
La matrice est donc remplie par `Matrix4.fromColumnMajorArray([...], new Matrix4())`. Sans ça,
les missiles partaient à l'origine de la Terre (bug corrigé en 1.7.0, trouvé en jeu).

Les pièces d'une munition sont des `GeometryInstance` cuites une fois, à leur place dans le
repère de la munition. À chaque image le mod ne réécrit que la matrice modèle de la munition
(`primitive.modelMatrix`) : les emports reçoivent celle de l'avion, une munition en vol la
sienne, construite depuis sa position et son axe. Aucune image de retard : le missile tiré
part de la position courante.

## Emports par appareil

| Appareil | Missiles | Bombes |
|----------|----------|--------|
| F-16 | 6 | 4 |
| F/A-18 | 8 | 4 |
| Su-35 | 12 | — |
| Rafale | 6 | 4 |
| Eurofighter | 8 | 4 |
| F-22 | 8 | 2 |
| F-35 | 6 | 4 |
| F-15 | 8 | 6 |
| F-14 | 8 | — |
| F-4 | 6 | 6 |
| MiG-29 / 31 / 25 | 6 | — |
| A-10 | 6 | 8 |
| Tornado / Gripen / J-20 | 6 | 4 à 6 |
| **B-2 Spirit** | — | **16** |
| **B-52** | — | **20** |
| **B-1B Lancer** | — | **16** |
| **Tu-160** | — | **12** |
| **Tu-95** | — | **8** |
| **Concorde** | — | **8** |

## Placement

Deux sources, dans cet ordre.

**1. Le maillage de l'aile**, lu dans le glTF chargé par Cesium
(`object3d.model._model._cachedGltf.gltf`). Les boîtes englobantes sont lues **une par
primitive**, converties en repère Cesium (le glTF est en Y-haut : `(x, y, z) → (x, −z, y)`),
et la pièce retenue est celle qui est large, plate et devant. On en tire la racine, le bout, la
corde et surtout **le dessous de voilure**. Les missiles sont posés 18 cm sous ce dessous,
répartis de la racine vers le bout.

Sur le Su-35 : aile de 2,05 à 6,43 m, dessous à **0,21 m** → missiles à **0,03 m**, collés sous
l'aile.

Sur une aile en briques, aucune boîte englobante n'est crédible : les plaques fines du
maillage sont alors lues **station par station** (corde locale et dessous de voilure, la
médiane écartant les trappes de train qui pendent plus bas). Sans ça, les missiles se posaient
à une fraction de la demi-longueur, donc devant le bord d'attaque très en flèche : ils
flottaient en l'air à côté de l'aile (corrigé en 1.19.3).

Le maillage arrive après le changement d'appareil : le calcul est retenté toutes les 500 ms et
**au maximum six fois** (3 s), puis les emports sont replacés dès qu'il est disponible.

**2. Repli** si la pièce trouvée n'est pas crédible — l'aile du F-16 est fondue dans le `body`,
et sur le Rafale c'est un volet qui est le plus large : 25 cm sous le plan de voilure annoncé par
les `points.forceSourcePoint`, sinon sous le ventre.

GeoFS ne nomme **aucun pylône** (vérifié dans les `aircraft.json` du Su-35, du F-16, du Rafale et
du B-2) et seul le `body` porte des points de collision. Le train descend 1 à 3 m plus bas que le
fuselage : les bombes sont donc bornées à **1,20 m sous le dessous de voilure** pour ne pas
pendre sous les roues.

Si l'agencement ne colle pas à un appareil, `Maj + D` ouvre le calibrage (les flèches ne
pilotent plus l'avion). Chaque point d'emport affiche alors un **repère** : un point cyan pour
un missile, jaune pour une bombe, dessiné par-dessus le fuselage (test de profondeur désactivé)
et qui suit les réglages en direct. On aligne donc à l'œil sur l'aile, sans lire les chiffres.

| Touche | Effet |
|--------|-------|
| `²` (ou `Maj + ²`) | avancer les emports |
| `,` | reculer |
| `)` / `(` | écarter / resserrer |
| `]` / `[` | descendre / monter |
| `Retour arrière` | réinitialiser |

Les flèches font la même chose et sont neutralisées pendant le calibrage. Toutes ces touches
sont des symboles que GeoFS n'utilise pas : hors calibrage, `²` redevient une touche de bombe.

Réglages sauvegardés par appareil dans le `localStorage`.

## Optimisation du rendu des munitions (1.23.0 – 1.23.1)

Trois causes de lag se cumulaient ; la dernière, de loin la plus lourde, n'était pas du
JavaScript.

1. **Recalcul par pièce (1.23.0 – 1.23.1)** — chaque pièce recalculait sa position et son
   orientation depuis zéro à chaque évaluation (produit vectoriel, normalisations, sin/cos,
   matrice 3×3, quaternion), et Cesium demande ces propriétés plusieurs fois par image. La
   base d'une munition est maintenant calculée une fois par image et par munition, et la
   position d'un emport une fois par image (`stationPos`). Mesure sur 200 pièces : ≈ 115 →
   12 µs par image ; 25,1 → 4,2 µs pour les emports.

2. **Géométrie dynamique (1.23.1)** — le vrai coupable. Une pièce dont la position vient d'une
   `CallbackProperty` est « dynamique » pour Cesium, et pour une géométrie dynamique son
   `DynamicGeometryUpdater` **détruit et recrée un `Primitive` à chaque image**
   (`removeAndDestroy` puis `new Primitive`, donc de nouveaux tampons GPU). Un B-52 garé
   (20 bombes × 8 pièces) déclenchait **160 destructions/recréations de primitives par
   image**, même sans tirer : aucune optimisation de calcul ne pouvait l'enlever. Les pièces
   sont désormais cuites **une fois** dans un seul `Primitive` par munition ; à chaque image
   le mod ne réécrit que `primitive.modelMatrix`, que Cesium recopie dans ses commandes de
   dessin. Une munition = **1 primitive = 1 appel de dessin** au lieu de 8 à 14 entités
   dynamiques ; 20 bombes = 20 primitives au lieu de 160.

3. **Flou du panneau** — `backdrop-filter: blur(4px)` obligeait le compositeur à relire le
   canvas WebGL à chaque image, pour un fond déjà opaque à 97 %. Supprimé.

La géométrie rendue est identique à l'ancienne : écart mesuré **1,3 × 10⁻⁹ m** sur
206 orientations × 30 pièces, et 8,3 × 10⁻¹⁶ sur les rotations (`.tooling/test-munition-math.js`).
Le smoke test charge le userscript complet dans jsdom avec le vrai Cesium : 86 pièces,
**10 primitives, 0 entité dynamique**, tir, réarmement, largage et suivi de la rotation.

Autres sources de lag traitées :

- **emport vide** : un missile tiré n'est plus simplement masqué, sa primitive est **retirée**
  du rendu ; le réarmement (`D`) la reconstruit (géométries en cache) ;
- **HUD et panneau** : le texte est construit à chaque mise à jour mais le DOM n'est réécrit
  **que s'il change** (`HUD.sig`, `HUD.panelSig`), deux fois par seconde au lieu de cinq ;
- **effets** (fumée, explosions) : une image sur deux au-delà de deux particules ;
- **contacts** relus toutes les 500 ms ;
- **recherche de l'aile** : lecture du glTF bornée à six essais (3 s) au lieu d'être retentée
  indéfiniment deux fois par seconde.

GeoFS range l'avion courant dans `localStorage.flight`. Une ancienne version y laissait l'id
9917 de l'avion bonus retiré : l'enregistrement est réparé au chargement
(`cleanStaleAircraftId`), sinon le jeu échouerait au lancement suivant avec « Could not load
aircraft file ».

## Fonctionnement

- **Guidage missile** : poursuite proportionnelle simplifiée, virage limité par l'agilité du
  type, accélération jusqu'à sa vitesse max, fusée de proximité testée sur le segment
  parcouru entre deux images (pas de « saut » à travers la cible).
- **Bombes** : gravité radiale, traînée, composante ascendante supprimée au largage, impact
  sur la hauteur réelle du terrain (`scene.globe.getHeight`).
- **Cibles** : `multiplayer.users` + `multiplayer.visibleUsers`, position relue à chaque image.
- **Son** : synthèse WebAudio.
- **Robustesse** : chargement unique, repli `requestAnimationFrame`, boucle sous `try/catch`.

## Réglages (`CFG`)

```js
keys: {
  arm: 'l', fire: 'q', type: '*', target: 'u', reload: 'd', calibrate: 'shift+d',
  bomb: ['²', '`', '$', '!', ':', 'shift+q']
}
minLaunchSpeed: 160     // vitesse minimale au tir (m/s)
maxActive: 8            // missiles simultanés max
bombGravity: 9.81       // gravité des bombes (m/s²)
bombDrag: 0.028         // traînée des bombes
bombCooldown: 220       // ms entre deux largages
cooldown: 900           // ms entre deux tirs de missile
lockRange: 40000        // portée radar de secours (sinon celle du missile)
trailPoints: 70         // points de sillage conservés
forceAllAircraft: false
```

Les performances de vol (vitesse, accélération, agilité, portée, durée de vie, fusée de
proximité) ne sont plus dans `CFG` : elles appartiennent à chaque entrée de `MISSILE_TYPES`,
puisque c'est le missile choisi qui les définit.

## Décollage du MiG-31 (`assets/mig31/`)

Le mod ne charge plus cet appareil, mais sa définition est restée dans le dépôt. Au décollage il
se cabrait brutalement vers **29 kt**, bien avant que la portance puisse le porter : à 14,9 m/s,
120 m² d'aile ne donnent qu'une quinzaine de kN, soit 5 % du poids. Le coupable n'était donc ni
la portance ni la profondeur, mais la **poussée**.

2 × 152 kN pour 30 t font un rapport poussée/poids de **1,03**, soit 10,1 m/s². Le centre de
masse est à 3,45 m au-dessus du sol : le moment d'inertie (m·a·h) délestait le train avant de
**87 %**, de 161 kN à 21 kN (7 % du poids). L'avion roulait alors sur ses seules roues
principales et basculait d'un coup au premier couple venu — un simple coup de profondeur
suffisait à le faire cabrer.

| Champ | Avant | Après |
|---|---|---|
| `thrust` (× 2) | 152 000 N (T/W 1,03) | 112 000 N (T/W 0,76) |
| `suspension` | `stiffness` / `damping` | + `motion: translate`, `axis: Z`, `ratio: 1`, `damping: 5` |
| `contactProperties.wheel` | sans `lockSpeed` | `lockSpeed: 0.008` |

La géométrie de l'aile (60 m² par côté, montée à −8°, décrochage à 16°) n'est **pas** touchée :
c'est elle qui a été validée en jeu à la 1.22.0 (décollage vers 150 kt), et à 29 kt elle ne
produit que 4 % du poids. Y toucher n'aurait fait que rallonger la course sur herbe.

À pleine poussée le train avant garde maintenant 20 % du poids (contre 7 %) : l'avion reste
posé et se cabre à la profondeur, pas tout seul. L'accélération passe de 10,1 à 7,5 m/s², soit
environ 110 m de course en plus à vitesse de rotation égale ; le rapport poussée/poids de 0,76
est celui du vrai MiG-31 et reste largement suffisant pour la montée comme pour l'herbe. Les
trois roues reçoivent en plus les champs de suspension attendus par la doc GeoFS et un
`lockSpeed`, ce qui calme le pompage sur terrain irrégulier.

### Course de décollage sur herbe

Chiffrée depuis la définition (`.tooling/takeoff-roll.js`) : intégration de
m·dv/dt = T − D − μ·(W − L) pas à pas (1 ms), traînée parasite CdA 1 m², portance de roulage
Cl 0,5, piste plate.

| Rotation | Herbe sèche (μ 0,04) | Herbe normale (μ 0,06) | Herbe grasse (μ 0,10) |
|---|---|---|---|
| Vs, 104 kt | 201 m | 206 m | 216 m |
| 1,1 Vs, 114 kt | 243 m | 248 m | 260 m |
| 150 kt (vitesse observée en 1.22.0) | 416 m | 423 m | 439 m |

À 150 kt, la rotation coûte **116 m de plus** qu'avec l'ancienne poussée (307 → 423 m,
+3,1 s), mais il reste **377 m de marge sur une piste en herbe de 800 m** et 577 m sur
1 000 m. À cette vitesse l'aile porte déjà plus du double du poids : le décollage ne dépend
plus de la poussée restante, seulement de la vitesse atteinte, et 0,76 de rapport
poussée/poids suffit à accélérer et à monter.

Ces chiffres sont **calculés depuis la définition** (masse, poussée, points de contact, centre de
masse), pas mesurés en jeu.

## Limites connues

- Dégâts **locaux** : GeoFS n'expose aucune API serveur pour détruire l'avion d'un autre
  joueur. L'explosion et le « SPLASH » ne sont visibles que chez toi.
- Missiles et bombes ne sont pas synchronisés en multijoueur.
- Si un appareil n'apparaît pas dans `AIRFRAMES`, active `forceAllAircraft` ou ajoute une entrée.

## Interface dédiée

Un bouton **Armement** est ajouté dans la barre du bas de GeoFS, entre
« Location » et « Camera ». Il ouvre un panneau qui résume l'état de
l'armement, le chargement et les touches.
