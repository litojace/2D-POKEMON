import type Phaser from "phaser";

export function renderingAudit(game: Phaser.Game) {
  const canvas = game.canvas;
  const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const gl = renderer.gl;
  const rig = Object.values(game.textures.list).filter((t) =>
    t.key.startsWith("rig-"),
  );
  const oldUnit = gl.getParameter(gl.ACTIVE_TEXTURE);
  gl.activeTexture(gl.TEXTURE0);
  const oldBinding = gl.getParameter(gl.TEXTURE_BINDING_2D);
  const filters = rig.map((texture) => {
    gl.bindTexture(gl.TEXTURE_2D, texture.source[0].glTexture.webGLTexture);
    return gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER);
  });
  gl.bindTexture(gl.TEXTURE_2D, oldBinding);
  gl.activeTexture(oldUnit);
  return {
    pixelArt: game.config.pixelArt,
    antialias: game.config.antialias,
    imageRendering: getComputedStyle(canvas).imageRendering,
    filters,
  };
}
