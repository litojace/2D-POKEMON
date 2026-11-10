"""Inline src/gloom-rig.js into the page: gloomshade.html opens straight from disk."""
import pathlib
here = pathlib.Path(__file__).parent
page = (here / "src/gloomshade.page.html").read_text()
rig = (here / "src/gloom-rig.js").read_text()
body = page.replace("/*__RIG__*/", rig)
(here / "build").mkdir(exist_ok=True)
(here / "build/gloomshade.fragment.html").write_text(body)
head = '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>body{margin:0}</style>\n'
(here / "gloomshade.html").write_text(head + body + "</html>\n")
print("built", len(body))
