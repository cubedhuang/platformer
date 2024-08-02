import type { Game } from './Game';
import { noise } from './noise';
import { Tile } from './Tile';

export class Renderer {
	readonly SUBTILES = 4;

	private TILE_OVERLAP = 0.25;
	private PIXEL_RATIO = 1;

	private ocanvas: OffscreenCanvas;
	private octx: OffscreenCanvasRenderingContext2D;

	private cache = new Map<string, ImageData>();

	constructor(private game: Game) {
		this.ocanvas = new OffscreenCanvas(game.width, game.height);
		const octx = this.ocanvas.getContext('2d');

		if (!octx) {
			throw new Error('Could not get 2d context');
		}

		this.octx = octx;
	}

	resize() {
		const game = this.game;

		const ratio = window.devicePixelRatio;

		if (ratio === this.PIXEL_RATIO) return;

		this.PIXEL_RATIO = ratio;

		this.cache.clear();

		this.TILE_OVERLAP = 0.25 / ratio;

		game.canvas.width = game.width * ratio;
		game.canvas.height = game.height * ratio;
		game.canvas.style.width = `${game.width}px`;
		game.canvas.style.height = `${game.height}px`;
		game.ctx.scale(ratio, ratio);

		this.ocanvas.width = game.TILE_SIZE * ratio;
		this.ocanvas.height = game.TILE_SIZE * ratio;
		this.octx.scale(ratio, ratio);
	}

	invalidate() {
		this.cache.clear();
	}

	render() {
		const game = this.game;

		game.ctx.clearRect(0, 0, game.width, game.height);

		const startX = Math.floor(game.camera.x / game.TILE_SIZE);
		const startY = Math.floor(-game.camera.y / game.TILE_SIZE);
		const endX = Math.ceil((game.camera.x + game.width) / game.TILE_SIZE);
		const endY = Math.ceil((game.height - game.camera.y) / game.TILE_SIZE);

		for (let wx = startX; wx < endX; wx++) {
			for (let wy = startY; wy < endY; wy++) {
				const tile = game.world.at(wx, wy);
				if (tile === Tile.Empty) continue;

				const x = wx * game.TILE_SIZE - game.camera.x;
				const y =
					game.height -
					wy * game.TILE_SIZE -
					game.TILE_SIZE -
					game.camera.y;

				const key = `${wx},${wy},${tile}`;
				let tileImage = this.cache.get(key);

				if (!tileImage) {
					tileImage = this.renderTile(tile, wx, wy);
					this.cache.set(key, tileImage);
				}

				game.ctx.putImageData(
					tileImage,
					x * this.PIXEL_RATIO,
					y * this.PIXEL_RATIO
				);
			}
		}

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
		this.octx.clearRect(0, 0, this.ocanvas.width, this.ocanvas.height);

		switch (tile) {
			case Tile.Earth:
				this.renderEarthTile(wx, wy);
				break;
			case Tile.Lava:
				this.renderLavaTile(wx, wy);
				break;
		}

		return this.octx.getImageData(
			0,
			0,
			this.ocanvas.width,
			this.ocanvas.height
		);
	}

	private renderEarthTile(wx: number, wy: number) {
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

				const value = noise(
					(wx + subx / this.SUBTILES) * 2,
					(wy - suby / this.SUBTILES) * 2
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
					this.octx.fillStyle = `oklch(${
						60 + (value - 0.5) * 10
					}% 0.2467 145.39)`;
				} else {
					this.octx.fillStyle = `oklch(${
						30.15 + (value - 0.5) * 10
					}% 0.038 31.82)`;
				}

				this.rect(
					this.octx,
					x,
					y,
					game.TILE_SIZE / this.SUBTILES,
					game.TILE_SIZE / this.SUBTILES
				);
			}
		}
	}

	private renderLavaTile(wx: number, wy: number) {
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

				this.octx.fillStyle = `hsl(0 100% ${30 + value * 10}%)`;

				this.rect(
					this.octx,
					x,
					y,
					game.TILE_SIZE / this.SUBTILES,
					game.TILE_SIZE / this.SUBTILES
				);
			}
		}
	}

	private rect(
		ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
		x: number,
		y: number,
		width: number,
		height: number
	) {
		ctx.fillRect(
			x - this.TILE_OVERLAP,
			y - this.TILE_OVERLAP,
			width + this.TILE_OVERLAP * 2,
			height + this.TILE_OVERLAP * 2
		);
	}
}
