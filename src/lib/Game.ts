import { Camera } from './Camera';
import { Renderer } from './Renderer';
import { dts } from './stores';
import { COLLIDES, Tile } from './Tile';
import { World } from './World';

const EPSILON = Number.EPSILON * 2 ** 20;

type Player = {
	wx: number;
	wy: number;
	vx: number;
	vy: number;
	width: number;
	height: number;
};

enum Collision {
	None,
	Blocked,
	Death
}

export class Game {
	readonly TILE_SIZE = 32;

	private requestId: number | null = null;
	private prevTime = 0;

	keys = new Set<string>();

	world: World;
	camera: Camera;
	player: Player;
	renderer: Renderer;

	private readonly COYOTE_TIME = 0.1;
	private jumpPressed = false;
	private lastOnGround: number = 0;

	constructor(
		public canvas: HTMLCanvasElement,
		public ctx: CanvasRenderingContext2D,
		public width: number,
		public height: number
	) {
		this.world = new World();
		this.camera = new Camera(0, 0, 800, 600);
		this.player = {
			wx: this.world.playerStart.x,
			wy: this.world.playerStart.y,
			vx: 0,
			vy: 0,
			width: 0.75,
			height: 1.75
		};
		this.renderer = new Renderer(this);
		this.resize();
	}

	resize() {
		this.renderer.resize();
	}

	start() {
		this.requestId = requestAnimationFrame(ts => this.update(ts));
	}

	place(x: number, y: number, tile: Tile) {
		x += this.camera.x;
		y += this.camera.y;
		const worldX = Math.floor(x / this.TILE_SIZE);
		const worldY = Math.floor((this.height - y) / this.TILE_SIZE);

		if (this.world.at(worldX, worldY) === tile) return;

		this.world.set(worldX, worldY, tile);
		this.renderer.invalidateNear(worldX, worldY);

		console.log(JSON.stringify(this.world.save()));
	}

	destroy() {
		cancelAnimationFrame(this.requestId!);
		this.requestId = null;
	}

	jump() {
		this.jumpPressed = true;
	}

	cancelJump() {
		this.jumpPressed = false;
	}

	private physics(t: number, dt: number) {
		const isOnGround = this.isOnGround();

		if (isOnGround) {
			this.lastOnGround = t;
		}

		const canJump = t - this.lastOnGround < this.COYOTE_TIME;

		if (canJump && this.jumpPressed) {
			this.player.vy = 25;
			this.jumpPressed = false;
			this.lastOnGround = 0;
		}

		const ay = -100;
		let ax = 0;

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

		this.player.vx *= 0.9 ** (dt * 120);
		this.player.vy *= 0.9 ** (dt * 30);

		const collisionX = this.getCollision(newX, this.player.wy);

		if (collisionX === Collision.Death) {
			this.die();
			return;
		}

		if (collisionX === Collision.None) {
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

		const collisionY = this.getCollision(this.player.wx, newY);

		if (collisionY === Collision.Death) {
			this.die();
			return;
		}

		if (collisionY === Collision.None) {
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

		if (this.player.wy + this.player.height / 2 < -1) {
			this.die();
		}
	}

	private getCollision(wx: number, wy: number): Collision {
		const left = Math.floor(wx - this.player.width / 2);

		if (left < 0) return Collision.Blocked;

		const playerBottom = wy - this.player.height / 2;

		const right = Math.ceil(wx + this.player.width / 2);
		const bottom = Math.floor(playerBottom);
		const top = Math.ceil(wy + this.player.height / 2);

		let collision = Collision.None;

		for (let wx = left; wx < right; wx++) {
			for (let wy = bottom; wy < top; wy++) {
				const tile = this.world.at(wx, wy);

				if (COLLIDES.includes(tile)) {
					if (collision === Collision.None)
						collision = Collision.Blocked;
				} else if (tile === Tile.Lava) {
					// lava is shorter than a full tile
					if (playerBottom < wy + 0.75) {
						collision = Collision.Death;
					}
				}
			}
		}

		return collision;
	}

	private isOnGround(): boolean {
		return (
			this.getCollision(this.player.wx, this.player.wy - EPSILON * 2) ===
			Collision.Blocked
		);
	}

	private die() {
		this.player.wx = this.world.playerStart.x;
		this.player.wy = this.world.playerStart.y;
		this.player.vx = 0;
		this.player.vy = 0;
	}

	private render() {
		this.renderer.render();
	}

	private update(ts: number) {
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

		this.physics(ts / 1000, dt);
		console.log(this.player.wx, this.player.wy);

		this.camera.follow({
			x: this.player.wx * this.TILE_SIZE,
			y: -this.player.wy * this.TILE_SIZE + this.height
		});
		this.camera.update(dt);
		this.render();

		this.requestId = requestAnimationFrame(ts => this.update(ts));
	}
}
