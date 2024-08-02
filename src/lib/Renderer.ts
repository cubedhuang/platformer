import { debounce } from '$lib';

import type { Game } from './Game';
import { noise, noises } from './noise';
import { Tile } from './Tile';

export class Renderer {
	readonly SUBTILES = 4;

	private PIXEL_RATIO = 1;

	private cache = new Map<string, OffscreenCanvas>();

	private foreground: OffscreenCanvas;
	private fctx: OffscreenCanvasRenderingContext2D;

	constructor(private game: Game) {
		this.foreground = new OffscreenCanvas(
			(game.width + game.TILE_SIZE) * this.PIXEL_RATIO,
			(game.height + game.TILE_SIZE) * this.PIXEL_RATIO
		);
		this.fctx = this.foreground.getContext('2d', {
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

		this.cache.clear();
	}

	invalidate() {
		this.cache.clear();
	}

	lazyInvalidate = debounce(() => this.invalidate(), 500);

	render() {
		const game = this.game;

		game.ctx.fillStyle = 'hsl(205 80% 40%)';
		game.ctx.fillRect(0, 0, game.width, game.height);

		this.fctx.clearRect(
			0,
			0,
			this.foreground.width,
			this.foreground.height
		);

		const startX = Math.floor(game.camera.x / game.TILE_SIZE);
		const startY = Math.floor(-game.camera.y / game.TILE_SIZE);
		const endX = Math.ceil((game.camera.x + game.width) / game.TILE_SIZE);
		const endY = Math.ceil((game.height - game.camera.y) / game.TILE_SIZE);

		const tileOffsetX =
			Math.floor(game.camera.x / game.TILE_SIZE) * game.TILE_SIZE;
		const tileOffsetY =
			Math.floor(game.camera.y / game.TILE_SIZE) * game.TILE_SIZE;

		for (let wx = startX; wx < endX; wx++) {
			for (let wy = startY; wy < endY; wy++) {
				const tile = game.world.at(wx, wy);
				if (tile === Tile.Empty) continue;

				const x = wx * game.TILE_SIZE - tileOffsetX;
				const y =
					game.height -
					wy * game.TILE_SIZE -
					game.TILE_SIZE -
					tileOffsetY;

				const key = `${wx},${wy},${tile}`;

				let ocanvas = this.cache.get(key);

				if (!ocanvas) {
					ocanvas = this.renderTile(tile, wx, wy);
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

	private renderTile(tile: Tile, wx: number, wy: number) {
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
				this.renderEarthTile(octx, wx, wy);
				break;
			case Tile.Lava:
				this.renderLavaTile(octx, wx, wy);
				break;
		}

		return ocanvas;
	}

	private renderEarthTile(
		octx: OffscreenCanvasRenderingContext2D,
		wx: number,
		wy: number
	) {
		const game = this.game;

		const topLeftCorner =
			game.world.at(wx - 1, wy + 1) === Tile.Empty &&
			game.world.at(wx - 1, wy) === Tile.Empty &&
			game.world.at(wx, wy + 1) === Tile.Empty;
		const topRightCorner =
			game.world.at(wx + 1, wy + 1) === Tile.Empty &&
			game.world.at(wx + 1, wy) === Tile.Empty &&
			game.world.at(wx, wy + 1) === Tile.Empty;
		const top = game.world.at(wx, wy + 1) === Tile.Empty;
		const left = game.world.at(wx - 1, wy) === Tile.Empty;
		const right = game.world.at(wx + 1, wy) === Tile.Empty;
		const topLeftInside =
			!top && !left && game.world.at(wx - 1, wy + 1) === Tile.Empty;
		const topRightInside =
			!top && !right && game.world.at(wx + 1, wy + 1) === Tile.Empty;

		for (let subx = 0; subx < this.SUBTILES; subx++) {
			for (let suby = 0; suby < this.SUBTILES; suby++) {
				const x = (subx * game.TILE_SIZE) / this.SUBTILES;
				const y = (suby * game.TILE_SIZE) / this.SUBTILES;

				const value = noises(
					[1, 0.5],
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
						55 + (value - 0.5) * 10
					}% 0.2467 145.39)`;
				} else {
					octx.fillStyle = `oklch(${
						30.15 + (value - 0.5) * 10
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
		octx: OffscreenCanvasRenderingContext2D,
		wx: number,
		wy: number
	) {
		const game = this.game;

		const top = game.world.at(wx, wy + 1) === Tile.Empty;

		for (let subx = 0; subx < this.SUBTILES; subx++) {
			for (let suby = top ? 1 : 0; suby < this.SUBTILES; suby++) {
				const x = (subx * game.TILE_SIZE) / this.SUBTILES;
				const y = (suby * game.TILE_SIZE) / this.SUBTILES;

				const value = noise(
					wx + subx / this.SUBTILES,
					wy - suby / this.SUBTILES
				);

				octx.fillStyle = `hsl(0 100% ${30 + value * 10}%)`;
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
