import { Camera } from './Camera';
import { Tile } from './Tile';
import { World } from './World';

const EPSILON = 0.01;

export class Game {
	private readonly TILE_SIZE = 20;

	private requestId: number | null = null;
	private prevTime = 0;

	world = new World();
	camera = new Camera(0, 0, 800, 600);
	player = { wx: 3, wy: 10, vx: 0, vy: 0, width: 1.8, height: 3.6 };
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
		this.canvas.width = this.width * ratio;
		this.canvas.height = this.height * ratio;
		this.canvas.style.width = `${this.width}px`;
		this.canvas.style.height = `${this.height}px`;
		this.ctx.scale(ratio, ratio);
	}

	start() {
		this.requestId = requestAnimationFrame((ts) => this.update(ts));
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
				this.player.wx = Math.floor(newX + this.player.width / 2) - this.player.width / 2 - EPSILON;
			} else {
				this.player.wx = Math.ceil(newX - this.player.width / 2) + this.player.width / 2 + EPSILON;
			}
			this.player.vx = 0;
		}

		// Check vertical collision
		if (!this.checkCollision(this.player.wx, newY)) {
			this.player.wy = newY;
		} else {
			if (this.player.vy < 0) {
				this.player.wy =
					Math.ceil(newY - this.player.height / 2) + this.player.height / 2 + EPSILON;
				console.log(this.checkCollision(this.player.wx, this.player.wy));
			} else {
				this.player.wy =
					Math.floor(newY + this.player.height / 2) - this.player.height / 2 - EPSILON;
			}
			this.player.vy = 0;
		}

		// Apply friction
		this.player.vx *= 0.9 ** (dt * 120);
		this.player.vy *= 0.9 ** (dt * 30);
	}

	checkCollision(x: number, y: number): boolean {
		const left = Math.floor(x - this.player.width / 2);

		if (left < 0) return true;

		const right = Math.ceil(x + this.player.width / 2);
		const bottom = Math.floor(y - this.player.height / 2);
		const top = Math.ceil(y + this.player.height / 2);

		console.log(x, y, bottom, top);

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
		return this.checkCollision(this.player.wx, this.player.wy - EPSILON * 2);
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
					this.ctx.fillStyle = 'black';
					break;
				case Tile.Earth:
					this.ctx.fillStyle = 'brown';
					break;
				case Tile.Lava:
					this.ctx.fillStyle = 'red';
					break;
			}

			this.ctx.fillRect(x - this.camera.x, y - this.camera.y, this.TILE_SIZE, this.TILE_SIZE);
		}

		this.ctx.fillStyle = 'blue';

		const x = this.player.wx * this.TILE_SIZE;
		const y = this.height - this.player.wy * this.TILE_SIZE - this.TILE_SIZE;

		this.ctx.fillRect(
			x - this.camera.x - (this.player.width * this.TILE_SIZE) / 2,
			y - this.camera.y - (this.player.height * this.TILE_SIZE) / 2 + this.TILE_SIZE,
			this.player.width * this.TILE_SIZE,
			this.player.height * this.TILE_SIZE
		);
	}

	update(ts: number) {
		if (!this.prevTime) {
			this.prevTime = ts;
			this.requestId = requestAnimationFrame((ts) => this.update(ts));
			return;
		}
		const dt = (ts - this.prevTime) / 1000;
		this.prevTime = ts;

		this.physics(dt);

		if (this.keys.has('w')) {
			this.camera.shift(0, -this.TILE_SIZE * 5 * dt);
		}
		if (this.keys.has('s')) {
			this.camera.shift(0, this.TILE_SIZE * 5 * dt);
		}
		if (this.keys.has('a')) {
			this.camera.shift(-this.TILE_SIZE * 5 * dt, 0);
		}
		if (this.keys.has('d')) {
			this.camera.shift(this.TILE_SIZE * 5 * dt, 0);
		}

		this.camera.update(dt);
		this.render();

		this.requestId = requestAnimationFrame((ts) => this.update(ts));
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
