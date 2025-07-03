export class TokenMarkers {
	// MapLibre map instance as `map`
	// Foundry scene instance as `scene`
	constructor(map, scene) {
		this.map = map;
		this.scene = scene;
		this.tokenMarkers = new Set();

		this.update();
	}

	get padding() { return this.scene.padding }
	get width() { return this.scene.width * (1 + 2 * this.padding) - this.scene.grid.sizeX }
	get height() { return this.scene.height * (1 + 2 * this.padding) }
	get tokens() { return this.scene.tokens }

	sceneToLatLon(x, y) {
		const lon = Math.clamp((x / this.width) * 360 - 180, -180, 180);
		const lat = Math.clamp(90 - (y / this.height) * 180, -90, 90);
		return { lat, lon };
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
		const newIds = new Set(this.tokens.map(t => t.id));
		const toDelete = oldIds.difference(newIds);
		const toUpdate = oldIds.intersection(newIds);
		const toCreate = newIds.difference(oldIds);

		// Clear deleted markers
		toDelete.forEach(id => this.deleteTokenMarker(id));
		// Update old markers
		toUpdate.forEach(id => this.updateTokenMarker(this.tokens.get(id)));
		// Create new markers
		toCreate.forEach(id => this.createTokenMarker(this.tokens.get(id)));
	}
}
