export class MapMarkers {
	// MapLibre map instance as `map`
	// Foundry scene instance as `scene`
	constructor(map, scene) {
		this.map = map;
		this.scene = scene;

		this.tokenMarkers = new Set();
		this.hovering = new Set();
		this.draggingId = null;
		this.draggingPoint = null;
		this.draggingActive = false;

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

	// --------------------------- //
	// Marker Creation/Updates     //
	// --------------------------- //

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
		const { lat, lon } = this.sceneToLatLon(x, y);

		console.log(`Creating source and layer for token ${id} at (${lon}, ${lat})`);
		this.map.addSource(`token-source-${id}`, {
			type: "geojson",
			data: {
				type: "FeatureCollection",
				features: [{
					type: "Feature",
					geometry: {
						type: "Point",
						coordinates: [lon, lat],
					},
					properties: {}
				}]
			}
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
		if (id === this.draggingId) return;
		const { x, y } = token;
		const { lat, lon } = this.sceneToLatLon(x, y);

		// console.log(`Updating source for token ${id} at (${lon}, ${lat})`);
		const sourceId = `token-source-${id}`;
		const source = this.map.getSource(sourceId);
		if (!source) return;

		const newData = {
			type: "FeatureCollection",
			features: [{
				type: "Feature",
				geometry: {
					type: "Point",
					coordinates: [lon, lat]
				},
				properties: {}
			}]
		};

		source.setData(newData);
	}

	deleteTokenMarker(id) {
		if (this.map.getLayer(`token-layer-${id}`)) this.map.removeLayer(`token-layer-${id}`);
		if (this.map.getSource(`token-source-${id}`)) this.map.removeSource(`token-source-${id}`);
		this.tokenMarkers.delete(id);
	}

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
		const ids = this.getTokensOnPoint(event.point);

		for (const id of ids) {
			const token = this.scene.tokens.get(id);
			this.onTokenClick(event, token);
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
		if (this.draggingId) this.onTokenDrag(event, this.draggingId);
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
		if (this.draggingId) this.onTokenRelease(event, this.draggingId);
	}

	// Secondary listeners

	onTokenHover(event, token, entering=true) {
		if (entering) {
			if (!this.draggingActive) this.map.getCanvas().style.cursor = "pointer";
			// canvas.tokens.hud.renderHover(token, { hoverOutOthers: true });
		} else {
			if (!this.draggingActive) this.map.getCanvas().style.cursor = "";
			// canvas.tokens.hud.clear();
		}
	}

	onTokenClick(event, token) {
		token?.object?.control({ releaseOthers: true });
	}

	onTokenGrab(event, id) {
		const token = this.scene.tokens.get(id);
		if (token) {
			this.draggingId = id;
			this.draggingPoint = event.point;
			this.draggingActive = false;
			this.map.dragPan.disable();
			this.map.getCanvas().style.cursor = "grabbing";
		}
	}

	onTokenDrag(event, id) {
		// Start dragging if mouse moved far enough
		if (!this.draggingActive) {
			const dx = event.point.x - this.draggingPoint.x;
			const dy = event.point.y - this.draggingPoint.y;
			const distSq = dx * dx + dy * dy;
			if (distSq > 9) { // 3px threshold (squared)
				this.draggingActive = true;
			}
		}

		if (this.draggingActive) {
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
		if (this.draggingActive) {
			const token = this.scene.tokens.get(id);
			if (!token) return;

			// Convert lng/lat → Foundry scene coordinates
			const { lng, lat } = this.map.unproject(event.point);
			const { x, y } = this.latLonToScene(lat, lng);

			token.update({ x, y }, { animation: { duration: 1000 } });
			token.object.control();
		}
		this.draggingId = null;
		this.draggingPoint = null;
		this.draggingActive = false;
		this.map.dragPan.enable();
		this.map.getCanvas().style.cursor = "";
	}

	// --------------------------- //
	// Helpers                     //
	// --------------------------- //

	sceneToLatLon(x, y) {
		const lon = Math.clamp((x / this.width) * 360 - 180, -180, 180);
		const lat = Math.clamp(90 - (y / this.height) * 180, -90, 90);
		return { lat, lon };
	}

	latLonToScene(lat, lon) {
		const x = Math.clamp(((lon + 180) / 360) * this.width, 0, this.width);
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
