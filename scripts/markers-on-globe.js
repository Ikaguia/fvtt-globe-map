import * as turf from '../lib/turf/turf-bundle.js';
import * as Marker from './markers/index.js';

export class MapMarkers {
	// MapLibre map instance as `map`
	// Foundry scene instance as `scene`
	constructor(map, scene) {
		this.map = map;
		this.scene = scene;
		this.hooks = new Set();
		// Markers
		this.markers = {
			// Tokens
			token: new Marker.Token(this),
			// Notes
			note: {
				ids: new Set(),
				hovering: new Set(),
				dragging: {
					id: null,
					point: null,
					active: false,
				},
			},
			ruler: {
				status: "inactive",
				points: [],
				temp: null,
			},
		}
		// Initial Setup
		this.addMapListeners();
		this.addFoundryHooks();
		this.update();
	}

	destroy() {
		for (const marker of Object.values(this.markers)) marker.destroy?.();
		this.markers.ruler = {};
		this.markers.note.dragging = {};
		this.markers.note.hovering.clear();
		this.markers.note.ids.clear();
		this.clearFoundryHooks();
		this.map.remove();
		this.map = null;
	}

	// --------------------------- //
	// Getters                     //
	// --------------------------- //

	get padding() { return this.scene.padding }
	get width() { return this.scene.width * (1 + 2 * this.padding) - this.scene.grid.sizeX }
	get height() { return this.scene.height * (1 + 2 * this.padding) }
	get tokens() { return this.scene.tokens }
	get rulerCoordinates() {
		const coords = [...this.markers.ruler.points];
		if (this.markers.ruler.temp) coords.push(this.markers.ruler.temp);
		return coords.map(p => [p.lng, p.lat]);
	}
	get rulerSourceData() {
		return {
			type: "Feature",
			geometry: {
				type: "LineString",
				coordinates: this.rulerCoordinates
			}
		}
	}


	// --------------------------- //
	// Marker Creation/Updates     //
	// --------------------------- //

	update() {
		for (const marker of Object.values(this.markers)) marker.updateAll?.();
	}

	// Ruler Markers

	createRulerMarker() {
		// Ruler lines
		this.map.addSource("ruler-lines-source", {
			type: "geojson",
			data: this.rulerSourceData
		});
		this.map.addLayer({
			id: "ruler-lines-layer",
			type: "line",
			source: "ruler-lines-source",
			paint: {
				"line-color": "#ff0000",
				"line-width": 3
			}
		});

		// Ruler labels
		this.map.addSource("ruler-labels-source", {
			type: "geojson",
			data: {
				type: "FeatureCollection",
				features: []
			}
		});
		this.map.addLayer({
			id: "ruler-labels-layer",
			type: "symbol",
			source: "ruler-labels-source",
			layout: {
				"text-field": ["get", "label"],
				"text-size": 24,
				"text-anchor": "top",
				"text-offset": [0, 1],
				"symbol-placement": "point",
				"text-font": ["NotoSans-Medium"],
				"text-allow-overlap": true,
				"text-ignore-placement": true
			},
			paint: {
				"text-color": "#ffffff",
				"text-halo-color": "#000000",
				"text-halo-width": 1
			}
		});
	}

	updateRulerMarker() {
		const coords = this.rulerCoordinates;
		const features = [];
		let totalDistance = 0;

		for (let i = 1; i < coords.length; i++) {
			const [lng1, lat1] = coords[i - 1];
			const [lng2, lat2] = coords[i];

			// Midpoint for label
			const midLng = (lng1 + lng2) / 2;
			const midLat = (lat1 + lat2) / 2;

			// Real distance
			const segment = turf.distance([lng1, lat1], [lng2, lat2], "kilometers");
			totalDistance += segment;

			const data = {
				segment,
				segmentUnit: "km",
				totalDistance,
				totalDistanceUnit: "km",
			};
			if (segment < 1) {
				data.segment *= 1000;
				data.segmentUnit = "m";
			}
			if (totalDistance < 1) {
				data.totalDistance *= 1000;
				data.totalDistanceUnit = "m";
			}

			let label = `${data.segment.toFixed(2)} ${data.segmentUnit}`
			if (i > 1) label += `(${data.totalDistance.toFixed(2)} ${data.totalDistanceUnit})`

			features.push({
				type: "Feature",
				geometry: {
					type: "Point",
					coordinates: [midLng, midLat]
				},
				properties: { label }
			});
		}

		// Update the line itself
		const lineSource = this.map.getSource("ruler-lines-source");
		lineSource?.setData(this.rulerSourceData);

		// Update the labels
		const labelSource = this.map.getSource("ruler-labels-source");
		labelSource?.setData({ type: "FeatureCollection", features });
	}

	deleteRulerMarker() {
		if (this.map.getLayer("ruler-lines-layer")) this.map.removeLayer("ruler-lines-layer");
		if (this.map.getSource("ruler-lines-source")) this.map.removeSource("ruler-lines-source");
		if (this.map.getLayer("ruler-labels-layer")) this.map.removeLayer("ruler-labels-layer");
		if (this.map.getSource("ruler-labels-source")) this.map.removeSource("ruler-labels-source");
	}

	// --------------------------- //
	// Listeners                   //
	// --------------------------- //

