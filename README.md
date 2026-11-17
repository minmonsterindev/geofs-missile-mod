# GeoFS — Missile & Bomb Mod

Userscript Tampermonkey : missiles air-air et bombes pour les avions militaires de
[GeoFS](https://www.geo-fs.com/). 100 % autonome — aucun modèle 3D, aucune texture externe :
tout est généré (géométrie Cesium, textures canvas, sons WebAudio).

## Installation

1. Installe l'extension **Tampermonkey**.
2. Ouvre ce lien :
   [geofs-missile-mod.user.js](https://raw.githubusercontent.com/minmonsterindev/geofs-missile-mod/main/geofs-missile-mod.user.js)
3. Tampermonkey propose l'installation : clique sur **Installer**.
4. Va sur <https://www.geo-fs.com/geofs.php>, choisis un avion militaire et décolle.

Les mises à jour arrivent toutes seules : le script déclare `@updateURL` et `@downloadURL`,
Tampermonkey compare `@version` à chaque contrôle (24 h par défaut). Pour forcer : tableau de
bord Tampermonkey → **Check for updates**.

## Commandes

| Touche | Action |
|--------|--------|
| `L` | armer / désarmer |
| `Q` | tirer un missile |
| `*` | choisir le type de missile (avant l'armement) |
| `²` `$` `!` `:` | larguer une bombe |
| `U` | changer de cible |
| `D` | réarmer |
| `Maj + D` | calibrage des points d'emport |

En calibrage : `²` avance, `,` recule, `)` `(` écartent et resserrent, `]` `[` montent et
descendent, `Retour arrière` remet à zéro. Un repère coloré s'affiche sur chaque emport.

## Ce que fait le mod

- positions calculées au rendu (aucune image de retard) via une matrice modèle → ECEF ;
- aile lue dans le **maillage réel** de l'avion (glTF), missiles posés 18 cm sous le dessous de
  voilure et répartis de la racine au bout ;
- 6 types de missiles avec leurs performances propres, textures générées, bombes pour les
  bombardiers (B-2, B-52, B-1B, Tu-160, Tu-95, Concorde).

Le détail technique (repère GeoFS, `modelMatrix`, glTF, mesures par appareil) est dans
[`geofs-api-notes.md`](geofs-api-notes.md).
