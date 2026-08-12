# Voz

## Flujo (push-to-talk)

1. Pulsas el núcleo → NOVA entra en `listening` (texto «Te escucho…»).
2. Web Audio API mide el volumen real del micro → el núcleo reacciona.
3. Web Speech API transcribe (interim + final) → se muestra la transcripción.
4. Al terminar, el texto se envía al asistente (`thinking` → `executing` → `speaking`).
5. NOVA responde por voz (TTS) y texto, y muestra el resultado en el monitor.

Siempre hay alternativa por teclado (Composer + `Cmd/Ctrl+K`).

## Abstracciones

- `SpeechToTextProvider` (`lib/providers/speech/types.ts`)
  - `WebSpeechSTT` (navegador). Si no existe (p. ej. Firefox), la UI cae a teclado.
  - *Fallback previsto:* `MediaRecorder` + backend de transcripción configurable.
- `TextToSpeechProvider`
  - `WebSpeechTTS` (SpeechSynthesis). Selección de voz es-ES, velocidad y volumen.
  - *Previsto:* ElevenLabs / OpenAI Audio / Google, sin tocar la UI.

## Configuración (Ajustes)

Voz on/off, voz TTS, velocidad, volumen, idioma, sonidos. Se persisten por usuario
(localStorage hoy; Supabase cuando exista auth).

## Notas

- Permiso de micrófono: se pide al pulsar el núcleo (contextual), no al abrir.
- No se almacenan grabaciones. Las pistas se detienen tras cada turno.
- El visualizador usa `AnalyserView`/RMS para un nivel 0..1 suavizado.
