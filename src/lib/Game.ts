import { Camera } from './Camera';
import { noise } from './noise';
import { Tile } from './Tile';
import { World } from './World';

const EPSILON = 0.01;

export class Game {
	private readonly TILE_SIZE = 21;
	private readonly SUBTILES = 3;
	private TILE_OVERLAP = 0.25;

	private requestId: number | null = null;
	private prevTime = 0;

	world = new World();
	camera = new Camera(0, 0, 800, 600);
	player = { wx: 3, wy: 10, vx: 0, vy: 0, width: 0.9, height: 1.8 };
	keys = new Set<string>();

	constructor(
		public canvas: HTMLCanvasElement,
		public ctx: CanvasRenderingContext2D,
		private width: number,
		private height: number
	) {
		this.resize();
	}

	resize() {
		const ratio = window.devicePixelRatio;
		this.TILE_OVERLAP = 0.25 / ratio;
		this.canvas.width = this.width * ratio;
		this.canvas.height = this.height * ratio;
		this.canvas.style.width = `${this.width}px`;
		this.canvas.style.height = `${this.height}px`;
		this.ctx.scale(ratio, ratio);
	}

	start() {
		this.requestId = requestAnimationFrame(ts => this.update(ts));
	}

	physics(dt: number) {
		const isOnGround = this.isOnGround();
		if (this.keys.has('ArrowUp') && isOnGround) {
			this.player.vy = 25;
		}
		if (this.keys.has('ArrowLeft')) {
			this.player.vx += -120 * dt;
		}
		if (this.keys.has('ArrowRight')) {
			this.player.vx += 120 * dt;
		}

		this.player.vy -= 100 * dt;

		const newX = this.player.wx + this.player.vx * dt;
		const newY = this.player.wy + this.player.vy * dt;

		if (!this.checkCollision(newX, this.player.wy)) {
			this.player.wx = newX;
		} else {
			if (this.player.vx > 0) {
				this.player.wx =
					Math.floor(newX + this.player.width / 2) -
					this.player.width / 2 -
					EPSILON;
			} else {
				this.player.wx =
					Math.ceil(newX - this.player.width / 2) +
					this.player.width / 2 +
					EPSILON;
			}
			this.player.vx = 0;
		}

		if (!this.checkCollision(this.player.wx, newY)) {
			this.player.wy = newY;
		} else {
			if (this.player.vy < 0) {
				this.player.wy =
					Math.ceil(newY - this.player.height / 2) +
					this.player.height / 2 +
					EPSILON;
			} else {
				this.player.wy =
					Math.floor(newY + this.player.height / 2) -
					this.player.height / 2 -
					EPSILON;
			}
			this.player.vy = 0;
		}

		this.player.vx *= 0.9 ** (dt * 120);
		this.player.vy *= 0.9 ** (dt * 30);
	}

	checkCollision(x: number, y: number): boolean {
		const left = Math.floor(x - this.player.width / 2);

		if (left < 0) return true;

		const right = Math.ceil(x + this.player.width / 2);
		const bottom = Math.floor(y - this.player.height / 2);
		const top = Math.ceil(y + this.player.height / 2);

		for (let wx = left; wx < right; wx++) {
			for (let wy = bottom; wy < top; wy++) {
				if (this.world.at(wx, wy) !== Tile.Empty) {
					return true;
				}
			}
		}

		return false;
	}

	isOnGround(): boolean {
		return this.checkCollision(
			this.player.wx,
			this.player.wy - EPSILON * 2
		);
	}

