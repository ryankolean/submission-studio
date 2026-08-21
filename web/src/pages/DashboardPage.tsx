import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "../api/client.js";
import { useSession } from "../session-context.js";
import { GateReasons, RightsBadge, type Gate } from "../components/RightsBadge.js";

export interface WeddingSummary {
  id: string;
  slug: string;
  coupleNames: string;
  weddingDate: string;
  venueName: string | null;
  city: string | null;
  state: string | null;
  hasGalleryUrl: boolean;
  gate: Gate;
}

function place(wedding: WeddingSummary): string {
  return [wedding.venueName, [wedding.city, wedding.state].filter(Boolean).join(", ")]
    .filter((part) => part !== null && part !== "")
    .join(" - ");
}

export function DashboardPage() {
  const { api } = useSession();
  const [weddings, setWeddings] = useState<WeddingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ weddings: WeddingSummary[] }>("/weddings")
      .then((body) => {
        if (!cancelled) setWeddings(body.weddings);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "Could not load weddings.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (error !== null) {
    return (
      <p role="alert" className="text-sm text-rose-700">
        {error}
      </p>
    );
  }

  if (weddings === null) return <p className="text-sm text-slate-500">Loading weddings.</p>;

  return (
    <section>
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Inventory</h2>
        <Link
          to="/weddings/new"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Add a wedding
        </Link>
      </header>

      {weddings.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No weddings yet. Add one to see its rights and consent status.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {weddings.map((wedding) => (
            <li key={wedding.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-slate-900">{wedding.coupleNames}</h3>
                  <p className="text-sm text-slate-500">
                    {wedding.weddingDate}
                    {place(wedding) !== "" ? ` - ${place(wedding)}` : ""}
                  </p>
                </div>
                <RightsBadge gate={wedding.gate} />
              </div>
              <GateReasons gate={wedding.gate} />
              {!wedding.hasGalleryUrl && (
                <p className="mt-2 text-sm text-slate-500">No gallery link on file.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
