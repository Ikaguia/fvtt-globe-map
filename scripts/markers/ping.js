import { Marker } from "./marker.js";

export class PingMarker extends Marker {
	reset() {
		this._timeout = null;
		this._startPoint = null;
		this._startEvent = null;
		this._pressed = false;
		this._moved = false;
		this._injectStyles();
	}

	destroy() {
		this._clearTimeout();
		this._removeListeners();
		super.destroy();
	}

	addFoundryHooks() {
		super.addFoundryHooks();

		this.mapMarkers.addFoundryHook("fvtt-globe-map.handlePing", (user, position, {scene, style="pulse", pull=false, zoom=1, ...pingOptions}={}) => {
			console.log("Ping received:");
			console.log("user", user);
			console.log("position", position);
			console.log("scene", scene);
			console.log("style", style);
			console.log("pull", pull);
			console.log("zoom", zoom);
			console.log("pingOptions", pingOptions);
			if (!canvas.scene?.getFlag("fvtt-globe-map", "enabled")) return;

			const { x, y } = position;
			console.debug(x, y);
			const { lng, lat } = this.sceneToLngLat(x, y);
			console.debug(lng, lat);
			let screenPoint = this.map.project([lng, lat]);

			// If pan ping, animate to position and zoom
			if (pull && (user.isGM || user.isSelf)) {
				zoom = position.zoom ?? this.map.getZoom(); // default to current if none
				this.map.easeTo({
					center: [lng, lat],
					zoom,
					duration: 1000,
					easing: t => t*t*t,
				});
				// Show ping marker on center of screen
				const center = this.map.getCenter();
				screenPoint = this.map.project([center.lng, center.lat]);
			}
			// Show ping marker visually
			this._showPing(screenPoint, style ?? "pulse", user?.color);

		});
	}

	addMapListeners() {
		this._addListeners();
	}

	_addListeners() {
		this._canvas = this.map.getCanvas();
		this._canvas.addEventListener("pointerdown", this._onPointerDown);
		this._canvas.addEventListener("pointerup", this._onPointerUp);
		this._canvas.addEventListener("pointermove", this._onPointerMove);
		this._canvas.addEventListener("pointerleave", this._onPointerLeave);
	}

	_removeListeners() {
		if (!this._canvas) return;
		this._canvas.removeEventListener("pointerdown", this._onPointerDown);
		this._canvas.removeEventListener("pointerup", this._onPointerUp);
		this._canvas.removeEventListener("pointermove", this._onPointerMove);
		this._canvas.removeEventListener("pointerleave", this._onPointerLeave);
	}

	_onPointerDown = (e) => {
		// Ignore secondary clicks, multitouch, etc.
		if (e.button !== 0 || e.pointerType !== "mouse") return;

		this._pressed = true;
		this._moved = false;
		this._startPoint = { x: e.clientX, y: e.clientY };
		this._startEvent = e;

		this._timeout = setTimeout(() => {
			if (!this._pressed || this._moved) return;

			const point = this.map.project(this.map.unproject([e.clientX, e.clientY]));
			const modifiers = {
				altKey: this._startEvent.altKey,
				shiftKey: this._startEvent.shiftKey
			};

			const lngLat = this.map.unproject(point);
			const { x, y } = this.lngLatToScene(lngLat.lng, lngLat.lat);

			canvas.ping({x, y, zoom: this.map.getZoom()}, {
				nameplate: true,
				user: game.user,
				type: modifiers.altKey ? "alert" : "normal",
				pan: modifiers.shiftKey,
			});

			const style = modifiers.altKey ? "alert"
			            : modifiers.shiftKey ? "pan"
			            : "normal";

			this._pressed = false;
		}, 500);
	};

	_onPointerMove = (e) => {
		if (!this._pressed || !this._startPoint) return;

		const dx = e.clientX - this._startPoint.x;
		const dy = e.clientY - this._startPoint.y;
		const distSq = dx * dx + dy * dy;

		if (distSq > 16) {
			this._moved = true;
			this._clearTimeout();
		}
	};

