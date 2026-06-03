import { useState, useMemo, useCallback } from "react";

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
  loadbalancer: "⚖️",
  dns: "🔤",
};

const getTypeIcon = (type) => TYPE_ICONS[type?.toLowerCase()] || "📦";

// ── Type-aware config priority: which fields to show in the summary row ──
const CONFIG_PRIORITY = {
  network: ["vpc_cidr", "vpc_cidr_block", "nat_gateway", "create_nat_gateway", "public_subnet_count", "availability_zones_count", "availability_zones"],
  compute: ["instance_type", "os_image", "ami_id", "instance_count", "storage_size", "root_volume_size_gb"],
  serverless: ["runtime", "memory_size", "memory_size_mb", "timeout", "timeout_seconds", "handler"],
  database: ["engine", "instance_class", "storage_size", "allocated_storage_gb", "multi_az", "service_type"],
  storage: ["bucket_name", "versioning", "versioning_enabled", "encryption", "encryption_type", "access"],
  apigateway: ["api_type", "protocol_type", "auth_type", "authorization_type"],
  cache: ["engine", "node_type", "num_nodes", "num_cache_nodes", "engine_version"],
  container: ["orchestrator", "task_cpu", "cpu", "task_memory", "memory", "desired_count", "container_image"],
  queue: ["service_type", "queue_name", "fifo_queue", "visibility_timeout"],
  cdn: ["origin_type", "origin_domain", "origin_domain_name", "viewer_protocol_policy"],
  security: ["service_type", "enable_guardduty", "s3_protection_enabled"],
  secrets: ["service_type", "secret_name", "rotation_enabled"],
  monitoring: ["service_type", "log_group_name", "retention_in_days"],
  events: ["rule_name", "schedule_expression", "event_bus_name"],
  loadbalancer: ["lb_type", "scheme", "listener_port", "target_port", "health_check_path"],
  dns: ["hosted_zone_name", "record_type", "record_name"],
};

// Keys to hide from the detail panel (noise)
const HIDDEN_KEYS = new Set(["tags", "tags_all", "arn", "id"]);

// ── Pick the most relevant config keys for the summary ──
const summariseConfig = (config, resourceType) => {
  if (!config || typeof config !== "object") return [];
  const keys = Object.keys(config).filter(
    (k) => !HIDDEN_KEYS.has(k) && config[k] !== null && config[k] !== "" && !(Array.isArray(config[k]) && config[k].length === 0),
  );
  const priority = CONFIG_PRIORITY[resourceType?.toLowerCase()] || [];
  const picked = [];

  for (const p of priority) {
    if (keys.includes(p) && config[p] !== null && config[p] !== undefined) {
      picked.push([p, config[p]]);
    }
    if (picked.length >= 4) break;
  }
  // Fill remaining slots with whatever is available
  if (picked.length < 4) {
    for (const k of keys) {
      if (!picked.find(([pk]) => pk === k)) picked.push([k, config[k]]);
      if (picked.length >= 4) break;
    }
  }
  return picked;
};

// ── Format a config key for display ──
const formatKey = (key) =>
  key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// ── Format a config value for display ──
const formatValue = (value) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((v) => typeof v === "string")) return value.join(", ");
    return `${value.length} items`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== null);
    if (entries.length === 0) return "—";
    return `${entries.length} entries`;
  }
  return String(value);
};

