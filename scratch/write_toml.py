import os

content = (
    "[build]\n"
    "  command = \"npm run build\"\n"
    "  publish = \".next\"\n\n"
    "[build.environment]\n"
    "  NODE_OPTIONS = \"--max-old-space-size=4096\"\n\n"
    "[[plugins]]\n"
    "  package = \"@netlify/plugin-nextjs\"\n"
)

toml_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "netlify.toml"))

with open(toml_path, "wb") as f:
    f.write(content.encode("utf-8"))

print("netlify.toml escrito com sucesso com NODE_OPTIONS!")
