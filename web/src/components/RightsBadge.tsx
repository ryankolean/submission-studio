export type GateReason = { code: string; field: string; remedy: string };

export type Gate =
  | { allowed: true }
  | { allowed: false; code: string; route: string; reasons: GateReason[] };

const ROUTE_LABEL: Record<string, string> = {
  submission: "Blocked",
  credit_recovery: "Credit recovery only",
  none: "Blocked",
};

/**
 * The verdict is computed server-side and rendered verbatim. The client does
 * not re-derive the rights rule; that would be a second copy of the law.
 */
export function RightsBadge({ gate }: { gate: Gate }) {
  if (gate.allowed) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        Ready to package
      </span>
    );
  }

  const label = ROUTE_LABEL[gate.route] ?? "Blocked";
  const tone =
    gate.route === "credit_recovery"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-rose-300 bg-rose-50 text-rose-900";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

/** The unblock path, spelled out. Design doc section 6.1 asks for exactly this. */
export function GateReasons({ gate }: { gate: Gate }) {
  if (gate.allowed) return null;

  return (
    <ul className="mt-2 space-y-1 text-sm text-slate-600">
      {gate.reasons.map((reason) => (
        <li key={reason.code}>{reason.remedy}</li>
      ))}
    </ul>
  );
}