// ── Keyframes injected once ──
const STYLE_ID = "impl-plan-card-keyframes";
const ensureKeyframes = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ipc-slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ipc-checkPop {
      0%   { transform: scale(1); }
      40%  { transform: scale(0.85); }
      100% { transform: scale(1); }
    }
    @keyframes ipc-expandIn {
      from { opacity: 0; max-height: 0; }
      to   { opacity: 1; max-height: 800px; }
    }
  `;
  document.head.appendChild(style);
};

// ── Shared inline token values ──
const T = {
  surface: "#0f1a14",
  surfaceAlt: "#132119",
  surfaceExpanded: "#0d1710",
  border: "rgba(52, 211, 153, 0.12)",
  borderHover: "rgba(52, 211, 153, 0.24)",
  borderEdit: "rgba(52, 211, 153, 0.4)",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  accent: "#34d399",
  accentDim: "#059669",
  accentFaint: "rgba(52, 211, 153, 0.06)",
  emerald700: "#047857",
  danger: "#ef4444",
  editBg: "rgba(52, 211, 153, 0.08)",
  radius: 12,
  radiusSm: 8,
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// ════════════════════════════════════════════════════════════
//  Inline Config Editor Row
// ════════════════════════════════════════════════════════════

const ConfigRow = ({ configKey, value, isEditing, onEdit, onValueChange }) => {
  const displayKey = formatKey(configKey);
  const isBool = typeof value === "boolean";
  const isNumber =
    typeof value === "number" ||
    (typeof value === "string" && /^\d+(\.\d+)?$/.test(value));
  const isArray = Array.isArray(value);
  const isObject = typeof value === "object" && !isArray && value !== null;
  const isEditable = !isArray && !isObject;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.4fr 28px",
        gap: 0,
        padding: "5px 16px",
        borderBottom: `1px solid rgba(255,255,255,0.03)`,
        alignItems: "center",
        background: isEditing ? T.editBg : "transparent",
        transition: "background 0.15s ease",
      }}
    >
      {/* Key */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: T.textDim,
          userSelect: "none",
        }}
      >
        {displayKey}
      </span>

      {/* Value */}
      {isEditing && isEditable ? (
        isBool ? (
          <button
            onClick={() => onValueChange(configKey, !value)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: value ? T.accent : T.textMuted,
              background: "transparent",
              border: `1px solid ${T.borderEdit}`,
              borderRadius: 4,
              padding: "2px 10px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            {value ? "✅ Yes" : "❌ No"}
          </button>
        ) : (
          <input
            type={isNumber ? "number" : "text"}
            value={value ?? ""}
            onChange={(e) => {
              let newVal = e.target.value;
              if (isNumber && newVal !== "") newVal = Number(newVal);
              onValueChange(configKey, newVal);
            }}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: T.text,
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${T.borderEdit}`,
              borderRadius: 4,
              padding: "3px 8px",
              outline: "none",
              fontFamily: "monospace",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        )
      ) : (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: T.text,
            fontFamily:
              typeof value === "string" || typeof value === "number"
                ? "monospace"
                : "inherit",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={formatValue(value)}
        >
          {formatValue(value)}
        </span>
      )}

      {/* Edit toggle */}
      {isEditable ? (
        <button
          onClick={() => onEdit(configKey)}
          style={{
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isEditing ? T.accentFaint : "transparent",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            padding: 0,
            opacity: isEditing ? 1 : 0.4,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = isEditing ? "1" : "0.4";
          }}
          title={isEditing ? "Done editing" : "Edit value"}
        >
          {isEditing ? (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.accent}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.textDim}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          )}
        </button>
      ) : (
        <div style={{ width: 22 }} />
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  ImplementationPlanCard
// ════════════════════════════════════════════════════════════

const ImplementationPlanCard = ({
  plan,
  onApprove,
  onModify,
  onConfigChange,
  planStatus = "draft",
}) => {
  ensureKeyframes();

  const resources = plan?.resources ?? [];
  const allOrders = useMemo(() => resources.map((r) => r.order), [resources]);
  const [checkedOrders, setCheckedOrders] = useState(() => new Set(allOrders));
  const [hoveredOrder, setHoveredOrder] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [editingField, setEditingField] = useState(null); // {order, key}
  const [localConfigs, setLocalConfigs] = useState(() => {
    // Clone configs so edits are local until persisted
    const map = {};
    for (const r of resources) {
      map[r.order] = { ...(r.config || {}) };
    }
    return map;
  });

  const isDraft = planStatus === "draft";
  const isLocked =
    planStatus === "approved" ||
    planStatus === "executing" ||
    planStatus === "completed";

  const hasEdits = useMemo(() => {
    for (const r of resources) {
      const original = r.config || {};
      const local = localConfigs[r.order] || {};
      for (const key of Object.keys(local)) {
        if (JSON.stringify(original[key]) !== JSON.stringify(local[key]))
          return true;
      }
    }
    return false;
  }, [resources, localConfigs]);

  const toggleCheck = useCallback(
    (order, e) => {
      if (e) e.stopPropagation();
      if (!isDraft) return;
      setCheckedOrders((prev) => {
        const next = new Set(prev);
        next.has(order) ? next.delete(order) : next.add(order);
        return next;
      });
    },
    [isDraft],
  );

  const toggleAll = useCallback(() => {
    if (!isDraft) return;
    setCheckedOrders((prev) =>
      prev.size === allOrders.length ? new Set() : new Set(allOrders),
    );
  }, [isDraft, allOrders]);

  const toggleExpand = useCallback((order) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.has(order) ? next.delete(order) : next.add(order);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedOrders((prev) =>
      prev.size === allOrders.length ? new Set() : new Set(allOrders),
    );
  }, [allOrders]);

  const handleEditToggle = useCallback(
    (order, key) => {
      if (!isDraft) return;
      setEditingField((prev) => {
        if (prev && prev.order === order && prev.key === key) return null;
        return { order, key };
      });
    },
    [isDraft],
  );

  const handleValueChange = useCallback(
    (order, key, newValue) => {
      setLocalConfigs((prev) => ({
        ...prev,
        [order]: { ...prev[order], [key]: newValue },
      }));
      if (onConfigChange) {
        onConfigChange(order, key, newValue);
      }
    },
    [onConfigChange],
  );

  const handleApprove = () => {
    if (!isDraft || checkedOrders.size === 0) return;
    // Collect all config edits to pass upstream
    const edits = [];
    for (const r of resources) {
      const original = r.config || {};
      const local = localConfigs[r.order] || {};
      const changedFields = {};
      for (const key of Object.keys(local)) {
        if (JSON.stringify(original[key]) !== JSON.stringify(local[key])) {
          changedFields[key] = local[key];
        }
      }
      if (Object.keys(changedFields).length > 0) {
        edits.push({ order: r.order, config: changedFields });
      }
    }
    onApprove?.([...checkedOrders].sort((a, b) => a - b), edits);
  };

  const handleModify = () => {
    onModify?.("");
  };

  // ── Status label ──
  const statusConfig = {
    draft: { label: "Draft", color: T.textMuted },
    approved: { label: "Approved", color: T.accent },
    executing: { label: "Provisioning…", color: "#fbbf24" },
    completed: { label: "Completed", color: T.accent },
  };
  const currentStatus = statusConfig[planStatus] || statusConfig.draft;

  const allExpanded = expandedOrders.size === allOrders.length;

  // ── Outer card ──
  const cardStyle = {
    fontFamily: T.font,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    overflow: "hidden",
    animation: "ipc-slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
    marginTop: 8,
    marginBottom: 8,
    maxWidth: 720,
    width: "100%",
  };

  return (
    <div style={cardStyle}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${T.border}`,
          background: T.surfaceAlt,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: T.accent,
              }}
            >
              Implementation Plan
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: currentStatus.color,
                background: `${currentStatus.color}18`,
                padding: "2px 8px",
                borderRadius: 99,
                letterSpacing: "0.03em",
              }}
            >
              {currentStatus.label}
            </span>
            {hasEdits && isDraft && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#fbbf24",
                  background: "rgba(251, 191, 36, 0.1)",
                  padding: "2px 8px",
                  borderRadius: 99,
                  letterSpacing: "0.03em",
                }}
              >
                Modified
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: T.text,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {plan?.summary || "Untitled Plan"}
          </p>
        </div>

        {plan?.estimated_cost && (
          <div
            style={{
              flexShrink: 0,
              background: "rgba(52, 211, 153, 0.08)",
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              padding: "6px 12px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: T.textMuted,
                display: "block",
                marginBottom: 2,
                fontWeight: 500,
              }}
            >
              Est. Cost
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>
              {plan.estimated_cost}
            </span>
          </div>
        )}
      </div>

      {/* ── Resource list ── */}
      <div style={{ padding: "0" }}>
        {/* Column header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "32px 32px 1fr auto 28px",
            alignItems: "center",
            gap: 0,
            padding: "8px 20px",
            borderBottom: `1px solid ${T.border}`,
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <div style={{ justifySelf: "center" }}>
            <button
              onClick={toggleAll}
              disabled={!isDraft}
              aria-label="Toggle all"
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: `1.5px solid ${checkedOrders.size === allOrders.length ? T.accent : T.textDim}`,
                background:
                  checkedOrders.size === allOrders.length
                    ? T.accent
                    : "transparent",
                cursor: isDraft ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: "all 0.15s ease",
                opacity: isDraft ? 1 : 0.4,
              }}
            >
              {checkedOrders.size === allOrders.length && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={T.surface}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: T.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              justifySelf: "center",
            }}
          >
            #
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: T.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              paddingLeft: 4,
            }}
          >
            Resource
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: T.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              paddingRight: 4,
            }}
          >
            Config
          </span>
          <button
            onClick={expandAll}
            style={{
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              padding: 0,
              opacity: 0.5,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.5";
            }}
            title={allExpanded ? "Collapse all" : "Expand all"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.textDim}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: allExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Resource rows */}
        {resources.map((res, idx) => {
          const isChecked = checkedOrders.has(res.order);
          const isHovered = hoveredOrder === res.order;
          const isExpanded = expandedOrders.has(res.order);
          const localConfig = localConfigs[res.order] || res.config || {};
          const configSummary = summariseConfig(localConfig, res.type);
          const hasDeps = res.depends_on && res.depends_on.length > 0;

          // Get all config entries for the detail panel
          const allConfigEntries = Object.entries(localConfig).filter(
            ([k, v]) =>
              !HIDDEN_KEYS.has(k) &&
              v !== null &&
              v !== undefined &&
              v !== "" &&
              !(Array.isArray(v) && v.length === 0),
          );

          return (
            <div key={res.order}>
              {/* Main row */}
              <div
                onMouseEnter={() => setHoveredOrder(res.order)}
                onMouseLeave={() => setHoveredOrder(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 32px 1fr auto 28px",
                  alignItems: "center",
                  gap: 0,
                  padding: "10px 20px",
                  borderBottom: isExpanded
                    ? "none"
                    : idx < resources.length - 1
                      ? `1px solid ${T.border}`
                      : "none",
                  background: isHovered
                    ? "rgba(52, 211, 153, 0.03)"
                    : "transparent",
                  transition: "background 0.15s ease",
                  cursor: "pointer",
                }}
                onClick={() => toggleExpand(res.order)}
              >
                {/* Checkbox */}
                <div
                  style={{ justifySelf: "center" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCheck(res.order, e);
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `1.5px solid ${isChecked ? T.accent : T.textDim}`,
                      background: isChecked ? T.accent : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                      animation: isChecked ? "ipc-checkPop 0.2s ease" : "none",
                      opacity: isDraft ? 1 : 0.4,
                    }}
                  >
                    {isChecked && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={T.surface}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Order # */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textMuted,
                    fontVariantNumeric: "tabular-nums",
                    justifySelf: "center",
                  }}
                >
                  {res.order}
                </span>

                {/* Name + type + deps + rationale */}
                <div style={{ paddingLeft: 4, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{ fontSize: 15, lineHeight: 1 }}
                      role="img"
                      aria-label={res.type}
                    >
                      {getTypeIcon(res.type)}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: T.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 220,
                      }}
                    >
                      {res.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: T.textDim,
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid rgba(255,255,255,0.06)`,
                        padding: "1px 6px",
                        borderRadius: 4,
                        textTransform: "lowercase",
                      }}
                    >
                      {res.type}
                    </span>
                  </div>

                  {/* Dependency badges + rationale */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {hasDeps &&
                      res.depends_on.map((dep) => (
                        <span
                          key={dep}
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: T.textMuted,
                            background: "rgba(148, 163, 184, 0.08)",
                            border: "1px solid rgba(148, 163, 184, 0.12)",
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          depends on #{dep}
                        </span>
                      ))}
                    {res.rationale && (
                      <span
                        title={res.rationale}
                        style={{
                          fontSize: 11,
                          color: T.textDim,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 260,
                          fontStyle: "italic",
                        }}
                      >
                        {res.rationale}
                      </span>
                    )}
                  </div>
                </div>

                {/* Config summary */}
                <div
                  style={{
                    paddingRight: 4,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 2,
                  }}
                >
                  {configSummary.map(([k, v]) => (
                    <span
                      key={k}
                      style={{
                        fontSize: 11,
                        color: T.textMuted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ color: T.textDim, fontWeight: 500 }}>
                        {formatKey(k)}:
                      </span>{" "}
                      <span style={{ fontWeight: 600, color: T.text }}>
                        {formatValue(v)}
                      </span>
                    </span>
                  ))}
                </div>

                {/* Expand chevron */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={T.textDim}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isExpanded
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* ── Expanded Detail Panel ── */}
              {isExpanded && (
                <div
                  style={{
                    background: T.surfaceExpanded,
                    borderBottom:
                      idx < resources.length - 1
                        ? `1px solid ${T.border}`
                        : "none",
                    animation:
                      "ipc-expandIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
                    overflow: "hidden",
                  }}
                >
                  {/* Section header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 16px 4px",
                      borderTop: `1px solid ${T.border}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: T.accent,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Configuration Details — {allConfigEntries.length} fields
                    </span>
                    {isDraft && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 500,
                          color: T.textDim,
                          fontStyle: "italic",
                        }}
                      >
                        Click ✏️ to edit
                      </span>
                    )}
                  </div>

                  {/* Rationale (full) */}
                  {res.rationale && (
                    <div
                      style={{
                        padding: "4px 16px 8px",
                        fontSize: 11,
                        color: T.textMuted,
                        lineHeight: 1.5,
                        fontStyle: "italic",
                        borderBottom: `1px solid rgba(255,255,255,0.03)`,
                      }}
                    >
                      💡 {res.rationale}
                    </div>
                  )}

                  {/* Config grid */}
                  {allConfigEntries.length > 0 ? (
                    <div style={{ paddingBottom: 8 }}>
                      {/* Column labels */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1.4fr 28px",
                          gap: 0,
                          padding: "6px 16px 2px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: T.textDim,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Parameter
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: T.textDim,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Value
                        </span>
                        <span />
                      </div>
                      {allConfigEntries.map(([k, v]) => (
                        <ConfigRow
                          key={k}
                          configKey={k}
                          value={localConfigs[res.order]?.[k] ?? v}
                          isEditing={
                            editingField?.order === res.order &&
                            editingField?.key === k
                          }
                          onEdit={(key) => handleEditToggle(res.order, key)}
                          onValueChange={(key, newVal) =>
                            handleValueChange(res.order, key, newVal)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "12px 16px",
                        fontSize: 11,
                        color: T.textDim,
                        fontStyle: "italic",
                      }}
                    >
                      Default configuration — no custom fields set.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer actions ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "12px 20px",
          borderTop: `1px solid ${T.border}`,
          background: T.surfaceAlt,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: T.textDim }}>
            {checkedOrders.size}/{allOrders.length} selected
          </span>
          {hasEdits && isDraft && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#fbbf24",
              }}
            >
              • config edited
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Modify Plan */}
          <button
            onClick={handleModify}
            disabled={isLocked}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isLocked ? T.textDim : T.text,
              background: "transparent",
              border: `1px solid ${isLocked ? "rgba(100,116,139,0.2)" : T.border}`,
              borderRadius: T.radiusSm,
              padding: "7px 14px",
              cursor: isLocked ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              opacity: isLocked ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLocked) {
                e.currentTarget.style.borderColor = T.borderHover;
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = isLocked
                ? "rgba(100,116,139,0.2)"
                : T.border;
              e.currentTarget.style.background = "transparent";
            }}
          >
            Modify Plan
          </button>

          {/* Approve & Provision */}
          <button
            onClick={handleApprove}
            disabled={isLocked || checkedOrders.size === 0}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color:
                isLocked || checkedOrders.size === 0 ? T.textDim : "#022c22",
              background:
                isLocked || checkedOrders.size === 0
                  ? "rgba(100,116,139,0.12)"
                  : T.accent,
              border: "none",
              borderRadius: T.radiusSm,
              padding: "7px 16px",
              cursor:
                isLocked || checkedOrders.size === 0
                  ? "not-allowed"
                  : "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseEnter={(e) => {
              if (!isLocked && checkedOrders.size > 0) {
                e.currentTarget.style.background = "#2dd4bf";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLocked && checkedOrders.size > 0) {
                e.currentTarget.style.background = T.accent;
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            {isLocked ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {planStatus === "executing"
                  ? "Provisioning…"
                  : planStatus === "completed"
                    ? "Provisioned"
                    : "Approved"}
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Approve &amp; Provision
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImplementationPlanCard;