	_onPointerUp = () => {
		this._pressed = false;
		this._clearTimeout();
	};

	_onPointerLeave = () => {
		this._pressed = false;
		this._clearTimeout();
	};

	_clearTimeout() {
		if (this._timeout) clearTimeout(this._timeout);
		this._timeout = null;
	}

	_showPing(point, style="pulse", color) {
		if (style === "alert") {
			for (let i = 0; i < 3; i++) {
				const el = document.createElement("div");
				el.classList.add("globe-ping", "globe-ping--alert");
				el.style.left = `${point.x}px`;
				el.style.top = `${point.y+6}px`;
				el.style.animationDelay = `${i * 0.4}s`;
				el.style.marginTop = "-12px";
				document.body.appendChild(el);
				setTimeout(() => el.remove(), 1800);
			}
			return;
		}

		const el = document.createElement("div");
		el.classList.add("globe-ping", `globe-ping--${style}`);

		const baseStyles = {
			left: `${point.x}px`,
			top: `${point.y}px`,
		};

		// Use color for normal, pulse, and chevron
		if (style === "pulse" && color) {
			baseStyles.background = color;
			baseStyles.border = `2px solid white`;
		} else if (style === "chevron" && color) {
			baseStyles.borderBottomColor = color;
		}

		Object.assign(el.style, baseStyles);

		document.body.appendChild(el);
		setTimeout(() => el.remove(), 1000);
	}

	_injectStyles() {
		if (document.getElementById("globe-ping-style")) return;

		const style = document.createElement("style");
		style.id = "globe-ping-style";
		style.textContent = `
			.globe-ping {
				position: absolute;
				pointer-events: none;
				z-index: 10000;
			}

			/* === Pulse === */
			.globe-ping--pulse {
				width: 30px;
				height: 30px;
				margin-left: -15px;
				margin-top: -15px;
				border-radius: 50%;
				animation: globe-ping-anim 1s ease-out;
				background: rgba(255, 255, 0, 0.5);
				border: 2px solid white;
			}

			@keyframes globe-ping-anim {
				0%   { transform: scale(1); opacity: 1; }
				100% { transform: scale(2); opacity: 0; }
			}

			/* === Alert === */
			.globe-ping--alert {
				width: 0;
				height: 0;
				margin-left: -12px;
				border-left: 12px solid transparent;
				border-right: 12px solid transparent;
				border-top: 18px solid transparent;
				position: absolute;
				opacity: 0;
				animation: alert-ping-outline 1.2s ease-out forwards;
				box-sizing: content-box;

				--triangle-color: red;
				border-top-color: var(--triangle-color);
			}

			@keyframes alert-ping-outline {
				0% {
					transform: scale(0.7);
					opacity: 0.6;
				}
				30% {
					opacity: 1;
				}
				100% {
					transform: scale(2.5);
					opacity: 0;
				}
			}

			/* === Chevron (Arrow) === */
			.globe-ping--chevron {
				position: absolute;
				width: 0;
				height: 0;
				margin-left: -20px;
				margin-top: -24px;

				border-left: 20px solid transparent;
				border-right: 20px solid transparent;
				border-top: 16px solid red;
				animation: chevron-ping 1s ease-out forwards;
			}

			.globe-ping--chevron::after {
				content: '';
				position: absolute;
				bottom: 6px;
				left: -16px;
				width: 0;
				height: 0;

				border-left: 16px solid transparent;
				border-right: 16px solid transparent;
				border-top: 12px solid white;
			}

			@keyframes chevron-ping {
				0%   { transform: scale(0.8); opacity: 1; }
				50%  { transform: scale(1.2); opacity: 0.8; }
				100% { transform: scale(1); opacity: 0; }
			}
		`;
		document.head.appendChild(style);
	}

}
