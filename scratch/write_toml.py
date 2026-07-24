import os

content = (
    "[build]\n"
    "  command = \"npm run build\"\n"
    "  publish = \".next\"\n\n"
    "[[plugins]]\n"
    "  package = \"@netlify/plugin-nextjs\"\n"
)

# Caminho absoluto para o netlify.toml
toml_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "netlify.toml"))

with open(toml_path, "wb") as f:
    f.write(content.encode("utf-8"))

print("netlify.toml escrito com sucesso com LF unix!")
