import * as turf from '../lib/turf/turf-bundle.js';

export class MapMarkers {
	// MapLibre map instance as `map`
	// Foundry scene instance as `scene`
	constructor(map, scene) {
		this.map = map;
		this.scene = scene;
		// Tokens
		this.tokenMarkers = new Set();
		this.hovering = new Set();
		// Token Dragging
		this.dragging = {
			id: null,
			point: null,
			active: false,
		}
		// Ruler Measurement
		this.ruler = {
			status: "inactive",
			points: [],
			temp: null
		}
		// Initial Setup
		this.addMapListeners();
		this.update();
	}

	// --------------------------- //
	// Getters                     //
	// --------------------------- //

	get padding() { return this.scene.padding }
	get width() { return this.scene.width * (1 + 2 * this.padding) - this.scene.grid.sizeX }
	get height() { return this.scene.height * (1 + 2 * this.padding) }
	get tokens() { return this.scene.tokens }
	get rulerCoordinates() {
		const coords = [...this.ruler.points];
		if (this.ruler.temp) coords.push(this.ruler.temp);
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
		const oldIds = new Set(this.tokenMarkers);
		const newIDs = new Set(this.tokens.map(t => t.id));
		const toDelete = oldIds.difference(newIDs);
		const toUpdate = oldIds.intersection(newIDs);
		const toCreate = newIDs.difference(oldIds);

		// Clear deleted markers
		toDelete.forEach(id => this.deleteTokenMarker(id));
		// Update old markers
		toUpdate.forEach(id => this.updateTokenMarker(this.tokens.get(id)));
		// Create new markers
		toCreate.forEach(id => this.createTokenMarker(this.tokens.get(id)));
	}

	// Token Markers

	tokenSourceData(lng, lat) {
		return {
			type: "FeatureCollection",
			features: [{
				type: "Feature",
				geometry: {
					type: "Point",
					coordinates: [lng, lat]
				},
				properties: {}
			}]
		};
	}

	createTokenMarker(token) {
		this.createImage(token);
		this.createTokenSourceLayer(token);
	}

	async createImage(token) {
		const id = `token-icon-${token.id}`;
		const url = token.texture.src;

		const image = await this.map.loadImage(url);
		if (!this.map.hasImage(id)) {
			console.log(`Adding image for token: ${id}, url: ${url}`);
			this.map.addImage(id, image.data);
		}
	}

	createTokenSourceLayer(token) {
		const id = token.id ?? token._id;
		const { x, y } = token;
		const { lng, lat } = this.sceneToLngLat(x, y);

		console.log(`Creating source and layer for token ${id} at (${lng}, ${lat})`);
		this.map.addSource(`token-source-${id}`, {
			type: "geojson",
			data: this.tokenSourceData(lng, lat),
		});

		this.map.addLayer({
			id: `token-layer-${id}`,
			type: "symbol",
			source: `token-source-${id}`,
			layout: {
				"icon-image": `token-icon-${id}`,
				"icon-size": 0.25,
				"icon-allow-overlap": true
			}
		});

		this.tokenMarkers.add(id);
	}

	updateTokenMarker(token, updateImage=false) {
		if (updateImage) this.updateImage(token);
		this.updateTokenSource(token);
	}

	async updateImage(token) {
		const id = token.id;
		const iconID = `token-icon-${token.id}`;
		const url = token.texture.src;

		const image = await this.map.loadImage(url);
		if (!this.map.hasImage(iconID)) {
			console.log(`Adding image for token: ${iconID}, url: ${url}`);
			this.map.addImage(iconID, image.data);
		} else {
			console.log(`Updating image for token: ${iconID}, url: ${url}`);
			this.map.updateImage(iconID, image.data);
		}

		this.map.removeLayer(`token-layer-${id}`);
		this.map.addLayer({
			id: `token-layer-${id}`,
			type: "symbol",
			source: `token-source-${id}`,
			layout: {
				"icon-image": iconID,
				"icon-size": 0.25,
				"icon-allow-overlap": true
			}
		});
	}

	updateTokenSource(token) {
		const id = token.id ?? token._id;
		if (id === this.dragging.id) return;
		const { x, y } = token;
		const { lng, lat } = this.sceneToLngLat(x, y);

		// console.log(`Updating source for token ${id} at (${lng}, ${lat})`);
		const sourceId = `token-source-${id}`;
		const source = this.map.getSource(sourceId);
		if (!source) return;

		source.setData(this.tokenSourceData(lng, lat));
	}

