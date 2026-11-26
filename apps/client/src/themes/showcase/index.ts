/**
 * The Showcase look: a near-black stage, dark rounded tiles, lime action
 * buttons, pill tabs and Rubik. Every rule sits under
 * `:root[data-ui="showcase"]`, and this module is loaded only when a player
 * has chosen the look (ui-theme.ts), so none of it is in the page otherwise.
 * Order matters: tokens first, then the shared kit, then the screens.
 */
import "./fonts.css";
import "./tokens.css";
import "./kit.css";
import "./lobby.css";
import "./lobby-light.css";
import "./screens.css";
import "./battle.css";
