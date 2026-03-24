# Political AI Chatbot

[![Demo](https://img.youtube.com/vi/WwVQNzJJSXc/1.jpg)](https://www.youtube.com/watch?v=WwVQNzJJSXc) 
[![Demo](https://img.youtube.com/vi/KZiHEbcUgYk/1.jpg)](https://www.youtube.com/watch?v=KZiHEbcUgYk)

An interactive art exhibition installation that lets visitors hold a live conversation with an AI embodying a radical-right political persona. The chatbot argues with conviction, selects statistics strategically, and never hedges — confronting the visitor with how these arguments feel from the inside: their seductive logic, their emotional pull, and their danger.

Built for gallery and exhibition contexts. Bilingual (English / German). Fully self-contained — no cloud APIs required.

---

## Architecture

```
Browser → localhost:3000
             │
     ┌───────▼─────────┐        ┌──────────────────┐
     │   Frontend      │        │    Backend       │
     │  React + nginx  │──────▶ │   FastAPI        │
     │  port 3000      │  /api  │   port 8000      │
     └─────────────────┘        └────────┬─────────┘
                                          │
                                 ┌────────▼──────────┐
                                 │     Ollama        │
                                 │  dolphin-mistral  │
                                 │  port 11434       │
                                 └───────────────────┘
```

Three Docker containers communicating over an internal bridge network. The frontend's nginx serves the React build and reverse-proxies all `/api/*` requests to the backend — the browser never speaks to the backend directly.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · TypeScript · Tailwind CSS · Framer Motion · Radix UI |
| Backend | FastAPI · Python 3.10 · uvicorn · httpx |
| LLM | Ollama running `dolphin-mistral` (fully local, no API key) |
| Streaming | Server-Sent Events — tokens appear word by word as they generate |
| TTS | Browser Web Speech API — zero latency, no network round-trip |
| Deployment | Docker Compose (3 containers) |

---

## Quick Start

**Requirements:** Docker Desktop

```bash
git clone https://github.com/ilonae/Political_AI_chatbot_Interaction.git
cd Political_AI_chatbot_Interaction

docker compose up --build

# First time only — pull the LLM model (~4 GB, run in a second terminal):
docker exec -it political-chatbot-ollama ollama pull dolphin-mistral
```

Open **http://localhost:3000**

The model download takes 5–10 minutes. Until it completes, the chatbot returns fallback responses rather than crashing.

→ Full setup, config reference, and deployment options: [INSTRUCTIONS.md](INSTRUCTIONS.md)

---

## Evolution

The project went through several distinct technical phases:

**Phase 1 — Python prototype**
Single-file Flask scripts exploring different conversation formats: one-on-one debate, multi-topic discussion, philosophical dialogue. No frontend. Used directly via terminal.

**Phase 2 — FastAPI backend + React frontend**
Separated concerns into a proper client/server architecture. FastAPI replaced Flask for async support and automatic OpenAPI docs. React + TypeScript frontend built from scratch with a chat UI, animated message bubbles, language toggle, and recommended follow-up questions.

**Phase 3 — OpenAI TTS + language support**
Integrated OpenAI's TTS API for realistic voice output. Added full bilingual support (English / German) including translated system prompts, UI strings, and language-aware recommended answers.

**Phase 4 — Migration to local LLM (Ollama)**
Replaced the cloud LLM with Ollama running `dolphin-mistral` locally. Motivated by privacy: all visitor conversation data stays on the exhibition machine — nothing is sent to external APIs. Tradeoff: CPU-intensive inference.

**Phase 5 — Multi-container Docker + streaming**
Restructured from a monolithic single container to three separate containers (frontend / backend / ollama) communicating over Docker's internal network. Added Server-Sent Events streaming so responses appear token by token rather than after a long wait. Replaced gTTS (slow, requires Google network call) with the browser's native Web Speech API (instant, fully local).

**Phase 6 — Cleanup and hardening**
Removed all dead code: legacy endpoints, duplicate routes, unused state and imports, 14 obsolete documentation files. Consolidated docs into `README.md` + `INSTRUCTIONS.md`. Added Ollama CPU/memory caps to keep the host machine responsive during inference. Pinned backend dependencies, removed unused packages (`gTTS`, `requests`).

---

## Key Design Decisions

**Why local LLM?**
Every visitor message is a politically sensitive conversation with a far-right AI persona. Routing that through a commercial cloud API creates a data trail and raises GDPR questions for EU exhibitions. Ollama keeps everything on the exhibition machine.

**Why Server-Sent Events for streaming?**
Without streaming, the visitor stares at a blank response area for 20–30 seconds (CPU inference is slow). With SSE, words appear immediately as they generate — the experience feels live and conversational rather than broken.

**Why browser TTS instead of a backend service?**
The original gTTS implementation made a blocking HTTP call to Google's servers, received an MP3, and played it back — adding 2–4 seconds of latency after the response was already complete. The browser's `window.speechSynthesis` API starts speaking in milliseconds with no network round-trip, and crucially, keeps audio data local.

**Why dolphin-mistral?**
Mistral 7B is small enough to run on a CPU in a reasonable time while being capable enough to hold a coherent and rhetorically sharp conversation. The `dolphin` fine-tune follows instructions reliably without the safety refusals that would break the persona.

---

## Privacy

With the current setup, **all data stays on the machine running Docker**. No conversation content, no audio, no usage data is sent to any external service. This is intentional for the exhibition context.

---

## License

MIT — see [LICENSE](LICENSE).
