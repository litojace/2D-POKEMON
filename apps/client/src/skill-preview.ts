import { RULES, blinkLanding, blocked, type Ability } from "@arena/shared";

/**
 * Aim preview: the area a skill will cover if released now, drawn on the
 * ground in world units. Shapes mirror the server's hit rules (range, radius,
 * arc, barrage spread, zone placement), so what you see is what can hit.
 */
type Point = { x: number; y: number };
export interface PreviewShape {
  polygons: Point[][];
  /** Filled discs (zone landing spot, nova, self skills). */
  discs: { x: number; y: number; r: number }[];
  /** Thin outlines (a zone's maximum reach). */
  rings: { x: number; y: number; r: number }[];
}
const SELF_RING = 46;

/** A thick line from `a` toward `angle`, `length` long, as a polygon with an arrow tip. */
function lane(a: Point, angle: number, length: number, width: number) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle),
    h = width / 2,
    head = Math.min(26, length * 0.3);
  const at = (along: number, side: number) => ({
    x: a.x + cos * along - sin * side,
    y: a.y + sin * along + cos * side,
  });
  return [
    at(0, -h),
    at(length - head, -h),
    at(length - head, -h - 7),
    at(length, 0),
    at(length - head, h + 7),
    at(length - head, h),
    at(0, h),
  ];
}
function sector(c: Point, angle: number, radius: number, half: number) {
  const steps = Math.max(6, Math.ceil((half * 2 * 180) / Math.PI / 8));
  const points = [c];
  for (let i = 0; i <= steps; i++) {
    const t = angle - half + (2 * half * i) / steps;
    points.push({
      x: c.x + Math.cos(t) * radius,
      y: c.y + Math.sin(t) * radius,
    });
  }
  return points;
}

