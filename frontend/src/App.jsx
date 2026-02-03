import { useMemo, useRef, useState } from "react";

const DEFAULT_TOLERANCE = 500;

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
  const [targetInput, setTargetInput] = useState("");
  const [targetTokens, setTargetTokens] = useState([]);
  const [tolerance, setTolerance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const targetsInputRef = useRef(null);

  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canSubmit = useMemo(() => {
    const normalized = normalizeTargets(targetsRaw);
    return file && normalized && Number(normalized.split(",")[0]) > 0;
  }, [file, targetsRaw]);

  const commitTargets = (rawValue) => {
    const parts = String(rawValue || "")
      .split(",")
      .map((part) => part.replace(/\D/g, ""))
      .filter((part) => part.length > 0);
    if (parts.length === 0) return;
    const newTokens = parts.map((value) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      value
    }));
    setTargetTokens((prev) => [...prev, ...newTokens]);
    setTargetsRaw((prev) => {
      const prefix = prev ? `${prev},` : "";
      return `${prefix}${parts.join(",")}`;
    });
    setTargetInput("");
  };

  const removeTargetById = (id) => {
    setTargetTokens((prev) => {
      const next = prev.filter((token) => token.id !== id);
      setTargetsRaw(next.map((token) => token.value).join(","));
      return next;
    });
  };

  const removeLastTarget = () => {
    setTargetTokens((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      setTargetsRaw(next.map((token) => token.value).join(","));
      return next;
    });
  };

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
      setTargetInput("");
      setTargetTokens([]);
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
            <div className="field">
              <label className="label" htmlFor="file-input">
                File Excel (.xlsx)
              </label>
              <span className="helper">
                Unggah file invoice dalam format .xlsx.
              </span>
              {file ? (
                <div
                  className="file-status"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="file-status__left">
                    <div className="file-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="img">
                        <path
                          d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 1.5V9h4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8 13h8M8 16h8M8 19h5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <span className="file-status__name">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    className="file-remove"
                    aria-label="Hapus file"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      clearFile();
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="file-input">
                  <div className="file-input__inner">
                    <div className="file-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="img">
                        <path
                          d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 1.5V9h4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8 13h8M8 16h8M8 19h5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="file-text">
                      <span className="file-title">Pilih file Excel</span>
                      <span className="file-subtitle">Format .xlsx, maksimal 10MB</span>
                    </div>
                  </div>
                  <input
                    id="file-input"
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
                </div>
              )}
            </div>

            <label className="field">
              <span className="label">Target nominal</span>
              <span className="helper">Pisahkan lebih dari satu target dengan koma.</span>
              <div
                className="target-input"
                onClick={() => targetsInputRef.current?.focus()}
              >
                {targetTokens.map((token) => (
                  <span
                    className="target-chip"
                    key={token.id}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      targetsInputRef.current?.focus();
                    }}
                  >
                    {formatDigits(token.value)}
                      <button
                        type="button"
                        className="target-remove"
                        aria-label="Hapus nominal"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeTargetById(token.id);
                        }}
                      >
                        ✕
                      </button>
                    </span>
                ))}
                <input
                  ref={targetsInputRef}
                  className="target-input__field"
                  type="text"
                  inputMode="numeric"
                  placeholder={
                    targetTokens.length === 0 && !targetInput
                      ? "Contoh: 1.000.000, 2.000.000"
                      : ""
                  }
                  value={formatDigits(targetInput)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      commitTargets(targetInput);
                      return;
                    }
                    if (event.key === "Backspace" && !targetInput) {
                      event.preventDefault();
                      removeLastTarget();
                    }
                  }}
                  onChange={(event) => {
                    const cleaned = event.target.value.replace(/\D/g, "");
                    setTargetInput(cleaned);
                  }}
                  onPaste={(event) => {
                    const text = event.clipboardData.getData("text");
                    if (text.includes(",")) {
                      event.preventDefault();
                      commitTargets(text);
                      return;
                    }
                    const cleaned = text.replace(/\D/g, "");
                    setTargetInput(cleaned);
                  }}
                />
              </div>
            </label>

            <label className="field">
              <span className="label">Toleransi (opsional)</span>
              <span className="helper">Default {formatNumber(DEFAULT_TOLERANCE)}.</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder={`Default: ${formatNumber(DEFAULT_TOLERANCE)}`}
                value={tolerance}
                onChange={(event) => setTolerance(formatDigits(event.target.value))}
              />
            </label>

            <div className="actions">
              <button className="primary" type="submit" disabled={!canSubmit || loading}>
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Memproses...
                  </>
                ) : (
                  "Proses file"
                )}
              </button>
            </div>
            </fieldset>
          </form>

          {error ? <p className="error">{error}</p> : null}

          {result ? (
            <div className="result-card">
              {result.found ? (
                <div className="result-row">
                  <div className="result-status">
                    <span className="result-label">Ditemukan</span>
                    <strong className="result-count">{result.total_rows}</strong>
                    <span className="result-label">baris cocok.</span>
                  </div>
                  <a
                    className="download"
                    href={joinUrl(apiBase, result.download_url)}
                  >
                    <span className="download-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="img">
                        <path
                          d="M12 4v10m0 0l4-4m-4 4l-4-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M5 20h14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    Unduh file hasil
                  </a>
                </div>
              ) : (
                <p className="result-empty">Tidak ada kombinasi yang cocok.</p>
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