	addMapListeners() {
		this.map.on("click", (e) => this.onMapClick(e));
		this.map.on("mousemove", (e) => this.onMouseMove(e));
		this.map.on("mousedown", (e) => this.onMouseDown(e));
		this.map.on("mouseup", (e) => this.onMouseUp(e));
		this.map.getCanvas().addEventListener("mouseleave", (e) => this.onMouseLeaveMap(e));

		for (const marker of Object.values(this.markers)) marker.addMapListeners?.();
	}

	addFoundryHook(hook, foo) {
		const id = Hooks.on(hook, foo);
		this.hooks.add([hook, id]);
	}

	addFoundryHooks() {
		for (const marker of Object.values(this.markers)) marker.addFoundryHooks?.();
	}

	clearFoundryHooks() {
		for (const [hookName, hookID] of this.hooks) Hooks.off(hookName, hookID);
		this.hooks.clear();
	}

	// Primary listeners

	onMapClick(event) {
		const ctrl = event.originalEvent.ctrlKey;

		// Ruler measurement logic
		if (ctrl) {
			if (this.markers.ruler.status === "finished") this.onRulerReset(event);
			this.onRulerAdd(event);
		} else if (this.markers.ruler.status === "active") {
			this.onRulerFinish(event);
		}
		// Regular click logic
		else {
			const features = this.getFeaturesOnPoint(event.point);
			for (const marker of Object.values(this.markers)) {
				const markerFeatures = features[marker.layerID];
				if (markerFeatures?.length) {
					for (const feature of markerFeatures) marker.onClick?.(event, feature.properties.id);
				} else {
					marker.onClick?.(event, null);
				}
			}
		}
	}

	onMouseMove(event) {
		// Trigger ruler drag events
		if (this.markers.ruler.status === "active") this.onRulerDrag(event);
		// Regular mouse move logic
		const features = this.getFeaturesOnPoint(event.point);
		for (const marker of Object.values(this.markers)) marker.onMouseMove?.(event, features[marker.layerID]);
	}

	onMouseLeaveMap(event) {
		// Regular mouse leave logic
		for (const marker of Object.values(this.markers)) marker.onLeaveMap?.(event);
	}

	onMouseDown(event) {
		// Regular mouse down logic
		const features = this.getFeaturesOnPoint(event.point);
		for (const marker of Object.values(this.markers)) {
			const markerFeatures = features[marker.layerID];
			if (markerFeatures?.length) {
				for (const feature of markerFeatures) marker.onGrab?.(event, feature.properties.id);
			} else {
				marker.onGrab?.(event, null);
			}
		}
	}

	onMouseUp(event) {
		// Regular mouse up logic
		const features = this.getFeaturesOnPoint(event.point);
		for (const marker of Object.values(this.markers)) {
			const markerFeatures = features[marker.layerID];
			if (markerFeatures?.length) {
				for (const feature of markerFeatures) marker.onRelease?.(event, feature.properties.id);
			} else {
				marker.onRelease?.(event, null);
			}
		}
	}

	// Ruler handlers

	onRulerAdd(event) {
		const { lng, lat } = this.map.unproject(event.point);
		this.markers.ruler.points.push({ lng, lat });
		this.markers.ruler.temp = null;

		if (this.markers.ruler.status === "inactive") {
			this.markers.ruler.status = "active";
			this.createRulerMarker();
		} else {
			this.updateRulerMarker();
		}
	}

	onRulerDrag(event) {
		if (this.markers.ruler.status !== "active" || this.markers.ruler.points.length === 0) return;
		const { lng, lat } = this.map.unproject(event.point);

		if (!this.markers.ruler.temp) {
			const last_point = this.markers.ruler.points[this.markers.ruler.points.length-1];
			const dlng = Math.abs(lng - last_point.lng);
			const dlat = Math.abs(lat - last_point.lat);
			const distSq = dlng * dlng + dlat * dlat;

			// If more than 3 units from the last point, add a temporary point for where the mouse is
			if (distSq > 9) this.markers.ruler.temp = { lng, lat };
		} else this.markers.ruler.temp = { lng, lat };
		this.updateRulerMarker();
	}

	onRulerFinish(event) {
		this.markers.ruler.temp = null;
		this.markers.ruler.status = "finished";
	}

	onRulerReset(event) {
		this.markers.ruler.points = [];
		this.markers.ruler.temp = null;
		this.markers.ruler.status = "inactive"
		this.deleteRulerMarker();
	}

	// --------------------------- //
	// Helpers                     //
	// --------------------------- //

	sceneToLngLat(x, y) {
		const lng = Math.clamp((x / this.width) * 360 - 180, -180, 180);
		const lat = Math.clamp(90 - (y / this.height) * 180, -90, 90);
		return { lng, lat };
	}

	lngLatToScene(lng, lat) {
		const x = Math.clamp(((lng + 180) / 360) * this.width, 0, this.width);
		const y = Math.clamp(((90 - lat) / 180) * this.height, 0, this.height);
		return { x, y };
	}

	groupFeaturesByLayer(features, layers) {
		const grouped = Object.fromEntries(layers.map(l => [l, []]));
		for (const feature of features) grouped[feature.layer.id].push(feature);
		return grouped;
	}

	getFeaturesOnPoint(point, layers=undefined) {
		if (layers === undefined) {
			const markers = Object.values(this.markers);
			layers = markers.map(marker => marker.layerID).filter(id => id !== undefined);
		}
		const features = this.map.queryRenderedFeatures(point, { layers });
		return this.groupFeaturesByLayer(features, layers);
	}
}
