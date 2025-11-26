from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import whisper
import tempfile
import shutil
from pathlib import Path
import re

app = FastAPI(
    title="Whisper API",
    description="Proste API do transkrypcji audio z użyciem Whisper",
    version="1.0.0",
)

# CORS – React na porcie 5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========= MODELE =========
GENERAL_MODEL_NAME = "small"       # do /transcribe
PRON_MODEL_NAME = "medium.en"      # do /assess_pronunciation (lepszy model EN)

print(f"[INFO] Ładuję model ogólny: {GENERAL_MODEL_NAME}...")
model_general = whisper.load_model(GENERAL_MODEL_NAME)
print("[INFO] Model ogólny załadowany.")

print(f"[INFO] Ładuję model do oceny wymowy: {PRON_MODEL_NAME}...")
model_pron = whisper.load_model(PRON_MODEL_NAME)
print("[INFO] Model wymowy załadowany.")



# ========= HELPERY DO OCENY WYMOWY =========

def _normalize_english(text: str) -> list[str]:
    """Normalizacja tekstu do porównania – tylko litery, małe, tokeny."""
    text = text.lower()
    text = re.sub(r"[^a-z']+", " ", text)  # zostaw litery i apostrof
    text = text.strip()
    if not text:
        return []
    return text.split()


def _wer_score(ref_words: list[str], hyp_words: list[str]) -> float:
    """
    WER (word error rate) → wynik w [0, 1].
    1.0 = idealnie, 0 = wszystko źle.
    """
    r = ref_words
    h = hyp_words
    n = len(r)
    m = len(h)

    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,        # delete
                dp[i][j - 1] + 1,        # insert
                dp[i - 1][j - 1] + cost  # substitute
            )

    edits = dp[n][m]
    if n == 0:
        return 0.0
    wer = edits / n
    return max(0.0, 1.0 - wer)


def _feedback_from_score(score: float) -> str:
    if score >= 0.9:
        return "Pronunciation is excellent – almost perfect match."
    elif score >= 0.75:
        return "Very good pronunciation – only minor issues."
    elif score >= 0.5:
        return "Understandable, but there are noticeable mistakes."
    else:
        return "Many differences – try speaking more clearly and slowly."



