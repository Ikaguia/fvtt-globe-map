import "../lib/maplibre-gl/maplibre-gl.js";
import {layers} from "../lib/pathfinder-wiki-maps/src/layers.ts";

Hooks.once('init', async function() {
	// CONFIG.debug.hooks = true;
});

Hooks.once('ready', async function() {
	const maplibregl = window.maplibregl;
});

Hooks.on("canvasReady", (canvas) => {
	const enabled = canvas.scene.getFlag("fvtt-globe-map", "enabled");
	if (!enabled) return;

	const container = document.createElement("div");
	container.id = "maplibre-container";
	Object.assign(container.style, {
		position: "absolute",
		top: 0,
		left: 0,
		width: "100%",
		height: "100%",
		zIndex: 50
	});
	document.body.appendChild(container);

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
					url: "pmtiles://https://map.pathfinderwiki.com/data/golarion.pmtiles"
				}
			},
			sprite: "https://map.pathfinderwiki.com/sprites/sprites",
			layers: layers(),
			glyphs: "https://map.pathfinderwiki.com/fonts/{fontstack}/{range}.pbf",
			transition: {
				duration: 300,
				delay: 0
			},
			sky: {
				"atmosphere-blend": 0.5
			}
		}
	});

	// const projection = [
	// 	"interpolate",
	// 	["linear"],
	// 	["zoom"],
	// 	4,
	// 	"vertical-perspective",
	// 	5,
	// 	"mercator"
	// ];

	const projection = "globe";

	map.on("style.load", () => {
		map.setProjection({ type: projection });
	});

});

Hooks.on("renderSceneConfig", (app, html, data) => {
	const $html = $(html);

	const current = foundry.utils.getProperty(app.document, "flags.fvtt-globe-map.enabled");

	const flagHtml = $(`
		<div class="form-group">
			<label>Enable MapLibre Globe</label>
			<input type="checkbox" name="flags.fvtt-globe-map.enabled" ${current ? "checked" : ""}/>
		</div>
	`);

	$html.find("div[data-tab='basics']").append(flagHtml);
});
