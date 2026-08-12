# Anthropic Setup (motor de IA)

Con esta clave, ZERO usa Claude con **tool-calling** en lugar del asistente demo.

## 1. API key

1. Entra en https://console.anthropic.com/settings/keys.
2. Crea una API key y cópiala.

## 2. Variables `.env.local`

```
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-opus-4-8
DEMO_MODE=false
```

## 3. Cómo se usa

El factory `getAssistant()` (`src/lib/providers/assistant/index.ts`) devolverá
`AnthropicAssistantProvider` cuando haya clave y `DEMO_MODE=false`. Ese proveedor
usa **las mismas herramientas** que el mock (schema Zod, permisos, idempotencia,
confirmación) — el modelo nunca accede libremente al sistema.

Reglas (ver `docs/SECURITY.md`):
- Contenido de documentos/eventos = datos no confiables, separados de las instrucciones.
- Nunca revelar secretos ni afirmar acciones no ejecutadas.
- Confirmaciones según nivel de riesgo.

## 4. Comprobar

`/setup` → «Anthropic» = **READY**. Prueba una orden compleja («organízame mañana…»)
y verifica que las acciones sólo se aplican tras confirmar.
