import type { StoryMeta, Story } from "../../stories/types";
import { LocationList, type LocationListProps, type LocationGroup } from "./location-list";

const meta: StoryMeta = {
  title: "LocationList",
  category: "Data Display",
  description:
    "Company locations listed by group (department/region), each group heading rule-marked in accent, locations laid out in an auto-fill grid.",
  usage: `import { LocationList } from "@zudo-sg/ui/src/landing/location-list/location-list";

<LocationList groups={groups} />`,
  order: 14,
};

export default meta;

const GROUPS: LocationGroup[] = [
  {
    heading: "Electronics division",
    locations: [
      { name: "Kansai branch", postal: "000-0000", place: "1-1-1 Example, Example City" },
      { name: "Nagoya branch", postal: "000-0000", place: "1-1-1 Example, Example City" },
      { name: "Fukuoka sales office", postal: "000-0000", place: "1-1-1 Example, Example City" },
    ],
  },
  {
    heading: "Chemicals division",
    locations: [
      { name: "Example research lab", postal: "000-0000", place: "1-1-1 Example, Example City" },
      { name: "Example plant", postal: "000-0000", place: "1-2-1 Example, Example City" },
      { name: "Chubu sales office", postal: "000-0000", place: "1-3-1 Example, Example City" },
    ],
  },
  {
    heading: "Overseas",
    locations: [
      { name: "Example Enterprises Ltd.", place: "United Kingdom" },
      { name: "Example Taiwan Ltd.", place: "Taiwan" },
      { name: "Example America Inc.", place: "United States" },
    ],
  },
];

export const Default: Story<LocationListProps> = {
  name: "Default (3 groups)",
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <LocationList groups={GROUPS} />
    </div>
  ),
};

export const SingleGroup: Story<LocationListProps> = {
  name: "Single group",
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <LocationList
        groups={[
          {
            heading: "Domestic locations",
            locations: [
              { name: "Head office", place: "Tokyo" },
              { name: "Kansai branch", place: "Osaka" },
              { name: "Nagoya branch", place: "Aichi" },
            ],
          },
        ]}
      />
    </div>
  ),
};