	render() {
		this.ctx.clearRect(0, 0, this.width, this.height);

		for (const [[wx, wy], tile] of this.world) {
			const x = wx * this.TILE_SIZE;
			const y = this.height - wy * this.TILE_SIZE - this.TILE_SIZE;

			if (!this.camera.contains(x, y, this.TILE_SIZE)) {
				continue;
			}

			switch (tile) {
				case Tile.Empty:
					continue;

				case Tile.Earth: {
					const topLeftCorner =
						this.world.at(wx - 1, wy + 1) === Tile.Empty &&
						this.world.at(wx - 1, wy) === Tile.Empty &&
						this.world.at(wx, wy + 1) === Tile.Empty;
					const topRightCorner =
						this.world.at(wx + 1, wy + 1) === Tile.Empty &&
						this.world.at(wx + 1, wy) === Tile.Empty &&
						this.world.at(wx, wy + 1) === Tile.Empty;
					const top = this.world.at(wx, wy + 1) === Tile.Empty;
					const left = this.world.at(wx - 1, wy) === Tile.Empty;
					const right = this.world.at(wx + 1, wy) === Tile.Empty;
					const topLeftInside =
						!top &&
						!left &&
						this.world.at(wx - 1, wy + 1) === Tile.Empty;
					const topRightInside =
						!top &&
						!right &&
						this.world.at(wx + 1, wy + 1) === Tile.Empty;

					for (let subx = 0; subx < this.SUBTILES; subx++) {
						for (let suby = 0; suby < this.SUBTILES; suby++) {
							const xx =
								x + (subx * this.TILE_SIZE) / this.SUBTILES;
							const yy =
								y + (suby * this.TILE_SIZE) / this.SUBTILES;

							const value = noise(xx / 3, yy / 3);

							if (
								(topLeftCorner && subx === 0 && suby === 0) ||
								(topRightCorner &&
									subx === this.SUBTILES - 1 &&
									suby === 0)
							) {
								continue;
							}

							const isGreen =
								(top &&
									(suby === 0 ||
										value > suby / this.SUBTILES + 0.1)) ||
								(left &&
									(subx === 0 ||
										value > subx / this.SUBTILES + 0.3)) ||
								(right &&
									(subx === this.SUBTILES - 1 ||
										value >
											(this.SUBTILES - 1 - subx) /
												this.SUBTILES +
												0.3)) ||
								(topLeftInside &&
									((subx === 0 && suby === 0) ||
										(((subx === 1 && suby === 0) ||
											(subx === 0 && suby === 1)) &&
											value > 0.8))) ||
								(topRightInside &&
									((subx === this.SUBTILES - 1 &&
										suby === 0) ||
										(((subx === this.SUBTILES - 2 &&
											suby === 0) ||
											(subx === this.SUBTILES - 1 &&
												suby === 1)) &&
											value > 0.8)));

							if (isGreen) {
								this.ctx.fillStyle = `oklch(${
									60 + (value - 0.5) * 10
								}% 0.2467 145.39)`;
							} else {
								this.ctx.fillStyle = `oklch(${
									30.15 + (value - 0.5) * 10
								}% 0.038 31.82)`;
							}

							this.rect(
								xx - this.camera.x,
								yy - this.camera.y,
								this.TILE_SIZE / this.SUBTILES,
								this.TILE_SIZE / this.SUBTILES
							);
						}
					}
					break;
				}

				case Tile.Lava: {
					const top = this.world.at(wx, wy + 1) === Tile.Empty;
					for (let subx = 0; subx < this.SUBTILES; subx++) {
						for (
							let suby = top ? 1 : 0;
							suby < this.SUBTILES;
							suby++
						) {
							const xx =
								x + (subx * this.TILE_SIZE) / this.SUBTILES;
							const yy =
								y + (suby * this.TILE_SIZE) / this.SUBTILES;

							const value = noise(xx / 3, yy / 3);

							this.ctx.fillStyle = `hsl(0 100% ${30 + value * 10}%)`;

							this.rect(
								xx - this.camera.x,
								yy - this.camera.y,
								this.TILE_SIZE / this.SUBTILES,
								this.TILE_SIZE / this.SUBTILES
							);
						}
					}
					break;
				}
			}
		}

		this.ctx.fillStyle = 'blue';

		const x = this.player.wx * this.TILE_SIZE;
		const y =
			this.height - this.player.wy * this.TILE_SIZE - this.TILE_SIZE;

		this.ctx.fillRect(
			x - this.camera.x - (this.player.width * this.TILE_SIZE) / 2,
			y -
				this.camera.y -
				(this.player.height * this.TILE_SIZE) / 2 +
				this.TILE_SIZE,
			this.player.width * this.TILE_SIZE,
			this.player.height * this.TILE_SIZE
		);
	}

	rect(x: number, y: number, width: number, height: number) {
		this.ctx.fillRect(
			x - this.TILE_OVERLAP,
			y - this.TILE_OVERLAP,
			width + this.TILE_OVERLAP * 2,
			height + this.TILE_OVERLAP * 2
		);
	}

	update(ts: number) {
		if (!this.prevTime) {
			this.prevTime = ts;
			this.requestId = requestAnimationFrame(ts => this.update(ts));
			return;
		}
		const dt = Math.min((ts - this.prevTime) / 1000, 1 / 30);
		this.prevTime = ts;

		this.physics(dt);

		this.camera.follow({
			x: this.player.wx * this.TILE_SIZE,
			y: -this.player.wy * this.TILE_SIZE + this.height
		});
		this.camera.update(dt);
		this.render();

		this.requestId = requestAnimationFrame(ts => this.update(ts));
	}

	place(x: number, y: number, tile: Tile) {
		x += this.camera.x;
		y += this.camera.y;
		const worldX = Math.floor(x / this.TILE_SIZE);
		const worldY = Math.floor((this.height - y) / this.TILE_SIZE);

		this.world.set(worldX, worldY, tile);

		console.log(this.world.toString());
	}

	destroy() {
		cancelAnimationFrame(this.requestId!);
		this.requestId = null;
	}
}
