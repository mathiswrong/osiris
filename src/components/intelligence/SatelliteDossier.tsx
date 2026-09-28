"use client";
import { missionFor, PROFILE_REVIEWED } from "@/lib/intelligence/profiles";
import type { SatellitePosition } from "@/lib/intelligence/types";
export default function SatelliteDossier({
  satellite: s,
}: {
  satellite: SatellitePosition;
}) {
  const p = missionFor(s);
  return (
    <section className="desk-dossier">
      <div className="desk-dossier-heading">
        <span>{p?.purpose || "Mission not documented"}</span>
        <span>{p?.scope || "Catalogue record"}</span>
      </div>
      {p ? (
        <>
          <p className="desk-mission-summary">{p.summary}</p>
          <dl>
            <dt>Operator / programme</dt>
            <dd>{p.operator}</dd>
            <dt>Profile applies to</dt>
            <dd>
              {p.scope}: {p.name}
            </dd>
          </dl>
          <h3>What it can do</h3>
          <ul className="desk-evidence-list">
            {p.capabilities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <h3>Who uses it</h3>
          <p>{p.users}</p>
          {p.customers.length ? (
            <div className="desk-customers">
              {p.customers.map((c) => (
                <article key={c.name}>
                  <strong>{c.name}</strong>
                  <p>{c.relationship}</p>
                  <small>{c.scope}</small>
                  <a href={c.source.url} target="_blank" rel="noreferrer">
                    Public disclosure · {c.announced} ↗
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <p className="desk-muted">
              No named customer contracts are documented in this profile. Users
              and programme partners are not necessarily paying clients.
            </p>
          )}
          <h3>Limits of this information</h3>
          <p>{p.limitations}</p>
          {p.data && (
            <a href={p.data.url} target="_blank" rel="noreferrer">
              {p.data.label} ↗
            </a>
          )}
          <h3>Primary sources</h3>
          <ul className="desk-profile-sources">
            {p.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label} ↗
                </a>
              </li>
            ))}
          </ul>
          <small className="desk-muted">
            Profile reviewed {PROFILE_REVIEWED}. Public disclosures are dated
            evidence, not live telemetry.
          </small>
        </>
      ) : (
        <>
          <p>
            We have orbital elements for this object, but no reviewed mission
            dossier yet.
          </p>
          <dl>
            <dt>Operator</dt>
            <dd>Not established</dd>
            <dt>Purpose & payload</dt>
            <dd>Not established</dd>
            <dt>Named clients</dt>
            <dd>Not established</dd>
          </dl>
          <p>
            Its name and orbit alone do not establish sensor capabilities,
            military use or customers.
          </p>
        </>
      )}
    </section>
  );
}
