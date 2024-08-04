<script lang="ts">
	import { Game } from '$lib/Game';
	import { dts } from '$lib/stores';
	import { Tile } from '$lib/Tile';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let game: Game;

	let placing = false;
	let selectedTile = Tile.Rock;
	let layerName: 'foreground' | 'midground' = 'foreground';

	onMount(() => {
		const ctx = canvas.getContext('2d', {
			desynchronized: true
		});

		if (!ctx) {
			throw new Error('2d context not supported');
		}

		game = new Game(canvas, ctx, canvas.width, canvas.height);
		game.start();

		return () => {
			game.destroy();
		};
	});
</script>

<svelte:window
	on:resize={() => {
		game.resize();
	}}
	on:mousedown={() => {
		placing = true;
	}}
	on:mouseup={() => {
		placing = false;
	}}
	on:mouseleave={() => {
		placing = false;
	}}
	on:blur={() => {
		placing = false;
	}}
	on:mousemove={({ clientX, clientY }) => {
		if (placing) {
			const { left, top } = canvas.getBoundingClientRect();
			const x = clientX - left;
			const y = clientY - top;
			game.place(x, y, selectedTile, layerName);
		}
	}}
	on:keydown={e => {
		game.keys.add(e.key);

		if (e.key === 'ArrowUp' && !e.repeat) {
			game.jump();
		}
	}}
	on:keyup={({ key }) => {
		game.keys.delete(key);

		if (key === 'ArrowUp') {
			game.cancelJump();
		}
	}}
/>

<div class="container">
	<div>
		<canvas width="800" height="600" bind:this={canvas}></canvas>

		<select bind:value={selectedTile}>
			<option value={Tile.Empty}>Empty</option>
			<option value={Tile.Earth}>Earth</option>
			<option value={Tile.Lava}>Lava</option>
			<option value={Tile.Rock}>Rock</option>
		</select>

		<select bind:value={layerName}>
			<option value="foreground">Foreground</option>
			<option value="midground">Midground</option>
		</select>

		{($dts.reduce((acc, dt) => acc + 1 / dt, 0) / $dts.length).toFixed(2)} FPS
		{(1 / ($dts.at(-1) ?? 0)).toFixed(2)} FPS
	</div>
</div>

<style>
	.container {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
	}

	canvas {
		border: 1px solid rgb(36, 45, 62);
		display: block;
	}
</style>
