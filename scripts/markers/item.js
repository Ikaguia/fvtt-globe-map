import { Marker } from "./marker.js";

export class ItemMarker extends Marker {
	// Setup
	constructor(mapMarkers) {
		super(mapMarkers);
	}
	reset() {
		super.reset();
		this.ids = new Set();
		this.features = [];
		this.scalableFeatures = [];
		this.hovering = new Set();
		this.dragging = {
			id: null,
			point: null,
			active: false,
		};
		this.deleteSourceLayers();
		this.createSourceLayers();

		this.updateAll();
	}
	destroy() {
		this.deleteSourceLayers();
		super.destroy();
	}

	// Marker Functions
	createMarker(data={}) {
		super.createMarker(data);
		const { id } = data;
		if (!id || this.ids.has(id) || !this.itemVisible(data)) return;
		this.ids.add(id);
		this.createImage(data);
		this.createFeature(data);
	}
	updateMarker(data={}) {
		super.updateMarker(data);
		const { id } = data;
		if (!this.itemVisible(data)) this.deleteMarker(data);
		else {
			if (!this.ids.has(id)) this.createMarker(data);
			if (data.updateImage === true) this.updateImage(data);
			this.updateFeature(data);
		}
	}
	deleteMarker(data={}) {
		const { id } = data;
		if (!id || !this.ids.has(id)) return;
		this.ids.delete(id);
		this.deleteFeature(data);
		super.deleteMarker(data);
	}

