import { useState, useEffect, useRef, useMemo } from "react";

// ── Keyframes injected once ──
const STYLE_ID = "prov-workbook-keyframes";
const ensureKeyframes = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes pw-slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pw-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pw-checkIn {
      0%   { opacity: 0; transform: scale(0.5); }
      60%  { transform: scale(1.15); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes pw-progressFill {
      from { width: 0; }
    }
    @keyframes pw-celebratePulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.75; }
    }
  `;
  document.head.appendChild(style);
};

// ── Resource type → emoji mapping ──
const TYPE_ICONS = {
  network: "🌐",
  compute: "💻",
  serverless: "⚡",
  database: "🗄️",
  storage: "📦",
  apigateway: "🔗",
  cache: "💨",
  container: "🐳",
  queue: "📬",
  cdn: "🌍",
  security: "🔒",
  secrets: "🔑",
  monitoring: "📊",
  events: "⚡",
};
const getTypeIcon = (type) => TYPE_ICONS[type?.toLowerCase()] || "📦";

// ── Shared design tokens ──
const T = {
  surface: "#0f1a14",
  surfaceAlt: "#132119",
  border: "rgba(52, 211, 153, 0.12)",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  accent: "#34d399",
  accentDim: "#059669",
  danger: "#ef4444",
  dangerDim: "#991b1b",
  warn: "#fbbf24",
  radius: 12,
  radiusSm: 8,
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// ── Status config ──
const STATUS_META = {
  pending: {
    icon: "⬜",
    label: "Pending",
    bg: "transparent",
    color: T.textDim,
  },
  creating: {
    icon: null,
    label: "Creating",
    bg: "rgba(251, 191, 36, 0.06)",
    color: T.warn,
  },
  created: {
    icon: "✅",
    label: "Created",
    bg: "rgba(52, 211, 153, 0.05)",
    color: T.accent,
  },
  failed: {
    icon: "❌",
    label: "Failed",
    bg: "rgba(239, 68, 68, 0.05)",
    color: T.danger,
  },
  skipped: {
    icon: "⏭️",
    label: "Skipped",
    bg: "rgba(148, 163, 184, 0.04)",
    color: T.textDim,
  },
};

// ── Elapsed time formatter ──
const formatElapsed = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// ════════════════════════════════════════════════════════════
//  ProvisioningWorkbook
// ════════════════════════════════════════════════════════════

const ProvisioningWorkbook = ({
  workbook = [],
  onRetry,
  planStatus = "executing",
}) => {
  ensureKeyframes();

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // Timer — tick every second while executing
  useEffect(() => {
    if (planStatus === "executing") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [planStatus]);

  // Derived counts
  const counts = useMemo(() => {
    let done = 0,
      failed = 0,
      creating = 0,
      pending = 0,
      skipped = 0;
    workbook.forEach((r) => {
      if (r.status === "created") done++;
      else if (r.status === "failed") failed++;
      else if (r.status === "creating") creating++;
      else if (r.status === "skipped") skipped++;
      else pending++;
    });
    return { done, failed, creating, pending, skipped, total: workbook.length };
  }, [workbook]);

  const progressPercent =
    counts.total > 0
      ? Math.round(((counts.done + counts.skipped) / counts.total) * 100)
      : 0;
  const allDone =
    counts.done + counts.skipped + counts.failed === counts.total &&
    counts.total > 0;

  const cardStyle = {
    fontFamily: T.font,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    overflow: "hidden",
    animation: "pw-slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
    marginTop: 8,
    marginBottom: 8,
    maxWidth: 680,
    width: "100%",
  };

  return (
    <div style={cardStyle}>
      {/* ── Header ── */}
      <div
        style={{
          padding: "16px 20px 14px",
          borderBottom: `1px solid ${T.border}`,
          background: T.surfaceAlt,
        }}
      >
        {/* Celebration header */}
        {allDone && counts.failed === 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              padding: "8px 12px",
              background: "rgba(52, 211, 153, 0.08)",
              border: `1px solid rgba(52, 211, 153, 0.18)`,
              borderRadius: T.radiusSm,
              animation: "pw-celebratePulse 2s ease-in-out 1",
            }}
          >
            <span style={{ fontSize: 18 }}>🎉</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>
              All resources provisioned!
            </span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: T.accent,
              }}
            >
              Provisioning Workbook
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Elapsed timer */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.textDim}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.textMuted,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatElapsed(elapsed)}
              </span>
            </div>
            {/* Fraction */}
            <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>
              {counts.done + counts.skipped}/{counts.total}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: 10,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              borderRadius: 2,
              background:
                counts.failed > 0
                  ? `linear-gradient(90deg, ${T.accent} 0%, ${T.danger} 100%)`
                  : T.accent,
              transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
              animation: "pw-progressFill 0.6s ease-out",
            }}
          />
        </div>
      </div>

      {/* ── Timeline / stepper ── */}
      <div style={{ padding: "4px 0" }}>
        {workbook.map((item, idx) => {
          const meta = STATUS_META[item.status] || STATUS_META.pending;
          const isLast = idx === workbook.length - 1;

          return (
            <div key={item.order} style={{ position: "relative" }}>
              {/* Row content */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 20px",
                  background: meta.bg,
                  transition: "background 0.3s ease",
                }}
              >
                {/* Timeline column */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: 24,
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  {/* Status icon */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 1,
                    }}
                  >
                    {item.status === "creating" ? (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          border: `2px solid ${T.warn}`,
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          animation: "pw-spin 0.8s linear infinite",
                        }}
                      />
                    ) : item.status === "created" ? (
                      <span
                        style={{
                          fontSize: 14,
                          animation: "pw-checkIn 0.3s ease both",
                        }}
                      >
                        ✅
                      </span>
                    ) : (
                      <span style={{ fontSize: 14 }}>{meta.icon}</span>
                    )}
                  </div>

                  {/* Vertical connector line */}
                  {!isLast && (
                    <div
                      style={{
                        width: 1,
                        flexGrow: 1,
                        minHeight: 12,
                        background:
                          item.status === "created" || item.status === "skipped"
                            ? "rgba(52, 211, 153, 0.18)"
                            : "rgba(255,255,255,0.06)",
                        transition: "background 0.3s ease",
                      }}
                    />
                  )}
                </div>

                {/* Resource details */}
                <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{ fontSize: 14, lineHeight: 1 }}
                      role="img"
                      aria-label={item.type}
                    >
                      {getTypeIcon(item.type)}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: item.status === "failed" ? T.danger : T.text,
                        transition: "color 0.2s ease",
                      }}
                    >
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: meta.color,
                        background: `${meta.color}14`,
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {/* Resource ID (created) */}
                  {item.status === "created" && item.resource_id && (
                    <div
                      style={{
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: T.textDim,
                          fontFamily: "monospace",
                          background: "rgba(255,255,255,0.04)",
                          padding: "1px 6px",
                          borderRadius: 4,
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {item.resource_id.length > 8
                          ? item.resource_id.slice(0, 8) + "…"
                          : item.resource_id}
                      </span>
                    </div>
                  )}

                  {/* Error + retry (failed) */}
                  {item.status === "failed" && (
                    <div style={{ marginTop: 6 }}>
                      {item.error && (
                        <p
                          style={{
                            fontSize: 11,
                            color: "#fca5a5",
                            margin: "0 0 6px",
                            lineHeight: 1.45,
                            background: "rgba(239, 68, 68, 0.06)",
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid rgba(239, 68, 68, 0.12)",
                          }}
                        >
                          {item.error}
                        </p>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry?.(item.order);
                        }}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#fca5a5",
                          background: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.18)",
                          borderRadius: 6,
                          padding: "4px 12px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(239, 68, 68, 0.15)";
                          e.currentTarget.style.borderColor =
                            "rgba(239, 68, 68, 0.3)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(239, 68, 68, 0.08)";
                          e.currentTarget.style.borderColor =
                            "rgba(239, 68, 68, 0.18)";
                        }}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer summary ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderTop: `1px solid ${T.border}`,
          background: T.surfaceAlt,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {counts.done > 0 && (
            <span style={{ fontSize: 11, color: T.accent, fontWeight: 600 }}>
              ✅ {counts.done} created
            </span>
          )}
          {counts.creating > 0 && (
            <span style={{ fontSize: 11, color: T.warn, fontWeight: 600 }}>
              🔄 {counts.creating} in progress
            </span>
          )}
          {counts.failed > 0 && (
            <span style={{ fontSize: 11, color: T.danger, fontWeight: 600 }}>
              ❌ {counts.failed} failed
            </span>
          )}
          {counts.pending > 0 && (
            <span style={{ fontSize: 11, color: T.textDim, fontWeight: 600 }}>
              ⬜ {counts.pending} pending
            </span>
          )}
          {counts.skipped > 0 && (
            <span style={{ fontSize: 11, color: T.textDim, fontWeight: 600 }}>
              ⏭️ {counts.skipped} skipped
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            color: T.textDim,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {allDone ? "Complete" : "In Progress"}
        </span>
      </div>
    </div>
  );
};

export default ProvisioningWorkbook;
