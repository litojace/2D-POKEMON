import type Phaser from "phaser";

/**
 * A drawing layer that sorts with the fighters by a ground y: something drawn
 * on it shows in front of raiders standing behind that line and behind those
 * in front of it. The same key gets the same layer every frame (cleared once
 * per frame), so per-graphics animation memory keeps working.
 */
export type LayerAt = (key: string, groundY: number) => Phaser.GameObjects.Graphics;
