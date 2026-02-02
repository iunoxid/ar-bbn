import { useMemo, useRef, useState } from "react";

const DEFAULT_TOLERANCE = 100;

const joinUrl = (base, path) => {
  if (!path) return "";
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return base.slice(0, -1) + path;
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return base + path;
};

const formatNumber = (value) =>
  new Intl.NumberFormat("id-ID").format(Number(value || 0));

const formatDigits = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return formatNumber(digits);
};

const normalizeTargets = (value) => {
  return String(value || "")
    .split(",")
    .map((part) => part.replace(/\D/g, ""))
    .filter((part) => part.length > 0)
    .join(",");
};

const positionAfterDigits = (value, digitsCount) => {
  if (digitsCount <= 0) return 0;
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (/\d/.test(value[i])) {
      count += 1;
      if (count === digitsCount) {
        return i + 1;
      }
    }
  }
  return value.length;
};

const formatTargetsDisplay = (rawValue) => {
  const raw = String(rawValue || "");
  const hasTrailingComma = /,\s*$/.test(raw);
  const parts = raw.split(",");
  const formattedParts = parts.map((part) => formatDigits(part));

  let formatted = formattedParts.join(", ");
  if (hasTrailingComma) {
    if (formatted && !formatted.endsWith(", ")) {
      formatted += ", ";
    } else if (!formatted) {
      formatted = ", ";
    }
  }
  return formatted.trimStart();
};

const countDigits = (value) => (value.match(/\d/g) || []).length;

const insertCommaAtDigits = (rawValue, digitsBefore) => {
  const cleaned = String(rawValue || "").replace(/[^\d,]/g, "");
  if (digitsBefore <= 0) {
    return cleaned.startsWith(",") ? cleaned : `,${cleaned}`;
  }
  let count = 0;
  for (let i = 0; i < cleaned.length; i += 1) {
    if (/\d/.test(cleaned[i])) {
      count += 1;
      if (count === digitsBefore) {
        if (cleaned[i + 1] === ",") {
          return cleaned;
        }
        return `${cleaned.slice(0, i + 1)},${cleaned.slice(i + 1)}`;
      }
    }
  }
  return cleaned.endsWith(",") ? cleaned : `${cleaned},`;
};

const removeCommaAtIndex = (rawValue, commaIndex) => {
  if (commaIndex < 0) return rawValue;
  let count = 0;
  let out = "";
  for (let i = 0; i < rawValue.length; i += 1) {
    const ch = rawValue[i];
    if (ch === ",") {
      if (count === commaIndex) {
        count += 1;
        continue;
      }
      count += 1;
    }
    out += ch;
  }
  return out;
};

const removeDigitFromRaw = (rawValue, displayValue, cursorIndex, direction) => {
  const tokens = String(rawValue || "").split(",");
  const displayTokens = String(displayValue || "").split(",");
  const digitsPerToken = displayTokens.map((part) =>
    part.replace(/\D/g, "")
  );

  const before = String(displayValue || "").slice(0, cursorIndex);
  let tokenIndex = (before.match(/,/g) || []).length;
  let digitsBefore = countDigits(before.split(",").pop() || "");

  if (direction === "back") {
    if (digitsBefore > 0) {
      const token = digitsPerToken[tokenIndex] || "";
      digitsPerToken[tokenIndex] =
        token.slice(0, digitsBefore - 1) + token.slice(digitsBefore);
    } else if (tokenIndex > 0) {
      tokenIndex -= 1;
      const token = digitsPerToken[tokenIndex] || "";
      if (token.length > 0) {
        digitsPerToken[tokenIndex] = token.slice(0, -1);
      }
    }
  } else {
    const token = digitsPerToken[tokenIndex] || "";
    if (digitsBefore < token.length) {
      digitsPerToken[tokenIndex] =
        token.slice(0, digitsBefore) + token.slice(digitsBefore + 1);
    } else if (tokenIndex + 1 < digitsPerToken.length) {
      const next = digitsPerToken[tokenIndex + 1] || "";
      if (next.length > 0) {
        digitsPerToken[tokenIndex + 1] = next.slice(1);
      }
    }
  }

  const hasTrailingComma = /,\s*$/.test(displayValue || "");
  let rebuilt = digitsPerToken.join(",");
  if (hasTrailingComma && !rebuilt.endsWith(",")) {
    rebuilt += ",";
  }
  return rebuilt;
};

