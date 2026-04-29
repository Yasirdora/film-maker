import type { ReactNode } from "react";

export interface FootnoteEntry {
  id: string;
  body: ReactNode;
}

export const FOOTNOTES: FootnoteEntry[] = [
  {
    id: "plans",
    body: (
      <p>
        Filmmaker Network is in public beta. Solo is free; Indie, Creator and
        Studio are rolling out to selected users &ndash; pricing TBA before
        general availability.
      </p>
    ),
  },
  {
    id: "offer",
    body: (
      <p>
        Promotional offers can be redeemed once per account and may not be
        combined with other offers.
      </p>
    ),
  },
  {
    id: "models",
    body: (
      <p>
        Filmmaker Network curates a catalog of production-grade image and video
        models, each listed with its exact credit cost per generation in the{" "}
        <a href="#">model catalog</a>. The line-up changes as new models ship
        and older ones are retired.
      </p>
    ),
  },
  {
    id: "videogen",
    body: (
      <p>
        Video generation length, resolution and quality tier are subject to the
        limits of the underlying model. 4K output is available on Creator and
        Studio; DCP delivery is available on the Studio plan.{" "}
        <a href="#">See output specs</a>.
      </p>
    ),
  },
  {
    id: "jules",
    body: (
      <p>
        The AI director and other agentic features are currently in beta.
        Capacity is subject to availability and is not guaranteed. English
        prompts are officially supported; other languages may produce variable
        results.
      </p>
    ),
  },
  {
    id: "homep",
    body: (
      <p>
        Project storage and version history are included with all paid plans.
        Storage limits scale with your plan tier.{" "}
        <a href="#">Learn more about project storage</a>.
      </p>
    ),
  },
  {
    id: "license",
    body: (
      <p>
        The commercial license included with paid plans covers client work,
        festival and theatrical release, advertising and other revenue-
        generating use. You remain responsible for clearing any third-party
        likeness, trademark or IP rights in your inputs and outputs.{" "}
        <a href="#">Read the license</a>.
      </p>
    ),
  },
  {
    id: "priority",
    body: (
      <p>
        Priority queue is available on Creator and Studio plans. During
        exceptional load, generation speed and concurrency may adjust
        dynamically to maintain platform stability.
      </p>
    ),
  },
  {
    id: "teams",
    body: (
      <p>
        Team seats on the Studio plan include shared projects, role-based
        access and centralised billing. <a href="#">Contact us</a> for
        organisations larger than 10&nbsp;seats.
      </p>
    ),
  },
  {
    id: "ai_credits",
    body: (
      <p>
        Monthly credits are tied to your active subscription period. Unused
        subscription credits do not roll over and expire at the end of each
        cycle. Extra credit packs purchased separately remain valid as long as
        your subscription is active.
      </p>
    ),
  },
];

/** 1-based index of `id` in the master list, or null if unknown. */
export function getFootnoteNumber(id: string): number | null {
  const idx = FOOTNOTES.findIndex((fn) => fn.id === id);
  return idx === -1 ? null : idx + 1;
}

/**
 * Returns the entries matching `ids`, in master-list order, paired with their
 * stable absolute number. Unknown IDs are skipped.
 */
export function selectFootnotes(
  ids: readonly string[],
): { id: string; number: number; body: ReactNode }[] {
  const want = new Set(ids);
  return FOOTNOTES.flatMap((fn, idx) =>
    want.has(fn.id) ? [{ id: fn.id, number: idx + 1, body: fn.body }] : [],
  );
}
