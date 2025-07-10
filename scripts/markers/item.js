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
		this.hovering = new Set();
		this.dragging = {
			id: null,
			point: null,
			active: false,
		};
		this.deleteSourceLayer();
		this.createSourceLayer();

		this.updateAll();
	}
	destroy() {
		this.deleteSourceLayer();
		super.destroy();
	}

	// Marker Functions
	createMarker(data={}) {
		super.createMarker(data);
		const { id } = data;
		if (!id) return;
		this.ids.add(id);
		this.createImage(data);
		this.createFeature(data);
	}
	updateMarker(data={}) {
		super.updateMarker(data);
		if (data.updateImage === true) this.updateImage(data);
		this.updateFeature(data);
	}
	deleteMarker(data={}) {
		const { item, id } = data;
		if (!id || !item) return;
		this.ids.delete(id);
		this.deleteFeature(data);
		super.deleteMaker(data);
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
	createSourceLayer(data={}) {
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
	}
	async createImage(data={}) {
		const { item, id } = data;
		if (!id || !item) return;
		const imageURL = this.getImageURL(item);
		const imageID = this.getImageID(id);

		const image = await this.map.loadImage(imageURL);
		if (!this.map.hasImage(imageID)) {
			console.log(`Adding image for ${this.type}: ${id}, url: ${imageURL}`);
			this.map.addImage(imageID, image.data);
		}
	}
	createFeature(data={}) {
		const { item, id } = data;
		if (!id || !item) return;

		const { x, y } = item;
		const { lng, lat } = this.sceneToLngLat(x, y);
		const imageID = this.getImageID(id);

		const source = this.source;
		this.features.push({
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
		source.setData({ type: "FeatureCollection", features: this.features });
	}
	// Update
	async updateImage(data={}) {
		const { item, id } = data;
		if (!id || !item) return;
		const imageURL = this.getImageURL(item);
		const imageID = this.getImageID(id);

		const image = await this.map.loadImage(imageURL);
		if (this.map.hasImage(imageID)) {
			console.log(`Updating image for ${this.type}: ${id}, url: ${imageURL}`);
			this.map.updateImage(imageID, image.data);
		} else {
			console.log(`Adding image for ${this.type}: ${id}, url: ${imageURL}`);
			this.map.addImage(imageID, image.data);
		}
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

		const source = this.source;
		this.features.forEach(f => {
			if (f.properties.id === id) f.geometry.coordinates = [lng, lat];
		});
		source.setData({ type: "FeatureCollection", features: this.features });
	}
	// Delete
	deleteSourceLayer(data={}) {
		if (this.source) this.map.removeSource(this.sourceID);
		if (this.layer) this.map.removeLayer(this.layerID);
	}
	deleteFeature(data={}) {
		const { id } = data;
		if (!id) return;

		const source = this.source;
		this.features = this.features.filter(f => f.properties.id !== id);
		source.setData({ type: "FeatureCollection", features: this.features });
	}

	// Getters
	get type() { return "item"; }
	get sceneItems() { return new Set(); }
	get sourceID() { return `${this.type}-source`; }
	get source() { return this.map.getSource(this.sourceID); }
	get layerID() { return `${this.type}-layer`; }
	get layer() { return this.map.getLayer(this.layerID); }

	// Utility functions
	getItem(id) { return null; }
	getId(item) { return item.id ?? item._id; }
	getImageURL(item) { return item.texture.src; }
	getImageID(id) { return `${this.type}-image-${id}` }
	getImage(id) { return this.map.getImage(this.getImageID(id)); }

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
		if (this.dragging.id) this.onDrag(event, this.dragging.id);

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
	onHover(event, id, entering=true) {
		if (!id) return;
		if (!this.dragging.active) {
			if (entering) {
				this.hovering.add(id);
				this.map.getCanvas().style.cursor = "pointer";
			} else {
				this.hovering.delete(id);
				if (!this.hovering.size) this.map.getCanvas().style.cursor = "";
			}
		}
	}
	onClick(event, id) {
		const item = this.getItem(id);
		item?.object?.control({ releaseOthers: true });
	}
	onGrab(event, id) {
		if (!id) return;
		for (const id of this.hovering) this.onHover(event, id, false);

		this.dragging.id = id;
		this.dragging.point = event.point;
		this.dragging.active = false;
		this.map.dragPan.disable();
		this.map.getCanvas().style.cursor = "grabbing";
	}
	onDrag(event, id) {
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
	onRelease(event, id) {
		if (!id) return;
		if (this.dragging.active) {
			// Convert lng/lat → Foundry scene coordinates
			const { lng, lat } = this.map.unproject(event.point);
			const { x, y } = this.lngLatToScene(lng, lat);

			const item = this.getItem(id);
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
