import { Marker } from "./marker.js";

export class WikiLinkMarker extends Marker {
	reset() {
		super.reset();
		this.hovering = false;
	}

	// Getters
	get layerIDs() {
		return [
			"location-icons",
			"location-labels",
			"symbol_labels",
			"symbol_line-labels",
			"symbol_province-labels",
			"symbol_nation-labels",
			"symbol_subregion-labels",
			"symbol_region-labels",
		];
	}

	// Event handlers
	onClick(event, properties) {
		if (game.user.role < 2) return; // Minimum of trusted player
		if (!event?.originalEvent?.altKey) return;
		if (!properties?.link) return;

		const url = properties.link;
		console.log(`Opening Pathfinder Wiki link: ${url}`);
		window.open(url, "_blank");
	}
	onMouseMove(event, hovering) {
		if (game.user.role < 2) return; // Minimum of trusted player
		const alt = event?.originalEvent?.altKey;
		const hasLink = hovering?.filter?.(f => f.properties.link).length;
		if (alt && hasLink) this.hover();
		else this.unhover();
	}
	onLeaveMap() { this.unhover(); }

	// Helper Functions
	hover() {
		if (!this.hovering) {
			this.hovering = true;
			this.map.getCanvas().style.cursor = "pointer";
		}
	}
	unhover() {
		if (this.hovering) {
			this.hovering = false;
			this.map.getCanvas().style.cursor = "";
		}
	}
}
