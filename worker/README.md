# Vāchaspati native speech inference worker

This is a separate stateful Node.js service using the actual `sherpa-onnx-node` native addon (not a demo or synthetic response). Deploy on a Linux CPU/GPU machine with enough RAM. **Do not deploy native inference to Vercel.**

## Setup

1. Obtain and license-check suitable Sherpa-ONNX offline recognition and synthesis models (model weights are not bundled).
2. Mount the model directories under `/models`, and configure `SHERPA_ASR_CONFIG_JSON`, `SHERPA_TTS_CONFIG_JSON` and `SHERPA_VOICES_JSON` with valid model and speaker paths/IDs. Use the exact model-family configuration from the [Sherpa-ONNX JavaScript documentation](https://k2-fsa.github.io/sherpa/onnx/javascript-api/).
3. Set a strong random `SHERPA_WORKER_SECRET` in both the worker and the Next.js server.
4. `cd worker && npm install && npm start` or build from `worker/Dockerfile`.
5. Point the Next.js `SHERPA_INFERENCE_URL` to the worker's **private network address**, reachable only from your backend. Enforce network firewall rules and TLS at the proxy.
6. Confirm `GET /health` reports model readiness and run real transcribe/synthesize audio tests.

Endpoints: `POST /transcribe` accepts up to 120 seconds of PCM16 WAV (8–48kHz, 1–2 channels); `POST /synthesize` accepts a JSON object with `text`, `voice`, and `language`, returning a PCM16 WAV. Both require `X-Worker-Secret`.

The worker eagerly loads ASR/TTS engines on startup and fails closed if a model config is missing or invalid. No cloud fallback or hardcoded generated speech is used. Unsupported locale requests must not be presented as supported; deploy tested models and publish only verified locales.