export function previewShape(
  ability: Ability,
  from: Point,
  aim: Point,
): PreviewShape {
  const shape: PreviewShape = { polygons: [], discs: [], rings: [] };
  const angle = Math.atan2(aim.y - from.y, aim.x - from.x);
  const start = (offset = 0) => ({
    x: from.x + Math.cos(angle + offset) * 30,
    y: from.y + Math.sin(angle + offset) * 30,
  });
  const width = Math.max(12, ability.radius * 2);
  switch (ability.kind) {
    case "projectile":
    case "charged":
      shape.polygons.push(lane(start(), angle, ability.range, width));
      break;
    case "barrage": {
      const n = ability.count ?? 5;
      for (let i = 0; i < n; i++) {
        const offset = (i - (n - 1) / 2) * 0.11;
        shape.polygons.push(
          lane(
            start(offset),
            angle + offset,
            ability.range,
            Math.max(8, ability.radius * 1.4),
          ),
        );
      }
      break;
    }
    case "beam":
      shape.polygons.push(
        lane(from, angle, ability.range, (ability.radius + RULES.radius) * 2),
      );
      break;
    case "melee":
    case "cone": {
      const arc = ability.arc ?? (ability.kind === "melee" ? 0.35 : 0.7);
      shape.polygons.push(
        sector(from, angle, ability.range + RULES.radius, Math.acos(arc)),
      );
      break;
    }
    case "zone": {
      const distance = ability.follow
        ? 0
        : Math.min(ability.range, Math.hypot(aim.x - from.x, aim.y - from.y));
      shape.discs.push({
        x: from.x + Math.cos(angle) * distance,
        y: from.y + Math.sin(angle) * distance,
        // A turret (Haunted Lantern) covers as far as it shoots.
        r: ability.turret?.range ?? ability.radius,
      });
      if (!ability.follow)
        shape.rings.push({ x: from.x, y: from.y, r: ability.range });
      break;
    }
    case "blink": {
      // Where you'd land now (walls stop it, as on the server), the hop's
      // path, and the burst there; the ring is the farthest it can reach.
      const land = blinkLanding(
        from,
        angle,
        Math.min(ability.range, Math.hypot(aim.x - from.x, aim.y - from.y)),
      );
      const length = Math.hypot(land.x - from.x, land.y - from.y);
      if (length > 1) shape.polygons.push(lane(from, angle, length, 10));
      shape.discs.push({
        ...land,
        r: ability.damage > 0 ? ability.radius + RULES.radius : SELF_RING,
      });
      shape.rings.push({ x: from.x, y: from.y, r: ability.range });
      break;
    }
    case "rush": {
      // The charge's lane: anyone whose body it brushes is hit (the server's
      // contact gap is 10 px), plus the eruption around them if it has one.
      shape.polygons.push(
        lane(from, angle, ability.range, (RULES.radius + 10) * 2),
      );
      if (ability.explosion)
        shape.rings.push({
          x: from.x + Math.cos(angle) * ability.range,
          y: from.y + Math.sin(angle) * ability.range,
          r: ability.explosion + RULES.radius,
        });
      break;
    }
    case "nova":
      shape.discs.push({
        x: from.x,
        y: from.y,
        r: ability.radius + RULES.radius,
      });
      break;
    case "screen": {
      // The curtain itself: its real length, across the aim, a little ahead.
      const d = ability.screen?.distance ?? 90,
        half = (ability.screen?.length ?? 200) / 2,
        cx = from.x + Math.cos(angle) * d,
        cy = from.y + Math.sin(angle) * d,
        ux = Math.cos(angle + Math.PI / 2),
        uy = Math.sin(angle + Math.PI / 2),
        tx = Math.cos(angle) * 12,
        ty = Math.sin(angle) * 12;
      shape.polygons.push([
        { x: cx - ux * half - tx, y: cy - uy * half - ty },
        { x: cx + ux * half - tx, y: cy + uy * half - ty },
        { x: cx + ux * half + tx, y: cy + uy * half + ty },
        { x: cx - ux * half + tx, y: cy - uy * half + ty },
      ]);
      break;
    }
    case "taunt":
      // Everyone this close is taunted.
      shape.discs.push({
        x: from.x,
        y: from.y,
        r: ability.radius + RULES.radius,
      });
      break;
    case "tether":
      // It locks onto the enemy nearest the aim within this reach.
      shape.rings.push({ x: from.x, y: from.y, r: ability.range });
      shape.polygons.push(lane(from, angle, ability.range, 16));
      break;
    case "grapple":
      // The tongue's lane: it catches the first enemy (or wall) along it.
      shape.polygons.push(
        lane(from, angle, ability.range, (ability.radius + RULES.radius) * 2),
      );
      break;
    case "shrapnel":
      shape.polygons.push(
        sector(from, angle, ability.range, (ability.fan ?? 1.2) / 2),
      );
      break;
    case "pinball": {
      // The first stretch, to the first wall it will bounce off.
      const wall = blinkLanding(from, angle, RULES.width * 2);
      shape.polygons.push(
        lane(
          from,
          angle,
          Math.hypot(wall.x - from.x, wall.y - from.y),
          (RULES.radius + 8) * 2,
        ),
      );
      shape.discs.push({ ...wall, r: SELF_RING });
      break;
    }
    case "seedling":
    case "timewarp":
    case "swap": {
      // Where it lands (at the aim, over cover; an aim inside a wall lands
      // just short of it, as on the server), and its reach. A swap takes
      // whoever is nearest the aim.
      const reach = Math.min(
        ability.range,
        Math.hypot(aim.x - from.x, aim.y - from.y),
      );
      const point = {
        x: from.x + Math.cos(angle) * reach,
        y: from.y + Math.sin(angle) * reach,
      };
      const at =
        ability.kind !== "swap" && blocked(point.x, point.y, 6)
          ? blinkLanding(from, angle, reach)
          : point;
      shape.discs.push({ ...at, r: ability.radius });
      shape.rings.push({ x: from.x, y: from.y, r: ability.range });
      break;
    }
    default:
      // Clone, counter, barrier, buff, rest, veil: they act on yourself. A buff
      // with a takeoff pop (Static Glide) shows how far the pop shoves.
      shape.discs.push({
        x: from.x,
        y: from.y,
        r: ability.pop ? ability.pop.radius + RULES.radius : SELF_RING,
      });
  }
  return shape;
}

/** The Phaser Graphics calls the preview needs (a recorder in tests). */
export interface PreviewPainter {
  fillStyle(color: number, alpha?: number): unknown;
  lineStyle(width: number, color: number, alpha?: number): unknown;
  fillPoints(points: Point[], close?: boolean): unknown;
  strokePoints(points: Point[], close?: boolean): unknown;
  fillCircle(x: number, y: number, r: number): unknown;
  strokeCircle(x: number, y: number, r: number): unknown;
}
export function drawPreview(
  g: PreviewPainter,
  shape: PreviewShape,
  color: number,
  ready: boolean,
) {
  const fill = ready ? 0.2 : 0.08,
    line = ready ? 0.85 : 0.35;
  for (const ring of shape.rings) {
    g.lineStyle(2, 0xffffff, ready ? 0.22 : 0.12);
    g.strokeCircle(ring.x, ring.y, ring.r);
  }
  for (const points of shape.polygons) {
    g.fillStyle(color, fill);
    g.fillPoints(points, true);
    g.lineStyle(2, color, line);
    g.strokePoints(points, true);
  }
  for (const disc of shape.discs) {
    g.fillStyle(color, fill);
    g.fillCircle(disc.x, disc.y, disc.r);
    g.lineStyle(2, color, line);
    g.strokeCircle(disc.x, disc.y, disc.r);
  }
}
