# Origen de este skill

- Repositorio: https://github.com/zubair-trabzada/scroll-cinematic-claude
- Commit copiado: `5f3cc0e65e474dab1d80ee3fda1e847f3552f708` (2026-06-10)
- El repositorio original **no incluye fichero de licencia**. Se copia aquí tal cual
  para que cualquier sesión lo tenga sin volver a descargarlo; si hace falta uso
  más allá del interno, revisa la licencia con el autor.

## Única modificación respecto al original

En `SKILL.md` se cambiaron las rutas `~/.claude/skills/scroll-cinematic/` por
`.claude/skills/scroll-cinematic/`, porque aquí el skill vive dentro del repo
(igual que el resto de skills) y no en el home del usuario.

## Actualizar

```bash
git clone --depth 1 https://github.com/zubair-trabzada/scroll-cinematic-claude /tmp/sc
cp -r /tmp/sc/{SKILL.md,README.md,scripts,templates,assets} .claude/skills/scroll-cinematic/
# vuelve a aplicar el cambio de rutas de SKILL.md
sed -i 's|~/.claude/skills/scroll-cinematic/|.claude/skills/scroll-cinematic/|g' .claude/skills/scroll-cinematic/SKILL.md
```
