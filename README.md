# Whisper Pronunciation Trainer 🎙️

Prosta aplikacja do:
- nagrywania wypowiedzi po angielsku,
- porównania ich z zadanym zdaniem,
- oceny **słów** i **akcentu** z wykorzystaniem Whisper.

##  Technologie

- Backend: **Python 3.12**, FastAPI, Whisper (`medium.en`)
- Frontend: **React + Vite**
- Komunikacja: REST (JSON)
- Uruchomienie lokalne: `uvicorn` + `npm run dev`

---
nagrywanie mikrofonem w przeglądarce (MediaRecorder)

obsługa plików: .wav, .mp3, .webm, .ogg

analiza słów (WER → score)

analiza akcentu (na podstawie logprob segmentów Whispera)

ładne paski wyników + interpretacja

backend: FastAPI + Whisper (medium.en)

frontend: React + Vite

uruchamianie lokalne lub w Dockerze (docker compose up)

<img width="565" height="965" alt="image" src="https://github.com/user-attachments/assets/4aa31ded-8ea5-49e9-a873-c9dc535bf120" />
<img width="578" height="983" alt="image" src="https://github.com/user-attachments/assets/4c80c47c-0e14-49ec-ab5f-67585820cb26" />


## 🚀 Szybki start

Instalacja lokalna (bez Dockera)
Wymagania:

Python 3.10–3.12

FFmpeg

Wymagania:

Python 3.10–3.12

FFmpeg (np. Windows: choco install ffmpeg)

Backend uruchomi się na:

👉 http://localhost:8000

👉 Swagger UI: http://localhost:8000/docs

Frontend (React + Vite)

cd frontend

npm install
npm run dev

Frontend uruchomi się na:

👉 http://localhost:5173


Uruchamianie przez Docker Compose

Uruchamianie przez Docker Compose

Frontend:
👉 http://localhost:5173

Backend:
👉 http://localhost:8000/docs

Jak działa ocena wymowy?
1. Słowa (Lexical Score)

Oparte na WER (Word Error Rate):

score = 1 - (edycje / liczba_słów)


Przykład:

target: "This is a sample sentence"

user: "This is sample sentence"

WER = 1/5 → wynik = 80%

2. Akcent (Accent Score)

Akcent liczymy na podstawie średniego logprob segmentów Whispera:

pewna wymowa → logprob wysoki → 90–100%

niepewna → niższy logprob → 40–80%

Znormalizowane:

accent_score = clamp( (logprob + 1) / 2 ) * 100


Dodatkowo:

wszystko ≥ 80% → traktujemy jako 100% dla użytkownika, bo jest to poziom native-like.

3. Wynik łączny
combined = (accent_score + lexical_score) / 2
