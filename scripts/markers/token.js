import { ItemMarker } from "./item.js";

export class TokenMarker extends ItemMarker {
	// Getters
	get type() { return "token"; }
	get sceneItems() { return new Set(this.scene.tokens.map(t => t.id)); }

	// Utility functions
	getItem(id) { return this.scene.tokens.get(id); }
	// getSize(id) { return 10000 * ((this.getItem(id)?.width ?? 1) * 1.0) / this.mapMarkers.gridWidth; }
	getSize(id) { return this.getItem(id)?.width ?? 1; }
	getScalable(id) { return (this.getItem(id)?.elevation ?? 0) === 0; }
	getName(id) { return this.getItem(id)?.name; }
	getDisplayName(id) { return this.getItem(id)?.displayName !== 0; }

	// Hooks
	addFoundryHooks() {
		super.addFoundryHooks();
		// Token movement
		this.mapMarkers.addFoundryHook("createToken", (token) => { this.createMarker({
			item: token,
			id: token.id,
		}); });
		this.mapMarkers.addFoundryHook("updateToken", (token, upd) => { this.updateMarker({
			item: token,
			id: token.id,
			updateImage: "texture" in upd || "width" in upd,
			updateScalable: "altitude" in upd,
		}); });
		this.mapMarkers.addFoundryHook("refreshToken", (token) => { this.updateMarker({
			item: token.document,
			id: token.document.id,
		}); });
		this.mapMarkers.addFoundryHook("deleteToken", (token) => { this.deleteMarker({
			item: token,
			id: token.id,
		}); });
		this.mapMarkers.addFoundryHook("updateScene", () => { this.updateAll(); });
	}
}
