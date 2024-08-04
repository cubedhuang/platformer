import type { Game } from './Game';
import { noises } from './noise';
import { Tile } from './Tile';
import type { Layer } from './World';

export class Renderer {
	readonly SUBTILES = 4;

	private PIXEL_RATIO = 1;

	private cache = new Map<string, OffscreenCanvas>();
	private lastTileOffset: {
		x: number | null;
		y: number | null;
	} = {
		x: null,
		y: null
	};

	private foreground: OffscreenCanvas;
	private fctx: OffscreenCanvasRenderingContext2D;

	private midground: OffscreenCanvas;
	private mctx: OffscreenCanvasRenderingContext2D;

	constructor(private game: Game) {
		this.foreground = new OffscreenCanvas(
			(game.width + game.TILE_SIZE) * this.PIXEL_RATIO,
			(game.height + game.TILE_SIZE) * this.PIXEL_RATIO
		);
		this.fctx = this.foreground.getContext('2d', {
			desynchronized: true
		})!;

		this.midground = new OffscreenCanvas(
			(game.width + game.TILE_SIZE) * this.PIXEL_RATIO,
			(game.height + game.TILE_SIZE) * this.PIXEL_RATIO
		);
		this.mctx = this.midground.getContext('2d', {
			desynchronized: true
		})!;

		this.resize();
	}

	resize() {
		const game = this.game;

		const ratio = window.devicePixelRatio;

		if (ratio === this.PIXEL_RATIO) return;
		this.PIXEL_RATIO = ratio;

		game.canvas.width = game.width * ratio;
		game.canvas.height = game.height * ratio;
		game.canvas.style.width = `${game.width}px`;
		game.canvas.style.height = `${game.height}px`;
		game.ctx.scale(ratio, ratio);

		this.foreground.width = (game.width + game.TILE_SIZE) * ratio;
		this.foreground.height = (game.height + game.TILE_SIZE) * ratio;
		this.fctx.scale(ratio, ratio);

		this.midground.width = (game.width + game.TILE_SIZE) * ratio;
		this.midground.height = (game.height + game.TILE_SIZE) * ratio;
		this.mctx.scale(ratio, ratio);

		this.cache.clear();
	}

	invalidate() {
		this.cache.clear();
		this.lastTileOffset = { x: null, y: null };
	}

