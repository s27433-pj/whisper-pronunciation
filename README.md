# Whisper Pronunciation Trainer 🎙️

Prosta aplikacja open source do:
- nagrywania wypowiedzi po angielsku,
- porównania ich z zadanym zdaniem,
- oceny **słów** i **akcentu** z wykorzystaniem Whisper.

## 🔧 Technologie

- Backend: **Python 3.12**, FastAPI, Whisper (`medium.en`)
- Frontend: **React + Vite**
- Komunikacja: REST (JSON)
- Uruchomienie lokalne: `uvicorn` + `npm run dev`

---

## 🚀 Szybki start

### 1. Backend (FastAPI + Whisper)

Wymagania:
- Python 3.10+
- zainstalowany `ffmpeg` (na Windows np. przez `choco install ffmpeg`)

```bash
git clone https://github.com/s27433-pj/whisper-pronunciation.git
cd whisper-pronunciation/backend

python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt

uvicorn app:app --reload
