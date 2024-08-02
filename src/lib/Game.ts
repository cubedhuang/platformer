import { Camera } from './Camera';
import { Renderer } from './Renderer';
import { dts } from './stores';
import { Tile } from './Tile';
import { World } from './World';

const EPSILON = 0.01;

export class Game {
	readonly TILE_SIZE = 32;

	private requestId: number | null = null;
	private prevTime = 0;

	world = new World();
	camera = new Camera(0, 0, 800, 600);
	player = { wx: 3, wy: 4, vx: 0, vy: 0, width: 0.8, height: 1.8 };
	keys = new Set<string>();
	renderer: Renderer;

	constructor(
		public canvas: HTMLCanvasElement,
		public ctx: CanvasRenderingContext2D,
		public width: number,
		public height: number
	) {
		this.renderer = new Renderer(this);
		this.resize();
	}

	resize() {
		this.renderer.resize();
	}

	start() {
		this.requestId = requestAnimationFrame(ts => this.update(ts));
	}

	physics(dt: number) {
		const isOnGround = this.isOnGround();

		const ay = -100;
		let ax = 0;

		if (this.keys.has('ArrowUp') && isOnGround) {
			this.player.vy = 25;
		}
		if (this.keys.has('ArrowLeft')) {
			ax += -120;
		}
		if (this.keys.has('ArrowRight')) {
			ax += 120;
		}

		const newX = this.player.wx + this.player.vx * dt + (ax * dt * dt) / 2;
		const newY = this.player.wy + this.player.vy * dt + (ay * dt * dt) / 2;

		this.player.vx += ax * dt;
		this.player.vy += ay * dt;

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
		this.renderer.render();
	}

	update(ts: number) {
		if (!this.prevTime) {
			this.prevTime = ts;
			this.requestId = requestAnimationFrame(ts => this.update(ts));
			return;
		}
		const actualDt = (ts - this.prevTime) / 1000;
		const dt = Math.min(actualDt, 1 / 30);
		dts.update(d => {
			d.push(actualDt);
			if (d.length > 10) d.shift();
			return d;
		});
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

		if (this.world.at(worldX, worldY) === tile) return;

		this.world.set(worldX, worldY, tile);
		this.renderer.lazyInvalidate();

		console.log(this.world.toString());
	}

	destroy() {
		cancelAnimationFrame(this.requestId!);
		this.requestId = null;
	}
}