export default function App() {
  const [file, setFile] = useState(null);
  const [targetsRaw, setTargetsRaw] = useState("");
  const [tolerance, setTolerance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const targetsInputRef = useRef(null);

  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";

  const canSubmit = useMemo(() => {
    const normalized = normalizeTargets(targetsRaw);
    return file && normalized && Number(normalized.split(",")[0]) > 0;
  }, [file, targetsRaw]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    const normalizedTargets = normalizeTargets(targetsRaw);
    if (!file || !normalizedTargets) {
      setError("Silakan pilih file dan isi target nominal.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("targets", normalizedTargets);
    const normalizedTolerance = tolerance
      ? tolerance.replace(/\D/g, "")
      : "";
    if (normalizedTolerance) {
      formData.append("tolerance", normalizedTolerance);
    } else {
      formData.append("tolerance", String(DEFAULT_TOLERANCE));
    }

    setLoading(true);
    try {
      const response = await fetch(joinUrl(apiBase, "/api/process"), {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Request failed");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
      setFile(null);
      setTargetsRaw("");
      setTolerance("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="page">
      <div className="background" />
      <main className="container">
        <header className="hero">
          <p className="badge">Invoice Matcher</p>
          <h1>Temukan kombinasi invoice sesuai nominal target.</h1>
          <p className="subtitle">
            Unggah Excel, tentukan target, dan hasilkan file kombinasi siap
            unduh.
          </p>
        </header>

        <section className="card">
          <form className="form" onSubmit={handleSubmit}>
            <fieldset className="fieldset" disabled={loading}>
            <label className="field">
              <span>File Excel (.xlsx)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  if (selected) {
                    setFile(selected);
                  }
                }}
              />
              {file ? (
                <span className="file-name">Selected: {file.name}</span>
              ) : null}
            </label>

            <label className="field">
              <span>Target nominal (pisahkan dengan koma)</span>
              <input
                ref={targetsInputRef}
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 1.000.000, 2.000.000"
                value={formatTargetsDisplay(targetsRaw)}
                onKeyDown={(event) => {
                  if (!targetsInputRef.current) return;
                  if (event.defaultPrevented) return;
                  const key = event.key;
                  if (key === ",") {
                    event.preventDefault();
                    const displayValue = event.currentTarget.value;
                    const cursorIndex = event.currentTarget.selectionStart ?? 0;
                    const digitsBefore = countDigits(
                      displayValue.slice(0, cursorIndex)
                    );
                    const newRaw = insertCommaAtDigits(targetsRaw, digitsBefore);
                    const newDisplay = formatTargetsDisplay(newRaw);
                    const baseCursor = positionAfterDigits(
                      newDisplay,
                      digitsBefore
                    );
                    let commaIndex = newDisplay.indexOf(",", baseCursor);
                    if (commaIndex === -1 && baseCursor > 0) {
                      commaIndex = newDisplay.indexOf(",", baseCursor - 1);
                    }
                    const newCursor =
                      commaIndex >= 0
                        ? Math.min(commaIndex + 2, newDisplay.length)
                        : baseCursor;
                    setTargetsRaw(newRaw);
                    requestAnimationFrame(() => {
                      targetsInputRef.current?.setSelectionRange(
                        newCursor,
                        newCursor
                      );
                    });
                    return;
                  }
                  if (key !== "Backspace" && key !== "Delete") return;
                  const start = event.currentTarget.selectionStart ?? 0;
                  const end = event.currentTarget.selectionEnd ?? 0;
                  if (start !== end) return;
                  const displayValue = event.currentTarget.value;
                  const charToCheck =
                    key === "Backspace"
                      ? displayValue[start - 1]
                      : displayValue[start];
                  if (!charToCheck || /\d/.test(charToCheck)) {
                    return;
                  }
                  const isSpace = charToCheck === " ";
                  const isComma = charToCheck === ",";
                  if (isSpace || isComma) {
                    event.preventDefault();
                    const commaPos =
                      key === "Backspace"
                        ? isSpace
                          ? start - 2
                          : start - 1
                        : isSpace
                          ? start - 1
                          : start;
                    if (commaPos >= 0) {
                      const commasBefore = (displayValue
                        .slice(0, commaPos)
                        .match(/,/g) || []).length;
                      const newRaw = removeCommaAtIndex(targetsRaw, commasBefore);
                      const digitsBefore = countDigits(
                        displayValue.slice(0, commaPos)
                      );
                      const newDisplay = formatTargetsDisplay(newRaw);
                      const newCursor = positionAfterDigits(
                        newDisplay,
                        digitsBefore
                      );
                      setTargetsRaw(newRaw);
                      requestAnimationFrame(() => {
                        targetsInputRef.current?.setSelectionRange(
                          newCursor,
                          newCursor
                        );
                      });
                    }
                    return;
                  }
                  event.preventDefault();
                  const newRaw = removeDigitFromRaw(
                    targetsRaw,
                    displayValue,
                    start,
                    key === "Backspace" ? "back" : "forward"
                  );
                  const digitsBefore = countDigits(
                    displayValue.slice(0, start)
                  );
                  const newDisplay = formatTargetsDisplay(newRaw);
                  const newCursorDigits =
                    key === "Backspace"
                      ? Math.max(digitsBefore - 1, 0)
                      : digitsBefore;
                  const newCursor = positionAfterDigits(
                    newDisplay,
                    newCursorDigits
                  );
                  let adjustedCursor = newCursor;
                  if (newDisplay[adjustedCursor] === ",") {
                    adjustedCursor = Math.min(adjustedCursor + 2, newDisplay.length);
                  }
                  setTargetsRaw(newRaw);
                  requestAnimationFrame(() => {
                    targetsInputRef.current?.setSelectionRange(
                      adjustedCursor,
                      adjustedCursor
                    );
                  });
                }}
                onChange={(event) => {
                  const rawValue = event.target.value;
                  const cursorIndex = event.target.selectionStart ?? 0;
                  const digitsBefore = countDigits(
                    rawValue.slice(0, cursorIndex)
                  );
                  const cleaned = rawValue.replace(/[^\d,]/g, "");
                  const newDisplay = formatTargetsDisplay(cleaned);
                  const newCursor = positionAfterDigits(
                    newDisplay,
                    digitsBefore
                  );
                  let adjustedCursor = newCursor;
                  if (newDisplay[adjustedCursor] === ",") {
                    adjustedCursor = Math.min(adjustedCursor + 2, newDisplay.length);
                  }
                  setTargetsRaw(cleaned);
                  requestAnimationFrame(() => {
                    targetsInputRef.current?.setSelectionRange(
                      adjustedCursor,
                      adjustedCursor
                    );
                  });
                }}
              />
            </label>

            <label className="field">
              <span>Toleransi (opsional)</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder={`Default: ${formatNumber(DEFAULT_TOLERANCE)}`}
                value={tolerance}
                onChange={(event) => setTolerance(formatDigits(event.target.value))}
              />
            </label>

            <div className="actions">
              <button type="submit" disabled={!canSubmit || loading}>
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Memproses...
                  </>
                ) : (
                  "Proses file"
                )}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!file || loading}
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                Hapus file
              </button>
            </div>
            </fieldset>
          </form>

          {error ? <p className="error">{error}</p> : null}

          {result ? (
            <div className="result">
              {result.found ? (
                <>
                  <p>
                    Ditemukan <strong>{result.total_rows}</strong> baris cocok.
                  </p>
                  <a
                    className="download"
                    href={joinUrl(apiBase, result.download_url)}
                  >
                    Unduh file hasil
                  </a>
                </>
              ) : (
                <p>Tidak ada kombinasi yang cocok.</p>
              )}
            </div>
          ) : null}
        </section>

        <section className="note">
          <h2>Cara pakai</h2>
          <ol className="steps">
            <li>Upload file Excel.</li>
            <li>
              Isi target (bisa lebih dari satu, pisahkan dengan koma).
            </li>
            <li>Isi toleransi (opsional).</li>
            <li>Klik proses, lalu download hasilnya.</li>
          </ol>
        </section>
        <footer className="footer">
          <div>CISAN AR · Internal System</div>
          <div>Central Integrated Services &amp; Application Network</div>
        </footer>
      </main>
    </div>
  );
}