	// Item Functions
	updateAll() {
		const newIDs = this.sceneItems;
		const toCreate = newIDs.difference(this.ids);
		const toUpdate = this.ids.intersection(newIDs);
		const toDelete = this.ids.difference(newIDs);

		// Create new markers
		toCreate.forEach(id => this.createMarker({ item: this.getItem(id), id }));
		// Update old markers
		toUpdate.forEach(id => this.updateMarker({ item: this.getItem(id), id }));
		// Clear deleted markers
		toDelete.forEach(id => this.deleteMarker({ item: this.getItem(id), id }));
	}
	// Create
	createSourceLayers(data={}) {
		if (!this.source) {
			this.map.addSource(this.sourceID, {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: []
				}
			});
		}
		if (!this.layer) {
			this.map.addLayer({
				id: this.layerID,
				type: "symbol",
				source: this.sourceID,
				layout: {
					"icon-image": ["get", "imageID"],
					"icon-size": 0.25,
					"icon-allow-overlap": true,
				}
			});
		}
		if (!this.scalableSource) {
			this.map.addSource(this.scalableSourceID, {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: []
				}
			});
		}
		if (!this.scalableLayer) {
			this.map.addLayer({
				id: this.scalableLayerID,
				type: "symbol",
				source: this.scalableSourceID,
				layout: {
					"icon-image": ["get", "imageID"],
					"icon-size": this.worldRelativeIconSize(20, 400),
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
				}
			});
		}
	}
	async createImage(data={}) {
		const { item, id } = data;
		if (!id || !item) return;
		const imageURL = this.getImageURL(item);
		const imageID = this.getImageID(id);

		const image = await this.map.loadImage(imageURL);
		const size = this.getSize(id);
		if (!this.map.hasImage(imageID)) {
			const normalizedImage = await this.normalizeImageSize(image, 64 * size);
			console.log(`Adding image for ${this.type}: ${id}, url: ${imageURL}`);
			this.map.addImage(imageID, normalizedImage);
		}
	}
	createFeature(data={}) {
		let { id, item, lng, lat } = data;
		if (!id) return;

		if (!lng || !lat) {
			if (!item) return;
			const { x, y } = item;
			const lngLat = this.sceneToLngLat(x, y);
			lng = lngLat.lng;
			lat = lngLat.lat;
		}

		const imageID = this.getImageID(id);

		const scalable = this.getScalable(id);
		const features = scalable ? this.scalableFeatures : this.features;
		const source = scalable ? this.scalableSource : this.source;
		features.push({
			type: "Feature",
			geometry: {
				type: "Point",
				coordinates: [lng, lat]
			},
			properties: {
				id,
				imageID,
			},
		});
		source?.setData?.({ type: "FeatureCollection", features });
	}
	// Update
	async updateImage(data={}) {
		const { item, id } = data;
		if (!id || !item) return;
		const imageURL = this.getImageURL(item);
		const imageID = this.getImageID(id);
		const size = this.getSize(id);

		const image = await this.map.loadImage(imageURL);
		const normalizedImage = await this.normalizeImageSize(image, 64 * size);
		if (this.map.hasImage(imageID)) {
			console.log(`Updating image for ${this.type}: ${id}, url: ${imageURL}`);
			this.map.removeImage(imageID);
		} else {
			console.log(`Adding image for ${this.type}: ${id}, url: ${imageURL}`);
		}
		this.map.addImage(imageID, normalizedImage);
	}
	updateFeature(data={}) {
		let { id, item, lng, lat } = data;
		if (!id) return;

		if (!lng || !lat) {
			if (!item) return;
			const { x, y } = item;
			const lngLat = this.sceneToLngLat(x, y);
			lng = lngLat.lng;
			lat = lngLat.lat;
		}

		const feature1 = this.features.find(f => f.properties.id === id);
		const feature2 = this.scalableFeatures.find(f => f.properties.id === id);
		if (!!feature1 === !!feature2) {
			this.deleteFeature(data);
			this.createFeature(data);
			return;
		}

		if (data.updateScalable) {
			const scalable = this.getScalable(id);
			if ((scalable && feature1) || (!scalable && feature2)) {
				this.deleteFeature(data);
				this.createFeature(data);
				return;
			}
		}

		const feature = feature1 || feature2;
		const features = feature1 ? this.features : this.scalableFeatures;
		const source = feature1 ? this.source : this.scalableSource;

		feature.geometry.coordinates = [lng, lat];
		source?.setData?.({ type: "FeatureCollection", features });
	}
	// Delete
	deleteSourceLayers(data={}) {
		if (this.source) this.map.removeSource(this.sourceID);
		if (this.layer) this.map.removeLayer(this.layerID);
		if (this.scalableSource) this.map.removeSource(this.scalableSourceID);
		if (this.scalableLayer) this.map.removeLayer(this.scalableLayerID);
	}
	deleteFeature(data={}) {
		const { id } = data;
		if (!id) return;

		const feature = this.features.findIndex(f => f.properties.id === id);
		if (feature) {
			this.features.splice(feature, 1);
			this.source?.setData?.({ type: "FeatureCollection", features: this.features });
		}
		const scalableFeature = this.scalableFeatures.findIndex(f => f.properties.id === id);
		if (scalableFeature) {
			this.scalableFeatures.splice(scalableFeature, 1);
			this.scalableSource?.setData?.({ type: "FeatureCollection", features: this.scalableFeatures });
		}
	}

	// Getters
	get type() { throw new Error(`${this.constructor.name}.type() must be implemented.`); }
	get sceneItems() { throw new Error(`${this.constructor.name}.sceneItems() must be implemented.`); }
	get sourceID() { return `${this.type}-source`; }
	get source() { return this.map.getSource(this.sourceID); }
	get layerID() { return `${this.type}-layer`; }
	get layer() { return this.map.getLayer(this.layerID); }
	get scalableSourceID() { return `${this.type}-scalable-source`; }
	get scalableSource() { return this.map.getSource(this.scalableSourceID); }
	get scalableLayerID() { return `${this.type}-scalable-layer`; }
	get scalableLayer() { return this.map.getLayer(this.scalableLayerID); }
	get sourceIDs() { return [this.sourceID, this.scalableSourceID]; }
	get layerIDs() { return [this.layerID, this.scalableLayerID]; }

	// Utility functions
	getItem(id) { throw new Error(`${this.constructor.name}.getItem() must be implemented.`); }
	getId(item) { return item.id ?? item._id; }
	getImageURL(item) { return item.texture.src; }
	getImageID(id) { return `${this.type}-image-${id}` }
	getImage(id) { return this.map.getImage(this.getImageID(id)); }
	// getSize(id) { return 1 / this.mapMarkers.gridWidth; }
	getSize(id) { return 1; }
	getScalable(id) { throw new Error(`${this.constructor.name}.getItem() must be implemented.`); }
	itemVisible(data) {
		const item = data.item ?? this.getItem(data.id);
		return item && (!item.hidden || game.user.isGM);
	}
	hasPermission(data, permission="OWNER") {
		const item = data.item ?? this.getItem(data.id);
		return item?.testUserPermission(game.user, permission);
	}
	worldRelativeIconSize(targetZoom = 10, baseSize = 1.0) {
		return [
			"interpolate",
			["exponential", 2],
			["zoom"],
			0, baseSize * Math.pow(2, 0 - targetZoom),
			20, baseSize * Math.pow(2, 20 - targetZoom),
		];
	}
	async normalizeImageSize(image, size = 64) {
		if (image.size === size) return image.data;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;

		const ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, size, size);
		ctx.drawImage(image.data, 0, 0, size, size);

		return await createImageBitmap(canvas);
	}


	// Hooks
	// addFoundryHooks() {
	// 	super.addFoundryHooks();
	// }
	addMapListeners() {
		super.addMapListeners();
	}

	// Event handlers
	//// Generic
	onMouseMove(event, hovering) {
		if (this.dragging.id) this.onDrag(event, { id: this.dragging.id });

		const newIDs = new Set(hovering.map(f => f.properties.id));
		const toUnhover = this.hovering.difference(newIDs);
		const toHover = newIDs.difference(this.hovering);

		toUnhover.forEach(id => this.onHover(event, id, false));
		toHover.forEach(id => this.onHover(event, id, true));
	}
	onLeaveMap(event) {
		for (const id of this.hovering) this.onHover(event, id, false);
	}
	//// Specific Item
	onHover(event, properties={}, entering=true) {
		const { id } = properties;
		if (!id || this.dragging.id) return;
		if (entering) {
			this.hovering.add(id);
			this.map.getCanvas().style.cursor = "pointer";
		} else {
			this.hovering.delete(id);
			if (!this.hovering.size) this.map.getCanvas().style.cursor = "";
		}
	}
	onClick(event, properties={}) {
		const { id } = properties;
		if (!id || this.dragging.id) return;
		const item = this.getItem(id);
		item?.object?.control?.({ releaseOthers: true });
	}
	onGrab(event, properties={}) {
		const { id } = properties;
		if (!id || !this.hasPermission({ id }, "OWNER") || this.dragging.id) return;
		for (const _id of this.hovering) this.onHover(event, _id, false);

		this.dragging.id = id;
		this.dragging.point = event.point;
		this.dragging.active = false;
		this.map.dragPan.disable();
		this.map.getCanvas().style.cursor = "grabbing";
	}
	onDrag(event, properties={}) {
		const { id } = properties;
		if (!id) return;
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
			this.updateFeature({ id, lng, lat });
		}
	}
	onRelease(event, properties={}) {
		if (this.dragging.active) {
			// Convert lng/lat → Foundry scene coordinates
			const { lng, lat } = this.map.unproject(event.point);
			const { x, y } = this.lngLatToScene(lng, lat);

			const item = this.getItem(this.dragging.id);
			item?.update({ x, y }, { animation: { duration: 1000 } });
			item?.object?.control();
		}
		this.dragging.id = null;
		this.dragging.point = null;
		this.dragging.active = false;
		this.map.dragPan.enable();
		this.map.getCanvas().style.cursor = "";
	}
}
