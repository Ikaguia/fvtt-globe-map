import "../lib/maplibre-gl/maplibre-gl.js";
import layers from "../lib/pathfinder-wiki-maps/src/layers.js";
import * as pmtiles from "../lib/pmtiles/pmtiles-bundle.js";

export function createMap() {
	let root = `${location.protocol}//${location.host}/`;
	let pmtilesProt = new pmtiles.Protocol();
	maplibregl.addProtocol("pmtiles", pmtilesProt.tilev4);

	const map = new maplibregl.Map({
		container: "maplibre-container",
		hash: "location",
		attributionControl: false,
		pitchWithRotate: false,
		style: {
			version: 8,
			sources: {
				golarion: {
					type: "vector",
					attribution:
						'<a href="https://paizo.com/licenses/communityuse">Paizo CUP</a>, ' +
						'<a href="https://github.com/pf-wikis/mapping#acknowledgments">Acknowledgments</a>',
					url: "pmtiles:///modules/fvtt-globe-map/lib/pathfinder-wiki-maps/data/golarion.pmtiles"
				}
			},
			sprite: `${root}/modules/fvtt-globe-map/lib/pathfinder-wiki-maps/data/sprites`,
			layers: layers(),
			glyphs: `modules/fvtt-globe-map/lib/pathfinder-wiki-maps/data/fonts/{fontstack}/{range}.pbf`,
			transition: {
				duration: 300,
				delay: 0
			},
			sky: {
				"atmosphere-blend": 0.5
			}
		}
	});

	const projection = [
		"interpolate",
		["linear"],
		["zoom"],
		4,
		"vertical-perspective",
		5,
		"mercator"
	];

	map.on("style.load", () => {
		map.setProjection({ type: projection });
		Hooks.call("fvtt-globe-map.style.load", map);
	});

	map.keyboard.disable();
	map.dragRotate.disable();

	return [map, projection];
}