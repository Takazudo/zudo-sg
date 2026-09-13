import { cx } from "../../lib/cx";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";

export type Cert = { code: string; name: string; scope: string };

export type CertListProps = {
  heading?: string;
  certs: Cert[];
  /** Renders the list only, omitting the heading — for embedding in body copy. */
  bare?: boolean;
  class?: string;
};

/** CertList — management-certification list (e.g. ISO), each entry a code badge + name + scope. */
export function CertList({ heading, certs, bare = false, class: cls }: CertListProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={bare ? undefined : heading}>
      {!bare && heading && <SectionHeading heading={heading} />}

      <AutoGrid as="ul" min="16rem">
        {certs.map((cert) => (
          <li key={cert.code} class="flex items-start gap-x-hsp-md rounded-md border border-border bg-bg px-hsp-lg py-vsp-md">
            <span
              class="shrink-0 rounded-md border border-border px-hsp-sm py-vsp-2xs text-caption font-bold text-accent"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-accent) 8%, var(--color-bg))",
                borderColor: "color-mix(in srgb, var(--color-accent) 30%, var(--color-border))",
              }}
            >
              {cert.code}
            </span>
            <div>
              <h3 class="text-title font-semibold text-fg">{cert.name}</h3>
              <p class="mt-vsp-2xs text-small leading-relaxed text-fg" style={{ textWrap: "pretty" }}>
                {cert.scope}
              </p>
            </div>
          </li>
        ))}
      </AutoGrid>
    </section>
  );
}