	deleteTokenMarker(id) {
		if (this.map.getLayer(`token-layer-${id}`)) this.map.removeLayer(`token-layer-${id}`);
		if (this.map.getSource(`token-source-${id}`)) this.map.removeSource(`token-source-${id}`);
		this.tokenMarkers.delete(id);
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

			features.push({
				type: "Feature",
				geometry: {
					type: "Point",
					coordinates: [midLng, midLat]
				},
				properties: {
					label: `${data.segment.toFixed(2)} ${data.segmentUnit} (${data.totalDistance.toFixed(2)} ${data.totalDistanceUnit})`
				}
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
		this.map.getCanvas().addEventListener("mouseleave", (e) => this.onMouseLeave(e));
	}

	// Primary listeners

	onMapClick(event) {
		const ctrl = event.originalEvent.ctrlKey;

		// Ruler measurement logic
		if (ctrl) {
			if (this.ruler.status === "finished") this.onRulerReset(event);
			this.onRulerAdd(event);
		} else if (this.ruler.status === "active") {
			this.onRulerFinish(event);
		}
		// Regular token click logic
		else {
			const ids = this.getTokensOnPoint(event.point);
			for (const id of ids) {
				const token = this.scene.tokens.get(id);
				this.onTokenClick(event, token);
			}
		}
	}

	onMouseMove(event) {
		// Trigger token hover events
		if (true) {
			const newIDs = this.getTokensOnPoint(event.point);
			const toDelete = this.hovering.difference(newIDs);
			const toAdd = newIDs.difference(this.hovering);

			// All tokens no longer being hovered over
			for (const id of toDelete) {
				const token = this.scene.tokens.get(id);
				if (token) this.onTokenHover(event, token, false);
			}
			// All new tokens being hovered over
			for (const id of toAdd) {
				const token = this.scene.tokens.get(id);
				if (token) this.onTokenHover(event, token, true);
			}

			this.hovering = newIDs;
		}
		// Trigger token drag events
		if (this.dragging.id) this.onTokenDrag(event, this.dragging.id);
		// Trigger ruler drag events
		if (this.ruler.status === "active") this.onRulerDrag(event);
	}

	onMouseLeave(event) {
		// Trigger token unhover events
		for (const id of this.hovering) {
			const token = this.scene.tokens.get(id);
			if (token) this.onTokenHover(event, token, false);
		}
		this.hovering.clear();
	}

	onMouseDown(event) {
		const ids = this.getTokensOnPoint(event.point);
		if (ids.size > 0) this.onTokenGrab(event, [...ids][0]);
	}

	onMouseUp(event) {
		if (this.dragging.id) this.onTokenRelease(event, this.dragging.id);
	}

	// Token handlers

	onTokenHover(event, token, entering=true) {
		if (entering) {
			if (!this.dragging.active) this.map.getCanvas().style.cursor = "pointer";
			// canvas.tokens.hud.renderHover(token, { hoverOutOthers: true });
		} else {
			if (!this.dragging.active) this.map.getCanvas().style.cursor = "";
			// canvas.tokens.hud.clear();
		}
	}

	onTokenClick(event, token) {
		token?.object?.control({ releaseOthers: true });
	}

	onTokenGrab(event, id) {
		const token = this.scene.tokens.get(id);
		if (token) {
			this.dragging.id = id;
			this.dragging.point = event.point;
			this.dragging.active = false;
			this.map.dragPan.disable();
			this.map.getCanvas().style.cursor = "grabbing";
		}
	}

	onTokenDrag(event, id) {
		// Start dragging if mouse moved far enough
		if (!this.dragging.active) {
			const dx = event.point.x - this.dragging.point.x;
			const dy = event.point.y - this.dragging.point.y;
			const distSq = dx * dx + dy * dy;
			// 3px threshold (squared)
			this.dragging.active = distSq > 9;
		}

		if (this.dragging.active) {
			const { lng, lat } = this.map.unproject(event.point);
			const source = this.map.getSource(`token-source-${id}`);
			if (!source) return;
			const data = {
				type: "FeatureCollection",
				features: [{
					type: "Feature",
					geometry: {
						type: "Point",
						coordinates: [lng, lat]
					},
					properties: {}
				}]
			};

			source.setData(data);
		}
	}

	onTokenRelease(event, id) {
		if (this.dragging.active) {
			const token = this.scene.tokens.get(id);
			if (!token) return;

			// Convert lng/lat → Foundry scene coordinates
			const { lng, lat } = this.map.unproject(event.point);
			const { x, y } = this.lngLatToScene(lng, lat);

			token.update({ x, y }, { animation: { duration: 1000 } });
			token.object.control();
		}
		this.dragging.id = null;
		this.dragging.point = null;
		this.dragging.active = false;
		this.map.dragPan.enable();
		this.map.getCanvas().style.cursor = "";
	}

	// Ruler handlers

	onRulerAdd(event) {
		console.debug('onRulerAdd', event);
		const { lng, lat } = this.map.unproject(event.point);
		this.ruler.points.push({ lng, lat });
		this.ruler.temp = null;

		if (this.ruler.status === "inactive") {
			this.ruler.status = "active";
			this.createRulerMarker();
		} else {
			this.updateRulerMarker();
		}
		console.debug('ruler', this.ruler);
	}

	onRulerDrag(event) {
		console.debug('onRulerDrag', event);
		if (this.ruler.status !== "active" || this.ruler.points.length === 0) return;
		const { lng, lat } = this.map.unproject(event.point);

		if (!this.ruler.temp) {
			const last_point = this.ruler.points[this.ruler.points.length-1];
			const dlng = Math.abs(lng - last_point.lng);
			const dlat = Math.abs(lat - last_point.lat);
			const distSq = dlng * dlng + dlat * dlat;

			// If more than 3 units from the last point, add a temporary point for where the mouse is
			if (distSq > 9) this.ruler.temp = { lng, lat };
		} else this.ruler.temp = { lng, lat };
		this.updateRulerMarker();
		console.debug('ruler', this.ruler);
	}

	onRulerFinish(event) {
		console.debug('onRulerFinish', event);
		this.ruler.temp = null;
		this.ruler.status = "finished";
		console.debug('ruler', this.ruler);
	}

	onRulerReset(event) {
		console.debug('onRulerReset', event);
		this.ruler.points = [];
		this.ruler.temp = null;
		this.ruler.status = "inactive"
		this.deleteRulerMarker();
		console.debug('ruler', this.ruler);
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

	getMarkersOnPoint(point) {
		return this.map.queryRenderedFeatures(point, { layers: this.tokenMarkers.map(id => `token-layer-${id}`) });
	}

	getTokensOnPoint(point) {
		return new Set(this.getMarkersOnPoint(point).map(m => m.layer.id.replace("token-layer-", "")));
	}
}
