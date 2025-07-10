import { ItemMarker } from "./item.js";

export class NoteMarker extends ItemMarker {
	// Getters
	get type() { return "note"; }
	get sceneItems() { return new Set(this.scene.notes.map(t => t.id)); }

	// Utility functions
	getItem(id) { return this.scene.notes.get(id); }

	// Hooks
	addFoundryHooks() {
		super.addFoundryHooks();
		// Note movement
		this.mapMarkers.addFoundryHook("createNote", (note) => { this.createMarker({
			item: note,
			id: note.id,
		}); });
		this.mapMarkers.addFoundryHook("updateNote", (note, upd) => { this.updateMarker({
			item: note,
			id: note.id,
			updateImage: "texture" in upd,
		}); });
		this.mapMarkers.addFoundryHook("refreshNote", (note) => { this.updateMarker({
			item: note.document,
			id: note.document.id,
		}); });
		this.mapMarkers.addFoundryHook("deleteNote", (note) => { this.deleteMarker({
			item: note,
			id: note.id,
		}); });
		this.mapMarkers.addFoundryHook("updateScene", () => { this.updateAll(); });
	}

	// Event handlers
	onClick(event, id) {
		const item = this.getItem(id);
		item?.entry?.sheet?.render?.(true);
	}
}
