"""Inline the kit and the rigs into the demo page: each .html opens straight from disk."""
import pathlib
here = pathlib.Path(__file__).parent
BOSSES = [  # (id, title, rig file, global)
    ("gloomshade", "Gloomshade Face Rig", "gloom-rig.js", "GLOOM"),
    ("somnara", "Somnara Face Rig", "somnara-rig.js", "SOMNARA"),
    ("prismatail", "Prismatail Face Rig", "prisma-rig.js", "PRISMA"),
    ("emberwing", "Emberwing Face Rig", "ember-rig.js", "EMBER"),
    ("storm-twins", "Storm Twins Face Rig", "twins-rig.js", "TWINS"),
    ("tidewyrm", "Tidewyrm Face Rig", "tide-rig.js", "TIDE"),
]
BOSSES = [b for b in BOSSES if (here / "src" / b[2]).exists()]
page = (here / "src/demo.page.html").read_text()
kit = (here / "src/kit.js").read_text()
head = '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>body{margin:0}</style>\n'
(here / "build").mkdir(exist_ok=True)
def make(name, title, bosses):
    rigs = "\n".join((here / "src" / b[2]).read_text() for b in bosses)
    body = (page.replace("__TITLE__", title).replace("/*__KIT__*/", kit).replace("/*__RIGS__*/", rigs)
            .replace("/*__BOSSES__*/", "[" + ", ".join(b[3] + ".boss" for b in bosses) + "]"))
    (here / "build" / (name + ".fragment.html")).write_text(body)
    (here / (name + ".html")).write_text(head + body + "</html>\n")
for b in BOSSES:
    make(b[0], b[1], [b])
make("all-bosses", "Raid Boss Face Rigs", BOSSES)
print("built", [b[0] for b in BOSSES])
