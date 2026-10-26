import { TOWN_ART } from "../../../apps/client/src/town-assets";
import {
  animalMotionSprite,
  createDogMotion,
  createHenMotion,
  gullMotion,
  stepDog,
  stepHen,
} from "../../../apps/client/src/town-animal-motion";
import {
  dogSprite,
  henSprite,
  gullSprite,
} from "../../../apps/client/src/town-animals";

/** Review the shipped poses and locomotion model, with a controllable clock. */
export async function reviewAnimals() {
  const image = new Image();
  image.src = TOWN_ART.animalMotion;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 480;
  document.body.append(canvas);
  const c = canvas.getContext("2d")!;
  const dog = createDogMotion(),
    hens = [
      createHenMotion({ x: 0, y: 0 }, 0.3),
      createHenMotion({ x: 0, y: 0 }, 2.4),
    ];
  let time = 0,
    dx = 0,
    dp = stepDog(dog, 0, 0),
    hp = hens.map((h) => stepHen(h, 0));
  const draw = () => {
    c.fillStyle = "#14242d";
    c.fillRect(0, 0, 800, 480);
    const label = (text: string, y: number) => {
      c.fillStyle = "#d6d9bf";
      c.font = "bold 15px sans-serif";
      c.fillText(text, 20, y);
    };
    c.fillStyle = "#263d35";
    c.fillRect(14, 44, 772, 139);
    c.fillRect(14, 218, 772, 99);
    c.fillRect(14, 352, 772, 116);
    label("DOG · WALK / SNIFF / REST", 30);
    label("HENS · WALK / PECK", 204);
    label("BIRDS · WINGBEAT / GLIDE · BOTH DIRECTIONS", 339);
    const place = (
      s: ReturnType<typeof dogSprite>,
      x: number,
      y: number,
      scale: number,
      flip = false,
      rotation = 0,
    ) => {
      c.save();
      c.translate(x, y);
      c.rotate(rotation);
      c.scale(flip ? -scale : scale, scale);
      c.translate(-s.ax, -s.ay);
      s.draw(c);
      c.restore();
    };
    const shadow = (x: number, y: number, w: number) => {
      c.fillStyle = "rgba(0,0,0,.22)";
      c.beginPath();
      c.ellipse(x, y, w, 4, 0, 0, Math.PI * 2);
      c.fill();
    };
    const x = 100 + (dx % 590);
    shadow(x, 166, 48);
    place(
      animalMotionSprite(
        image,
        "dog",
        dp.pose,
        dp.frame,
        false,
        dogSprite(dp.pose, dp.frame),
      ),
      x,
      166,
      2.6,
    );
    hens.forEach((h, i) => {
      const p = hp[i],
        x = 210 + i * 360 + h.x * 1.6,
        y = 298 + h.y * 0.2;
      shadow(x, y, 34);
      place(
        animalMotionSprite(
          image,
          "hen",
          p.pose,
          p.frame,
          !!i,
          henSprite(i ? "brown" : "white", p.pose, p.frame),
        ),
        x,
        y,
        2.7,
        p.facing < 0,
      );
    });
    for (const [i, vx] of [90, -90].entries()) {
      const p = gullMotion(time, i * 0.6, vx, 3),
        x = i ? 700 - ((time * 48) % 600) : 100 + ((time * 48) % 600);
      place(
        animalMotionSprite(
          image,
          "gull",
          "fly",
          p.frame,
          false,
          gullSprite(p.frame),
        ),
        x,
        411 + p.lift,
        2.1,
        p.flipX,
        p.rotation,
      );
    }
  };
  draw();
  return {
    canvas,
    audit() {
      const groups: Record<string, number[]> = {};
      for (const [kind, pose, count, brown] of [
        ["dog", "walk", 8, false],
        ["hen", "walk", 4, false],
        ["hen", "peck", 4, false],
        ["hen", "walk", 4, true],
        ["hen", "peck", 4, true],
        ["gull", "fly", 8, false],
      ] as const) {
        groups[`${kind}-${pose}-${brown}`] = Array.from(
          { length: count },
          (_, f) => {
            const target = document.createElement("canvas");
            target.width = 256;
            target.height = 224;
            const ctx = target.getContext("2d")!;
            ctx.scale(3, 3);
            ctx.translate(8, 8);
            const frame =
              kind === "dog"
                ? dogSprite("walk", f)
                : kind === "hen"
                  ? henSprite(
                      brown ? "brown" : "white",
                      pose === "peck" ? "peck" : "walk",
                      f,
                    )
                  : gullSprite(f);
            animalMotionSprite(image, kind, pose, f, brown, frame).draw(ctx);
            const rgba = ctx.getImageData(0, 0, 256, 224).data;
            let hash = 2166136261,
              ink = 0;
            for (let i = 0; i < rgba.length; i++) {
              hash = Math.imul(hash ^ rgba[i], 16777619);
              if (i % 4 === 3 && rgba[i]) ink++;
            }
            if (ink < 100) throw new Error("Empty animal pose");
            return hash >>> 0;
          },
        );
      }
      return groups;
    },
    draw(t: number) {
      while (time < t - 1e-6) {
        const dt = Math.min(1 / 60, t - time);
        time += dt;
        dp = stepDog(dog, time, dt);
        dx += dog.speed * dt;
        hp = hens.map((h) => stepHen(h, dt));
      }
      draw();
    },
  };
}