	invalidateNear(wx: number, wy: number) {
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				this.cache.delete(`fg_${wx + dx},${wy + dy}`);
				this.cache.delete(`mg_${wx + dx},${wy + dy}`);
			}
		}

		this.lastTileOffset = { x: null, y: null };
	}

	render() {
		const game = this.game;

		game.ctx.fillStyle = 'hsl(205 80% 40%)';
		game.ctx.fillRect(0, 0, game.width, game.height);

		const startX = Math.floor(game.camera.x / game.TILE_SIZE);
		const startY = Math.floor(-game.camera.y / game.TILE_SIZE);
		const endX =
			Math.ceil((game.camera.x + game.width) / game.TILE_SIZE) + 1;
		const endY =
			Math.ceil((game.height - game.camera.y) / game.TILE_SIZE) + 1;

		const tileOffsetX =
			Math.floor(game.camera.x / game.TILE_SIZE) * game.TILE_SIZE;
		const tileOffsetY =
			Math.floor(game.camera.y / game.TILE_SIZE) * game.TILE_SIZE;

		if (
			tileOffsetX !== this.lastTileOffset.x ||
			tileOffsetY !== this.lastTileOffset.y
		) {
			this.fctx.clearRect(
				0,
				0,
				this.foreground.width,
				this.foreground.height
			);
			this.mctx.clearRect(
				0,
				0,
				this.midground.width,
				this.midground.height
			);

			const layers = [game.world.midground, game.world.foreground];

			for (const layer of layers) {
				const isForeground = layer === game.world.foreground;

				for (let wx = startX; wx < endX; wx++) {
					for (let wy = startY; wy < endY; wy++) {
						const tile = layer.at(wx, wy);
						if (tile === Tile.Empty) continue;

						const x = wx * game.TILE_SIZE - tileOffsetX;
						const y =
							game.height -
							wy * game.TILE_SIZE -
							game.TILE_SIZE -
							tileOffsetY;

						const key = isForeground
							? `fg_${wx},${wy}`
							: `mg_${wx},${wy}`;

						let ocanvas = this.cache.get(key);

						if (!ocanvas) {
							ocanvas = this.renderTile(layer, tile, wx, wy);
							this.cache.set(key, ocanvas);
						}

						this.fctx.drawImage(
							ocanvas,
							x,
							y,
							game.TILE_SIZE,
							game.TILE_SIZE
						);
					}
				}
			}
		}

		this.lastTileOffset.x = tileOffsetX;
		this.lastTileOffset.y = tileOffsetY;

		game.ctx.drawImage(
			this.foreground,
			tileOffsetX - game.camera.x,
			tileOffsetY - game.camera.y,
			this.foreground.width / this.PIXEL_RATIO,
			this.foreground.height / this.PIXEL_RATIO
		);

		game.ctx.fillStyle = 'blue';

		const x = game.player.wx * game.TILE_SIZE;
		const y =
			game.height - game.player.wy * game.TILE_SIZE - game.TILE_SIZE;

		game.ctx.fillRect(
			x - game.camera.x - (game.player.width * game.TILE_SIZE) / 2,
			y -
				game.camera.y -
				(game.player.height * game.TILE_SIZE) / 2 +
				game.TILE_SIZE,
			game.player.width * game.TILE_SIZE,
			game.player.height * game.TILE_SIZE
		);
	}

	private renderTile(layer: Layer, tile: Tile, wx: number, wy: number) {
		const ocanvas = new OffscreenCanvas(
			this.game.TILE_SIZE * this.PIXEL_RATIO,
			this.game.TILE_SIZE * this.PIXEL_RATIO
		);
		const octx = ocanvas.getContext('2d', {
			desynchronized: true
		})!;
		octx.scale(this.PIXEL_RATIO, this.PIXEL_RATIO);

		switch (tile) {
			case Tile.Earth:
				this.renderEarthTile(layer, octx, wx, wy);
				break;
			case Tile.Lava:
				this.renderLavaTile(layer, octx, wx, wy);
				break;
		}

		return ocanvas;
	}

	private renderEarthTile(
		layer: Layer,
		octx: OffscreenCanvasRenderingContext2D,
		wx: number,
		wy: number
	) {
		const game = this.game;

		const greenLightnessShift = layer === game.world.foreground ? 0 : -15;
		const brownLightnessShift = layer === game.world.foreground ? 0 : -10;

		const topLeftCorner =
			layer.at(wx - 1, wy + 1) === Tile.Empty &&
			layer.at(wx - 1, wy) === Tile.Empty &&
			layer.at(wx, wy + 1) === Tile.Empty;
		const topRightCorner =
			layer.at(wx + 1, wy + 1) === Tile.Empty &&
			layer.at(wx + 1, wy) === Tile.Empty &&
			layer.at(wx, wy + 1) === Tile.Empty;
		const top = layer.at(wx, wy + 1) === Tile.Empty;
		const left = layer.at(wx - 1, wy) === Tile.Empty;
		const right = layer.at(wx + 1, wy) === Tile.Empty;
		const topLeftInside =
			!top && !left && layer.at(wx - 1, wy + 1) === Tile.Empty;
		const topRightInside =
			!top && !right && layer.at(wx + 1, wy + 1) === Tile.Empty;

		for (let subx = 0; subx < this.SUBTILES; subx++) {
			for (let suby = 0; suby < this.SUBTILES; suby++) {
				const x = (subx * game.TILE_SIZE) / this.SUBTILES;
				const y = (suby * game.TILE_SIZE) / this.SUBTILES;

				const value = noises(
					[2, 0.3],
					wx + subx / this.SUBTILES,
					wy - suby / this.SUBTILES
				);

				if (
					(topLeftCorner && subx === 0 && suby === 0) ||
					(topRightCorner && subx === this.SUBTILES - 1 && suby === 0)
				) {
					continue;
				}

				const isGreen =
					(top &&
						(suby === 0 || value > suby / this.SUBTILES + 0.1)) ||
					(left &&
						(subx === 0 || value > subx / this.SUBTILES + 0.3)) ||
					(right &&
						(subx === this.SUBTILES - 1 ||
							value >
								(this.SUBTILES - 1 - subx) / this.SUBTILES +
									0.3)) ||
					(topLeftInside &&
						((subx === 0 && suby === 0) ||
							(((subx === 1 && suby === 0) ||
								(subx === 0 && suby === 1)) &&
								value > 0.8))) ||
					(topRightInside &&
						((subx === this.SUBTILES - 1 && suby === 0) ||
							(((subx === this.SUBTILES - 2 && suby === 0) ||
								(subx === this.SUBTILES - 1 && suby === 1)) &&
								value > 0.8)));

				if (isGreen) {
					octx.fillStyle = `oklch(${
						greenLightnessShift + 55 + (value - 0.5) * 10
					}% 0.2467 145.39)`;
				} else {
					octx.fillStyle = `oklch(${
						brownLightnessShift + 30 + (value - 0.5) * 10
					}% 0.038 31.82)`;
				}

				octx.fillRect(
					x,
					y,
					game.TILE_SIZE / this.SUBTILES,
					game.TILE_SIZE / this.SUBTILES
				);
			}
		}
	}

	private renderLavaTile(
		layer: Layer,
		octx: OffscreenCanvasRenderingContext2D,
		wx: number,
		wy: number
	) {
		const game = this.game;

		const top = layer.at(wx, wy + 1) === Tile.Empty;

		for (let subx = 0; subx < this.SUBTILES; subx++) {
			for (let suby = top ? 1 : 0; suby < this.SUBTILES; suby++) {
				const x = (subx * game.TILE_SIZE) / this.SUBTILES;
				const y = (suby * game.TILE_SIZE) / this.SUBTILES;

				const value = noises(
					[2, 1],
					wx + subx / this.SUBTILES,
					wy - suby / this.SUBTILES
				);

				// octx.fillStyle = `hsl(0 100% ${30 + value * 10}%)`;
				octx.fillStyle = `oklch(${45 + value * 20}% 0.244 34.41)`;
				octx.fillRect(
					x,
					y,
					game.TILE_SIZE / this.SUBTILES,
					game.TILE_SIZE / this.SUBTILES
				);
			}
		}
	}
}
