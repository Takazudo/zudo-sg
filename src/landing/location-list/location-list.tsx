import { cx } from "../../lib/cx";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";

export type Location = { name: string; place: string; postal?: string };
export type LocationGroup = { heading: string; locations: Location[] };

export type LocationListProps = {
  groups: LocationGroup[];
  class?: string;
};

/**
 * LocationList — company locations listed by group (department/region), each
 * group heading rule-marked in accent, locations laid out in an auto-fill
 * grid.
 */
export function LocationList({ groups, class: cls }: LocationListProps) {
  return (
    <div class={cx("flex flex-col gap-y-vsp-lg", cls)}>
      {groups.map((group) => (
        <section key={group.heading} aria-label={group.heading}>
          <h3 class="border-s-2 border-accent ps-hsp-sm text-title font-semibold text-fg">
            {group.heading}
          </h3>
          <AutoGrid as="ul" min="13rem" fill gap="sm" class="mt-vsp-sm">
            {group.locations.map((loc) => (
              <li key={loc.name} class="rounded-md border border-border bg-bg px-hsp-md py-vsp-sm">
                <p class="text-small font-semibold text-fg">{loc.name}</p>
                {loc.postal && <p class="mt-vsp-2xs text-micro text-muted">{loc.postal}</p>}
                <p class="mt-vsp-2xs text-caption text-muted">{loc.place}</p>
              </li>
            ))}
          </AutoGrid>
        </section>
      ))}
    </div>
  );
}
