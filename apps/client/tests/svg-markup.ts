/** Binary image data may coincidentally spell NaN/undefined; inspect markup. */
export function svgMarkup(svg: string) {
  return svg.replace(
    /href="data:image\/png;base64,[^"]*"/g,
    'href="embedded-png"',
  );
}