# ========= ENDPOINT 1: TRANSKRYPCJA / TŁUMACZENIE =========

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str | None = Form(None),      # język nagrania (pl, en, itp.)
    task: str = Form("transcribe"),         # transcribe / translate
):
    """
    Przyjmuje plik audio i zwraca transkrypcję lub tłumaczenie.
    """
    try:
        suffix = Path(file.filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = Path(tmp.name)
            shutil.copyfileobj(file.file, tmp)

        # używamy ogólnego modelu (szybszy, wielojęzyczny)
        result = model_general.transcribe(
            str(tmp_path),
            language=language,
            task=task,
        )

        text = result.get("text", "").strip()
        detected_language = result.get("language", None)
        segments = result.get("segments", [])

        return JSONResponse(
            {
                "filename": file.filename,
                "task": task,
                "requested_language": language,
                "detected_language": detected_language,
                "text": text,
                "segments": [
                    {
                        "start": s["start"],
                        "end": s["end"],
                        "text": s["text"].strip(),
                    }
                    for s in segments
                ],
            }
        )

    finally:
        try:
            if "tmp_path" in locals() and tmp_path.exists():
                tmp_path.unlink()
        except Exception:
            pass



# ========= ENDPOINT 2: OCENA WYMOWY =========

@app.post("/assess_pronunciation")
async def assess_pronunciation(
    file: UploadFile = File(...),
    target_text: str = Form(...),
):
    """
    Ocena wymowy: użytkownik ma przeczytać podane zdanie po angielsku.
    Zwraca:
      - recognized_text  – co usłyszał model
      - lexical_score    – zgodność słów (WER)
      - accent_score     – pewność modelu (proxy dla akcentu / wyraźności)
      - score            – wynik łączny
    """
    try:
        suffix = Path(file.filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = Path(tmp.name)
            shutil.copyfileobj(file.file, tmp)

        # lepszy model EN, bez tłumaczenia
        result = model_pron.transcribe(
            str(tmp_path),
            language=None,         # auto-detect, ale model jest EN
            task="transcribe",
        )

        recognized_text = result.get("text", "").strip()
        detected_lang = result.get("language", None)
        segments = result.get("segments", []) or []

        # jeśli nie EN → nie oceniamy merytorycznie
        if detected_lang != "en":
            return JSONResponse({
                "target_text": target_text,
                "recognized_text": recognized_text,
                "score": 0.0,
                "score_percent": 0,
                "lexical_score": 0.0,
                "lexical_score_percent": 0,
                "accent_score": 0.0,
                "accent_score_percent": 0,
                "feedback": "Speech was not recognized as English.",
                "ref_words": [],
                "hyp_words": [],
                "detected_language": detected_lang,
            })

        # --- zgodność słów (to co mieliśmy wcześniej) ---
        ref_words = _normalize_english(target_text)
        hyp_words = _normalize_english(recognized_text)

        if not hyp_words:
            return JSONResponse({
                "target_text": target_text,
                "recognized_text": recognized_text,
                "score": 0.0,
                "score_percent": 0,
                "lexical_score": 0.0,
                "lexical_score_percent": 0,
                "accent_score": 0.0,
                "accent_score_percent": 0,
                "feedback": "No English words detected.",
                "ref_words": ref_words,
                "hyp_words": [],
                "detected_language": detected_lang,
            })

        lexical_score = _wer_score(ref_words, hyp_words)  # 0..1

        # jeśli zdanie kompletnie inne → komunikat o innym zdaniu
        if lexical_score < 0.3:
            return JSONResponse({
                "target_text": target_text,
                "recognized_text": recognized_text,
                "score": 0.0,
                "score_percent": 0,
                "lexical_score": lexical_score,
                "lexical_score_percent": round(lexical_score * 100),
                "accent_score": 0.0,
                "accent_score_percent": 0,
                "feedback": "It seems you read a different sentence than the one provided.",
                "ref_words": ref_words,
                "hyp_words": hyp_words,
                "detected_language": detected_lang,
            })

        # --- „accent score” na podstawie avg_logprob ---
        # typowo avg_logprob jest w okolicach [-1.5, 0]; im bliżej 0, tym lepiej
        if segments:
            raw_log = sum(s.get("avg_logprob", -5.0) for s in segments) / len(segments)
        else:
            raw_log = -5.0

        # przeskaluj do [0,1]: raw_log=-1.5 → 0, raw_log=0 → 1
        accent_score = (raw_log + 1.5) / 1.5
        accent_score = max(0.0, min(1.0, accent_score))

        # --- wynik łączny: możesz zmienić wagi jak chcesz ---
        total_score = 0.7 * lexical_score + 0.3 * accent_score

        lexical_pct = round(lexical_score * 100)
        accent_pct = round(accent_score * 100)
        total_pct = round(total_score * 100)

        # feedback zależny od obu składowych
        if lexical_score >= 0.8 and accent_score < 0.5:
            feedback = (
                "Words are mostly correct, but pronunciation/accent may be unclear."
            )
        else:
            feedback = _feedback_from_score(total_score)

        return JSONResponse(
            {
                "target_text": target_text,
                "recognized_text": recognized_text,
                "score": total_score,
                "score_percent": total_pct,
                "lexical_score": lexical_score,
                "lexical_score_percent": lexical_pct,
                "accent_score": accent_score,
                "accent_score_percent": accent_pct,
                "feedback": feedback,
                "ref_words": ref_words,
                "hyp_words": hyp_words,
                "detected_language": detected_lang,
                "raw_avg_logprob": raw_log,
            }
        )

    finally:
        try:
            if "tmp_path" in locals() and tmp_path.exists():
                tmp_path.unlink()
        except Exception:
            pass

