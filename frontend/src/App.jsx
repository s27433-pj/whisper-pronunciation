import { useState, useRef } from "react";
import "./App.css";

function App() {
  // ======= STAN =======
  const [pronFile, setPronFile] = useState(null);
  const [pronSentence, setPronSentence] = useState(
    "This is a sample English sentence."
  );
  const [pronResult, setPronResult] = useState(null);
  const [pronLoading, setPronLoading] = useState(false);
  const [pronError, setPronError] = useState("");
  const pronFileInputRef = useRef(null);

  // Mikrofon
  const [pronIsRecording, setPronIsRecording] = useState(false);
  const [pronRecordInfo, setPronRecordInfo] = useState("");
  const pronMediaRecorderRef = useRef(null);
  const pronChunksRef = useRef([]);
  const pronStreamRef = useRef(null);

  // ======= HANDLERY =======

  const handlePronFileChange = (e) => {
    const f = e.target.files[0] || null;
    setPronFile(f);
    setPronRecordInfo(f ? `Wybrano plik: ${f.name}` : "");
  };

  const resetPronForm = () => {
    setPronFile(null);
    setPronSentence("A filing case is now hard to buy.");
    setPronResult(null);
    setPronError("");
    setPronRecordInfo("");
    setPronIsRecording(false);
    pronChunksRef.current = [];
    if (pronFileInputRef.current) pronFileInputRef.current.value = "";
  };

  const startPronRecording = async () => {
    try {
      setPronError("");
      setPronResult(null);
      setPronRecordInfo("Oczekiwanie na mikrofon...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      pronStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      pronMediaRecorderRef.current = mediaRecorder;
      pronChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) pronChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(pronChunksRef.current, { type: "audio/webm" });
        const recordedFile = new File([blob], "pron_recording.webm", {
          type: "audio/webm",
        });
        setPronFile(recordedFile);
        setPronRecordInfo(
          `Nagrano audio (${(recordedFile.size / 1024).toFixed(1)} kB)`
        );

        if (pronStreamRef.current) {
          pronStreamRef.current.getTracks().forEach((t) => t.stop());
          pronStreamRef.current = null;
        }
      };

      mediaRecorder.start();
      setPronIsRecording(true);
      setPronRecordInfo("Nagrywam... Kliknij STOP kiedy skończysz.");
    } catch (err) {
      console.error(err);
      setPronError("Nie udało się uzyskać mikrofonu.");
      setPronRecordInfo("");
    }
  };

  const stopPronRecording = () => {
    if (pronMediaRecorderRef.current && pronIsRecording) {
      pronMediaRecorderRef.current.stop();
      setPronIsRecording(false);
      setPronRecordInfo("Nagranie zakończone.");
    }
  };

  const handlePronSubmit = async (e) => {
    e.preventDefault();
    setPronError("");
    setPronResult(null);

    if (!pronFile) {
      setPronError("Nagraj lub wybierz plik audio.");
      return;
    }
    if (!pronSentence.trim()) {
      setPronError("Wpisz zdanie.");
      return;
    }

    const formData = new FormData();
    formData.append("file", pronFile);
    formData.append("target_text", pronSentence);

    try {
      setPronLoading(true);

      const res = await fetch("http://127.0.0.1:8000/assess_pronunciation", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Błąd API: ${res.status}`);

      const data = await res.json();
      setPronResult(data);
      setPronRecordInfo("Gotowe! Wyniki poniżej 👇");
    } catch (err) {
      console.error(err);
      setPronError(err.message || "Coś poszło nie tak.");
    } finally {
      setPronLoading(false);
    }
  };

  // ======= POMOCNICZE =======

  const pct = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // mapowanie: >=80% traktujemy jako 100%
  const humanizeScore = (raw) => {
    if (raw == null || Number.isNaN(raw)) return 0;
    if (raw >= 80) return 100;
    return Math.round(raw);
  };

  // surowe i „zhumanizowane” wyniki – liczone POZA JSX
  const lexicalRaw = pronResult ? pct(pronResult.lexical_score_percent) : 0;
  const accentRaw = pronResult ? pct(pronResult.accent_score_percent) : 0;
  const totalRaw = pronResult ? pct(pronResult.score_percent) : 0;

  const accentDisplay = humanizeScore(accentRaw);
  const totalDisplay = humanizeScore(totalRaw);

  // ======= RENDER =======
  return (
    <div className="app-container">
      <div className="app-card">
        <h1 className="app-title">
          Ocena wymowy po angielsku <span role="img" aria-label="mic">🎙️</span>
        </h1>

        <p className="app-subtitle">
          Wpisz zdanie → nagraj głos lub wrzuć plik → zobacz ocenę słów i akcentu.
        </p>

        {/* ================= SEKCJA OCENY WYMOWY ================= */}
        <form onSubmit={handlePronSubmit} style={{ marginBottom: "1.5rem" }}>
          <div className="form-group">
            <label>Zdanie po angielsku:</label>
            <textarea
              value={pronSentence}
              onChange={(e) => setPronSentence(e.target.value)}
              className="result-textarea"
              style={{ minHeight: "80px" }}
            />
          </div>

          {/* Nagrywanie mikrofonem */}
          <div className="form-group">
            <label>Nagrywanie mikrofonem:</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={startPronRecording}
                disabled={pronIsRecording || pronLoading}
                className="btn-submit"
                style={{
                  background: pronIsRecording ? "#4b5563" : "#16a34a",
                }}
              >
                Start
              </button>
              <button
                type="button"
                onClick={stopPronRecording}
                disabled={!pronIsRecording || pronLoading}
                className="btn-submit"
                style={{
                  background: pronIsRecording ? "#b91c1c" : "#4b5563",
                }}
              >
                Stop
              </button>
            </div>

            {pronRecordInfo && (
              <div style={{ marginTop: "0.4rem", color: "#9ca3af" }}>
                {pronRecordInfo}
              </div>
            )}
          </div>

          {/* Upload pliku audio */}
          <div className="form-group">
            <label>Lub wybierz plik audio:</label>
            <input
              type="file"
              accept="audio/*"
              ref={pronFileInputRef}
              onChange={handlePronFileChange}
              className="input-file"
              disabled={pronLoading || pronIsRecording}
            />
          </div>

          {pronError && <div className="error-box">{pronError}</div>}

          <button
            type="submit"
            disabled={pronLoading || pronIsRecording}
            className="btn-submit"
          >
            {pronLoading ? "Analizuję..." : "Oceń wymowę"}
          </button>

          <button
            type="button"
            onClick={resetPronForm}
            style={{
              marginLeft: "0.5rem",
              padding: "0.6rem 1.2rem",
              borderRadius: "999px",
              border: "1px solid #4b5563",
              background: "transparent",
              color: "#e5e7eb",
              fontWeight: 500,
            }}
          >
            Wyczyść wszystko
          </button>
        </form>

        {/* ================= WYNIK ================= */}
        {pronResult && (
          <div className="result-box">
            <h3 className="result-title">Wyniki analizy</h3>

            <p className="result-meta">
              Zdanie docelowe:
              <br />
              <b>{pronResult.target_text}</b>
            </p>

            <p className="result-meta">
              Rozpoznany tekst:
              <br />
              <b>{pronResult.recognized_text}</b>
            </p>

            <p className="result-meta">
              Język rozpoznany:{" "}
              <b>{pronResult.detected_language || "nieznany"}</b>
            </p>

            {/* Teksty z procentami (słowa raw, akcent i łączny zhumanizowane) */}
            <p className="result-meta" style={{ marginTop: "0.8rem" }}>
              Słowa: <b>{lexicalRaw}%</b> | Akcent:{" "}
              <b>{accentDisplay}%</b> | Łącznie:{" "}
              <b>{totalDisplay}%</b>
            </p>

            {/* Paski wyników */}
            <div style={{ marginTop: "0.8rem" }}>
              {[
                { label: "Słowa", value: lexicalRaw },
                { label: "Akcent", value: accentDisplay },
                { label: "Łącznie", value: totalDisplay },
              ].map((item) => (
                <div key={item.label} style={{ marginBottom: "0.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      marginBottom: "0.1rem",
                      color: "#9ca3af",
                    }}
                  >
                    <span>{item.label}</span>
                    <span>{item.value}%</span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      borderRadius: "999px",
                      background: "#111827",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, item.value)
                        )}%`,
                        height: "100%",
                        background: "#2563eb",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="result-meta" style={{ marginTop: "0.8rem" }}>
              Feedback:
              <br />
              <b>{pronResult.feedback}</b>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
