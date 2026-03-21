# Political AI Chatbot — Instructions

An art exhibition chatbot that embodies a radical-right political persona. Visitors interact with it directly, confronting how these arguments feel from the inside — their seductive logic, emotional pull, and danger.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Tailwind CSS, served by nginx |
| Backend | FastAPI + uvicorn (Python 3.10) |
| LLM | Ollama running `dolphin-mistral` locally |
| TTS | Browser Web Speech API (zero latency, no network) |
| Transport | Server-Sent Events for token-by-token streaming |
| Deployment | Docker Compose (3 containers) |

---

## Starting the app

**Requirements:** Docker Desktop installed and running.

```bash
# Build and start all containers
docker compose up --build

# First time only: pull the LLM model (~4 GB, run in a second terminal)
docker exec -it political-chatbot-ollama ollama pull dolphin-mistral
```

Open **http://localhost:3000**.

> The model download takes 5–10 min depending on your connection. The app shows fallback responses until the model is ready.

---

## Rebuilding after code changes

```bash
docker compose build --no-cache && docker compose up -d
```

---

## Common commands

```bash
docker compose up -d          # start in background
docker compose down           # stop all containers
docker compose down -v        # stop + wipe downloaded model volume
docker compose logs -f        # tail logs from all containers
docker compose ps             # check container status
```

---

## Configuration

All runtime config lives in `.env.docker`. It is committed because it contains no real secrets — only exhibition-specific settings.

| Variable | Default | Notes |
|---|---|---|
| `OLLAMA_MODEL` | `dolphin-mistral` | Model to use for inference |
| `OLLAMA_HOST` | `http://ollama:11434` | Internal Docker DNS — do not change |
| `SYS_PROMPT_ENGLISH` | *(persona text)* | The chatbot's English persona |
| `SYS_PROMPT_GERMAN` | *(persona text)* | The chatbot's German persona |
| `AI_TIMEOUT` | `120` | Seconds before an LLM request times out |
| `AI_MAX_RETRIES` | `1` | LLM retry attempts on failure |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins |

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/endpoints.py        # All HTTP + SSE endpoints
│   │   ├── core/config.py          # Pydantic settings
│   │   ├── models/chat.py          # Request/response schemas
│   │   └── services/chat_service.py  # Ollama client, session state, streaming
│   ├── Dockerfile
│   ├── env.example                 # Template for local dev .env
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/             # React UI components
│   │   ├── services/
│   │   │   ├── api.ts              # HTTP client + SSE streaming
│   │   │   ├── voiceService.ts     # TTS abstraction (browser Web Speech API)
│   │   │   └── browserVoiceService.ts
│   │   └── types/Chat.ts
│   ├── Dockerfile
│   └── nginx.conf                  # Reverse proxy: /api/* → backend:8000
├── scripts/                        # Helper shell scripts
├── docker-compose.yaml
└── .env.docker                     # Runtime config (safe to commit)
```

---

## API endpoints

All endpoints are under `/api/chat/`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat/start` | Start a new conversation, returns opening message |
| `POST` | `/api/chat/message/stream` | Send a message, stream response as SSE |
| `POST` | `/api/chat/reset` | Clear session history |
| `POST` | `/api/chat/update_language` | Switch language (en/de) |
| `GET` | `/health` | Backend health check |

Recommendations are returned inside the `done` SSE event of `/message/stream` — there is no separate recommendations endpoint.

---

## Local development (without Docker)

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp env.example .env   # fill in values
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8000 npm start
```

Ollama must be running locally: `ollama serve` (pull the model first if needed).

---

## CPU usage / performance note

Ollama runs inference on CPU by default, which is compute-heavy. The `docker-compose.yaml` caps it at 4 cores and 6 GB RAM. If responses are too slow, options are:

- **Raise the CPU cap** in `docker-compose.yaml` (trade: more host CPU usage)
- **Run on Apple Silicon** — Ollama uses Metal GPU on M-series Macs, response times drop to ~2s
- **Run on a GPU cloud VM** (RunPod, Vast.ai) — point `OLLAMA_HOST` at the remote URL
- **Switch to a hosted API** (Groq free tier is extremely fast and runs Mistral variants)

---

## Privacy note

With the current Ollama setup, **all conversation data stays on the machine running Docker**. No text is sent to any external service. This is intentional for the exhibition context.

---

## License

MIT — see [LICENSE](LICENSE).
