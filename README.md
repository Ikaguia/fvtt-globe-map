![](https://img.shields.io/badge/Foundry-v13-informational)

# FVTT Globe Map

Adds a globe map to your foundry scenes.

To try it out, after installing the module, create a new scene and check the Enable MapLibre Globe checkbox in the scene configuration.

Should be save to add and remove to any world, only data that is saved is the checkbox above, and only in the scene flags.

## Instalation

To install and use this module, simply paste the following URL into the Install Module dialog on the Setup menu of the application.

https://github.com/Ikaguia/fvtt-globe-map/releases/latest/download/module.json

## Changelog

### [Unreleased]

- Initial globe position is now based on initial scene position (use shift ping + 'capture current view' to set initial view)

### [0.0.9]

- Token/Note Markers now only show up when not hidden (or to GMs)
- Notes will only be opened if you have at least limited permission
- Wiki Links are now restricted to trusted players +
- Map data updated

### [0.0.8]

- Pathfinder Wiki Links have been integrated
  - Alt + Hover on a symbol or label that has an associated link, will change the cursor
  - Alt + Click on such features will open the link on a new tab

### [0.0.7]

- Pings can now be made on the map
  - They are syncronized with scene pings
  - [nothing/alt/shift] + Long Press for regular/alert/pan ping

### [0.0.6]

- Minimized map is now interactable
- Globe will be removed when switching scenes
- Map Journal Entries have been added
  - Scene Journal Entries will be rendered on map, if their image is not a .svg file
  - They can be dragged around just like tokens
  - Clicking on one on the map will open the relevant Journal Entry

### [0.0.5]

- Added measurement ruler (cntrl + click to start)

### [0.0.4]

- Tokens can now be selected and dragged from the map

### [0.0.2 and 0.03]

- Fix release workflow

### [0.0.1]

- Initial Release

## Credits

All of the map files and a lot of the logic is pulled from https://github.com/pf-wikis/mapping.

Here is the acknowledgements info from their repo:

## Acknowledgments

This mapping project uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy ([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We are expressly prohibited from charging you to use or access this content. This mapping project is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit [paizo.com](https://paizo.com).

Significant data in this project is based on GIS data first compiled by [John Mechalas](https://www.dungeonetics.com/golarion-geography/index.html) and contributions to that project from Oznogon, who produced and previously hosted the [first interactive map](https://oznogon.com/golarion-tile) from that data.

Several contributors have provided or updated coordinates and geometry in this project, as visible in the history of this repository and the pf-wikis/mapping-data repository. Others have contributed city and point-of-interest positions by editing PathfinderWiki articles, as visible in the History tab of each city and location's related articles or the [PathfinderWiki:Map Locations Without Articles](https://pathfinderwiki.com/wiki/PathfinderWiki:Map_Locations_Without_Articles) project page.
