import type { Page } from "@playwright/test";

/**
 * A bistro with everything in it, for layout checks: a high level, big
 * numbers, staff of every role (one a friend with a long name), stock,
 * orders ready to hand over, stored furniture and friends (bistro-fake.ts
 * plays the server).
 */
export const richBistro = (page: Page) =>
  page.evaluate(
    `(() => { const b = window.__bistro; const srv = window.__bistroServer; ${RICH} })()`,
  );
const RICH = `const S = srv.S; S.level = 12; S.coins = 1234567; S.rating = 4.6; S.served = 98765;
         S.staff.push({ id: 2, char: 'pyranda', role: 'cook', level: 3, dish: 'pho' },
                      { id: 3, char: 'glacelle', role: 'waiter', level: 5, dish: 'goicuon' },
                      { id: 4, char: 'wombolder', role: 'cook', level: 1, dish: 'lau', energy: 12 },
                      { id: 5, char: 'tidefin', role: 'janitor', level: 2, dish: 'goicuon', energy: 35 },
                      { id: 6, char: 'lumoth', role: 'waiter', level: 1, dish: 'goicuon', energy: 140,
                        friend: { id: '00000000-0000-4000-8000-000000000673', name: 'Bartholomew the Brave' } });
         S.trash = 4;
         S.stars = 2; S.tokens = 45; S.regulars = { mira: 1, tobi: 3 };
         S.dishLv = { pho: { lv: 4, mastery: 12 }, lau: { lv: 10, mastery: 0 }, goicuon: { lv: 2, mastery: 10 } };
         S.pantry = { rice: 12, flour: 3, herbs: 99, pork: 1, spice: 2 };
         S.stoves.push({ x: 3, model: 'clay', dish: null, start: 0, perfect: false }, { x: 4, model: 'clay', dish: null, start: 0, perfect: false });
         S.counter = [{ dish: 'lau', servings: 188, perfect: true }, { dish: 'pho', servings: 12, perfect: false },
                      { dish: 'banhmi', servings: 12, perfect: false }, { dish: 'goicuon', servings: 4, perfect: false }];
         // (Two catering orders ready: the Orders tab's "Hand over all" shows.)
         S.stored = { plant: 12, lamp: 3, fountain: 1, aquarium: 2, rug: 1, luckycat: 4 };
         srv.extras.leaves = 98765; srv.extras.tradedToday = 120;
         srv.friends = [
           { id: '00000000-0000-4000-8000-000000000672', name: 'Bartholomew the Brave', fighter: 'tidefin', level: 27, rating: 4.9, popularity: 47.6, likes: 1234, served: 123456, servings: 88, dined: true, liked: false },
           { id: '00000000-0000-4000-8000-000000000673', name: 'Cy', fighter: 'lumoth', level: 3, rating: 2.1, likes: 0, served: 4, servings: 0, dined: false, liked: true },
         ];
         return b.load();`;
