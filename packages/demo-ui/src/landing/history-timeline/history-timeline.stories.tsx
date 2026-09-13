import type { StoryMeta, Story } from "../../stories/types";
import { HistoryTimeline, type HistoryTimelineProps, type HistoryEntry } from "./history-timeline";

const meta: StoryMeta = {
  title: "HistoryTimeline",
  category: "Content",
  description:
    "Vertical \"year / event\" company history timeline — accent year in the left column, a connecting rule + node in the middle, event copy on the right.",
  usage: `import { HistoryTimeline } from "@zudo-sg/ui/src/landing/history-timeline/history-timeline";

<HistoryTimeline entries={entries} />`,
  order: 13,
};

export default meta;

const ENTRIES: HistoryEntry[] = [
  { year: "1953", event: "Company founded." },
  { year: "1970", event: "Expanded into overseas markets." },
  { year: "1999", event: "Listed on a regional stock exchange." },
  { year: "2018", event: "Established a new subsidiary." },
  { year: "2022", event: "Moved to the Prime Market segment." },
  { year: "2025", event: "Opened an overseas subsidiary." },
];

export const Default: Story<HistoryTimelineProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "560px" }}>
      <HistoryTimeline entries={ENTRIES} />
    </div>
  ),
};

export const RecentOnly: Story<HistoryTimelineProps> = {
  name: "Recent only (short list)",
  render: () => (
    <div style={{ maxWidth: "560px" }}>
      <HistoryTimeline
        entries={[
          { year: "2018", event: "Company founded." },
          { year: "2022", event: "Moved to the Prime Market segment." },
          { year: "2025", event: "Opened an overseas subsidiary." },
        ]}
      />
    </div>
  ),
};
