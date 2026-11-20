# GeoFS — Missile & Bomb Mod

Missiles air-air et bombes pour les avions militaires de [GeoFS](https://www.geo-fs.com/).
100 % autonome : aucun modèle 3D ni texture externe, tout est généré (géométrie Cesium et
textures canvas).

Version **1.19.4** : le MiG-31 bonus est un vrai maillage LEGO détaillé (109 000 triangles,
couleurs et décalques d'origine) reconstruit depuis l'export GLB du modèle Mecabricks. Il
décolle (poussée de postcombustion et contact ventre corrigé), il est **orienté dans le bon
sens** (nez vers l'avant, corrigé en 1.19.4), ses missiles sont posés sous la vraie voilure et
le script se met à jour tout seul depuis GitHub.

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

La console (`F12`) affiche `[MissileMod] v1.19.4 prêt`.

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

## Textures

Aucun fichier distant : chaque missile et chaque bombe reçoit une texture 64×64 dessinée en
canvas au chargement (panneaux, rivets, reflet métallique et bandes d'identification à la
couleur du type). Elle est appliquée via `Cesium.ImageMaterialProperty`, avec repli sur une
couleur unie si le navigateur refuse le canvas.

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

Tout est appelé dans la `CallbackProperty` de chaque entité : recalcul à chaque évaluation par
Cesium, aucune image de retard, aucun cache à invalider. Le missile tiré part de la position
courante.

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
primitive** (une par brique sur le MiG-31), converties en repère Cesium (le glTF est en Y-haut :
`(x, y, z) → (x, −z, y)`), et la pièce retenue est celle qui est large, plate et devant. On en tire la racine, le bout, la corde et
surtout **le dessous de voilure**. Les missiles sont posés 18 cm sous ce dessous, répartis de
la racine vers le bout.

Sur le Su-35 : aile de 2,05 à 6,43 m, dessous à **0,21 m** → missiles à **0,03 m**, collés sous
l'aile. Le maillage arrive après le changement d'appareil, donc le calcul est retenté deux fois
par seconde et les emports sont replacés dès qu'il est disponible.

Sur le MiG-31 LEGO l'aile est une mosaïque de briques : aucune boîte englobante n'est crédible.
Les plaques fines du maillage sont alors lues **station par station** (corde locale et dessous de
voilure, la médiane écartant les trappes de train qui pendent plus bas). Sans ça, les missiles
se posaient à une fraction de la demi-longueur, donc devant le bord d'attaque très en flèche :
ils flottaient en l'air à côté de l'aile (corrigé en 1.19.3).

Le chargement de l'avion bonus passe désormais par le circuit interne de GeoFS (1.19.5) : une
entrée `local: true` dans `geofs.aircraftList` puis `instance.change(id)`, exactement ce que fait
le menu « Aircraft ». GeoFS lit lui-même `aircraft.json`, construit les pièces et place l'avion ;
plus d'`init()` manuel, donc plus de position à fabriquer (les versions 1.19.3–1.19.4 la
cherchaient à la main et pouvaient la rater : `init()` recevait `undefined` et échouait sur
« reading '0' », en laissant un demi-avion non orienté). Si l'avion n'est pas encore placé ou si
GeoFS ne lit pas la définition, rien n'est démonté : l'appareil d'origine reste en place.

Le chargement est aussi borné (1.19.6–1.19.7) : la définition (16 Ko) est lue d'abord, avec
un délai de 15 s, pour échouer tout de suite avec un message clair si GitHub ne répond pas ;
la construction par GeoFS est limitée à 60 s. Le panneau affiche l'étape en cours
(« téléchargement… », « construction par GeoFS… ») et, en cas d'échec, le jeu est remis en
route sur l'avion d'origine au lieu de rester figé en pause. Le maillage (9,4 Mo) n'est
volontairement pas préchargé : GeoFS le redemanderait, ce qui doublerait le téléchargement.

Le mod vérifie aussi que le **maillage** est réellement affiché (1.19.8) : GeoFS construit la
définition même quand le `.glb` n'arrive pas, ce qui donnait un avion invisible entouré des
seuls emports. Le maillage est désormais servi par **jsDelivr** en priorité (même dépôt, cache
long : la deuxième bascule prend ~1 s au lieu de retélécharger 9,4 Mo), GitHub restant en
secours.

Cesium construit les 1183 primitives du GLB en plusieurs secondes : le mod attend jusqu'à 90 s
en affichant `maillage en construction… N s` (1.20.1). Il ne relance plus un second
téléchargement quand seul le maillage traîne — c'est ce qui bloquait le chargement — et ne
réessaie depuis GitHub que si la définition elle-même n'a pas été lue. En cas d'échec, l'avion
d'origine revient et le panneau garde une ligne rouge indiquant si le fichier répond sur le
CDN et sur GitHub.

Le contrôle du maillage regarde le bon modèle (1.20.2) : juste après une bascule, l'objet 3D
porte encore quelques instants le GLB de l'avion quitté. On vérifie donc l'URL du GLB, l'état
`ready` de Cesium et la sphère englobante (13,7 m pour le MiG), pas la seule présence d'un
modèle.

Dès que le joueur a utilisé le MiG une fois, le GLB est remis en cache en tâche de fond 20 s
après le démarrage (1.20.3) : la bascule suivante ne télécharge plus rien et le maillage est
prêt en quelques secondes. Rien n'est téléchargé pour qui n'utilise jamais l'avion.

« définition refusée » venait de GeoFS, pas du fichier (1.20.4) : le jeu lit lui-même
`aircraft.json` avec `$.ajax`, et sur un réseau filtré (école, proxy) cette requête échoue même
quand celle du mod passe — le préchargement lisait une réponse déjà en cache. GeoFS appelait
alors `loadDefault('Could not load aircraft file')`, d'où le message. Le mod télécharge
désormais la définition lui-même (`cache: 'no-store'`, JSON vérifié : une page de blocage
renvoyée en 200 est détectée) et la remet à GeoFS au moment où il la demande. Les sources sont
essayées dans l'ordre — `cdn`, `fastly` et `gcore.jsdelivr.net`, GitHub, GitHack, Statically —
chacune n'étant tentée que si sa définition arrive vraiment, et le repli est annoncé
(`secours Fastly`). Si aucune ne répond : « sources injoignables (réseau filtré ?) » en quelques
secondes, retour à l'avion d'origine, aucune boucle. Enfin, l'attente ne dépend plus de la
promesse de `change()` : GeoFS peut lever dans `init()` (caméra pas encore prête) après avoir
déjà posé l'avion, et cette promesse ne se résout alors jamais — c'est l'id 9917 qui fait foi.

## Train d'atterrissage rentrant (1.21.0)

Le GLB d'origine est un maillage unique (1 183 primitives, aucun nœud nommé) : GeoFS ne
pouvait donc rien animer. Le modèle est maintenant découpé en quatre fichiers — le corps
(`mig31-body.glb`) et les trois trains (`gear-nose.glb`, `gear-left.glb`, `gear-right.glb`),
les triangles étant classés par leur centre dans des boîtes 3D autour des roues. Chaque train
est une pièce GeoFS à part entière : `wheel` avec son `model`, son pivot (`position`) et ses
points de contact — les roues sont donc là où on les voit, plus 1,8 m derrière comme avant.

Les pivots sont à la tête de jambe (nez : avant 3,6 m / hauteur −1,8 m ; principaux : ±1,55 m
/ arrière 3,9 m). Les fichiers sont écrits dans le même repère auteur que le corps (x =
envergure, y = hauteur, z = longueur, nez vers −z) et portent la même `rotation: [0,0,90]`,
sinon GeoFS les couche à 90°. Les trois pièces rentrent avec la touche **G** de GeoFS :
rotation de 90° (principaux) et −110° (nez) sur `gearPosition`, avec disparition au-delà de
0,9 pour ne pas voir le train dépasser du ventre une fois rentré.

Le maillage du corps perd 1 700 triangles (les trains), et `mig31-lego.glb` n'est plus utilisé.

## Décollage et vol (1.21.1)

L'avion restait collé au sol pour trois raisons, toutes dans la définition et non dans le
modèle 3D :

- les ailes étaient orientées à **−0,4°**, ce qui donnait une portance **négative** (elles
  plaquaient l'avion au sol à mesure qu'il accélérait) ;
- la profondeur était montée à l'envers : tirer le manche poussait le nez vers le bas ;
- 41 t de masse pour 2 × 30 m² d'ailes demandaient une vitesse que l'avion n'atteignait pas.

Nouvelle définition : ailes à **−8°** et 60 m² chacune (décrochage repoussé à 16°), profondeur
remise dans le bon sens (rotation 180°), masse **30 t** (poids à vide réel du MiG-31 plus le
carburant). Mesuré en jeu avec la définition publiée : l'avion quitte le sol vers **150 kt**
(≈ 280 km/h) et monte. La montée est franche — la poussée dépasse le poids — donc réduis les
gaz après le décollage.

Attention : le MiG-31 reste un gros appareil, la profondeur est sensible à haute vitesse ;
des petits coups de manche suffisent.

## Poids du maillage

Le GLB fait 8,96 Mo mais jsDelivr le sert compressé en **1,83 Mo** (mesuré sur les en-têtes),
soit 3 à 5 s en 4G ; `raw.githubusercontent.com` livre les 9,4 Mo bruts, d'où jsDelivr en
première source. Les pistes d'allègement ont été mesurées : la soudure des sommets ne gagne
que 30 Ko une fois compressé (310 000 sommets à normales par face, aucune arête partagée) et
la quantification (`KHR_mesh_quantization`, 5,68 Mo, 0,93 Mo compressé) a été écartée après
test : Cesium 1.96 de GeoFS lit la géométrie mais ne marque jamais le modèle prêt, donc avion
invisible. Fusionner les briques par matériau (1 183 primitives → 15) accélérerait la
construction mais casserait le calcul des points d'emport planche par planche sous les ailes.

GeoFS range l'avion courant dans `localStorage.flight` et le recharge au démarrage : l'id 9917 du
MiG y laissait une entrée introuvable, donc un « Could not load aircraft file » au lancement
suivant (versions 1.19.3–1.19.4). L'id de l'avion d'origine est maintenant réécrit après la
bascule, et un enregistrement déjà pollué est réparé au chargement du mod.

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

## Limites connues

- Dégâts **locaux** : GeoFS n'expose aucune API serveur pour détruire l'avion d'un autre
  joueur. L'explosion et le « SPLASH » ne sont visibles que chez toi.
- Missiles et bombes ne sont pas synchronisés en multijoueur.
- Si un appareil n'apparaît pas dans `AIRFRAMES`, active `forceAllAircraft` ou ajoute une entrée.

## Avion bonus — MiG-31 Foxhound (LEGO)

C'est un **vrai avion GeoFS**, chargé sur le principe de l'addon
[Extra Vehicles](https://github.com/af267/GeoFS-Extra-Vehicles) : au lieu d'un
calque posé sur un autre appareil, le MiG-31 est décrit par un `aircraft.json`
complet (ailes, moteurs, train, points de collision, caméras) et GeoFS le
charge comme n'importe quel avion du jeu.

- `assets/mig31/aircraft.json` — définition : 30 t, 2 × 152 kN, 13,46 m
d'envergure, 22,70 m de long, `startAltitude` 3,45 m (ventre du modèle) ;
- `assets/mig31/mig31-lego.glb` — le maillage (**108 781 triangles**, 9,2 Mo),
échelle réelle. Il est reconstruit depuis le GLB ImageToStl du modèle Mecabricks
(1 186 pièces séparées, 1,55 M de faces) : les 42 % de faces intérieures
invisibles sont retirées, puis chaque pièce est simplifiée séparément (une
brique ne peut pas être fondue dans une grande facette voisine). Les couleurs
de pièces sont reprises du `.mtl` d'origine — ImageToStl les avait converties
une seconde fois, ce qui assombrissait tout le modèle — et les 6 décalques
imprimés gardent leurs UV et leurs textures embarquées dans le GLB ;
- chargement : enregistrement dans `geofs.aircraftList` (`{ name, path, local: true }`)
puis `geofs.aircraft.instance.change(id)`. `load()` va chercher `<path>aircraft.json`,
`parseRecord()` l'emballe en enregistrement, `init()` construit l'appareil : c'est la
chaîne du menu « Aircraft » du jeu, utilisée ici au lieu d'un `init()` manuel.

En jeu, la touche **K** (ou le panneau **Armement → Modèle de l'avion**) bascule
entre l'appareil courant et le MiG-31 : physique, train, caméra cockpit et
silhouette propres. L'avion d'origine est mémorisé avant la bascule et restauré
par le bouton « GeoFS ».

La hauteur ne se règle plus à la main : `startAltitude` place le ventre du
modèle à 3,45 m, les points de collision du train touchent le sol, et les
emports du mod se répartissent sous la voilure : les points de collision des
bouts d'aile (± 6,85 m) donnent l'envergure réelle au mod, qui plaçait sinon
les missiles sous le fuselage.

### Décollage et contacts au sol

Le ventre du modèle est au même niveau que le bas des roues : le fuselage pose
donc sur la piste, et le contact `airfoil` (coefficient 2, comme sur un avion
dont les roues dépassent) bloquait l'avion vers 11 m/s plein gaz. `airfoil`
utilise maintenant un contact glissant (`frictionCoef` 0,01) : le MiG roule,
s'accélère et décolle normalement. Les moteurs passent à 152 kN chacun (poussée
de postcombustion ; 93 kN était la poussée à sec, insuffisante pour atteindre
les 200 m/s de `minimumSpeed` avant le bout de la piste).

Le train et les gouvernes ne bougent pas visuellement : le GLB est un maillage
unique, les parties `mainGearLeft`, `aileron`, `rudder`… de `aircraft.json`
n'existent pas comme nœuds à animer. La touche `G` change bien l'état physique
du train (rentrée, points de collision masqués) mais rien ne se voit.

## Interface dédiée

Un bouton **Armement** est ajouté dans la barre du bas de GeoFS, entre
« Location » et « Camera ». Il ouvre un panneau qui résume l'état de
l'armement et permet de changer de modèle d'avion.
