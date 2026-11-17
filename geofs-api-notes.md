# GeoFS — ce que la console du jeu m'a appris

Notes prises en direct dans `https://www.geo-fs.com/geofs.php` (navigateur intégré,
console injectée), pour ne pas avoir à tout re-mesurer. Mis à jour le 2026-11-17.

## Repère de l'avion

`geofs.aircraft.instance.object3d.worldRotation` = tableau de **3 tableaux de 3 nombres**.
Chaque ligne est un axe du modèle exprimé en **est-nord-haut** :

| ligne | axe | vérification |
|---|---|---|
| `wr[0]` | x du modèle | colonne 0 de `modelMatrix` ramenée en ENU |
| `wr[1]` | y du modèle | colonne 1 |
| `wr[2]` | z du modèle | colonne 2 |

Mesuré : conversion en ENU au dix-millième près. Les trois lignes sont orthonormées.

Autres champs utiles : `llaLocation` = `[lat, lon, alt]`, `htr` = `[cap, assiette, roulis]`
en degrés, `object3d.worldPosition` reste `[0,0,0]`.

## Matrice réelle du modèle

`geofs.aircraft.instance.object3d.model._model.modelMatrix` = `Cesium.Matrix4` (colonne-major)
qui place le modèle dans le monde. Colonnes 0/1/2 = axes x/y/z du modèle en ECEF,
colonne 3 = position. C'est la vérité terrain : `Matrix4.inverse(modelMatrix) × position`
donne la position exacte en coordonnées modèle.

**Piège** : `new Cesium.Matrix4(a, b, …)` ignore ses arguments et rend l'identité.
Il faut `Matrix4.fromColumnMajorArray([...], new Matrix4())`.

## Maillage (glTF)

`object3d.model._model._cachedGltf.gltf` : `nodes`, `meshes`, `accessors` (avec `min`/`max`).
Le fichier est en **Y en haut** ; Cesium applique `(x, y, z) → (x, −z, y)`. Donc en repère Cesium :

- `x` = envergure (gauche/droite)
- `y` = longueur (positif vers le nez)
- `z` = hauteur (positif vers le haut)

Le maillage se charge **après** `aircraft.instance.change(id)` : attendre ~2 s avant de le lire.

## Définitions d'appareils

`geofs.aircraftList` est un objet à clés numériques (`'7'`, `'18'`, …) avec
`{ name, dir, path, multiplayerFiles, community }`. Le modèle se télécharge sur
`<path>aircraft.json`, qui est un **tableau** : `[ { mass, parts: [...] } ]`.

Parts observées :

- `body` : la **seule** partie qui porte des `collisionPoints` (boîte grossière) ;
- les ailes : `points.forceSourcePoint` uniquement, ex. `leftWing = [-4, -0.7, 0]` ;
- **aucune** partie `pylon`, `hardpoint`, `missile`, `store`, `rack` — ni sur le Su-35, ni sur le
  F-16, ni sur le Rafale, ni sur le B-2.

Charger un appareil depuis la console : `geofs.aircraft.instance.change('18')` (id de la liste).
Fonctionne aussi pour les appareils « premium » en invité.

## Géométrie mesurée

Boîtes `collisionPoints` (repère GeoFS) :

| Appareil | demi-envergure | demi-longueur | ventre | haut |
|---|---|---|---|---|
| Su-35 | 7,3 | 12,5 | −0,3 (fuselage) / −1,2 (train) | 3,9 |
| F-16 | 5,1 | 8,2 | −0,9 / −1,4 | 3,6 |
| Rafale | 5,0 | 8,3 | −0,75 / −1,5 | 3,3 |
| B-2 | 17,2 | 5,0 | 3,0 (aile) / −3,3 (train) | 3,0 |

Aile réelle lue dans le maillage :

| Appareil | racine → bout | corde | dessous de voilure |
|---|---|---|---|
| Su-35 | 2,05 → 6,43 | −2,15 → 2,61 | **0,21 m** (épaisseur jusqu'à 0,47) |
| F-16 | aile fondue dans `body` | — | non lisible |
| Rafale | volet plus large que l'aile | — | non lisible |

Conséquence : sur le Su-35, un missile « sous l'aile » est à `z ≈ 0,03`, pas à `−0,45`.
