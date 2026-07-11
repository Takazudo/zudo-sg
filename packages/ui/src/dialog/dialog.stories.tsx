import type { StoryMeta, Story } from "../stories/types";
import { Dialog, type DialogProps } from "./dialog";

// Stories are PURE + SYNC: no MSW, no fetch. The dialog's busy and error states
// are demonstrated with STATIC props (`busy`, `error`) rather than by driving
// the async submit flow, so every variant renders a stable snapshot. The dialog
// is a fixed full-viewport overlay, so each variant wraps it in a min-height
// spacer to give the preview iframe a sensible height.
const meta: StoryMeta = {
  title: "Dialog",
  category: "Actions",
  // Real page route (MSW-eligible) demonstrating the interactive async-submit
  // flow — the story render() above stays pure/sync. Landed by #215; see
  // packages/ui/STORIES.md §6 (previewRoute escape hatch).
  previewRoute: "/preview/dialog",
  description:
    "Modal dialog with a controlled open state, Escape/backdrop close, focus management, and an injectable async submit flow that shows a busy state and recovers from errors.",
  usage: `import { Dialog } from "@zudo-sg/ui";

<Dialog
  open={open}
  title="Confirm changes"
  onClose={() => setOpen(false)}
  onSubmit={save}
>
  Apply these changes?
</Dialog>`,
  order: 2,
};

export default meta;

const noop = (): void => {};

export const Playground: Story<DialogProps> = {
  name: "Playground",
  source: `<Dialog
  open
  title="Confirm changes"
  onClose={() => setOpen(false)}
  onSubmit={save}
  submitLabel="Save"
>
  Apply these changes to your workspace? This can be undone later.
</Dialog>`,
  controls: [
    { type: "boolean", prop: "open", label: "Open", defaultValue: true },
    { type: "boolean", prop: "busy", label: "Busy", defaultValue: false },
    {
      type: "boolean",
      prop: "closeOnBackdrop",
      label: "Close on backdrop",
      defaultValue: true,
    },
    { type: "text", prop: "submitLabel", label: "Submit label", defaultValue: "Save" },
  ],
  render: (args = {}) => (
    <div class="relative min-h-[20rem]">
      <Dialog
        open={args.open ?? true}
        title="Confirm changes"
        onClose={noop}
        onSubmit={noop}
        submitLabel={args.submitLabel ?? "Save"}
        busy={args.busy ?? false}
        closeOnBackdrop={args.closeOnBackdrop ?? true}
      >
        Apply these changes to your workspace? This can be undone later.
      </Dialog>
    </div>
  ),
};

export const Default: Story<DialogProps> = {
  name: "Default",
  source: `<Dialog open title="Confirm changes" onClose={close} onSubmit={save} submitLabel="Save">
  Apply these changes to your workspace? This can be undone later.
</Dialog>`,
  render: () => (
    <div class="relative min-h-[20rem]">
      <Dialog open title="Confirm changes" onClose={noop} onSubmit={noop} submitLabel="Save">
        Apply these changes to your workspace? This can be undone later.
      </Dialog>
    </div>
  ),
};

export const Busy: Story<DialogProps> = {
  name: "Busy (submitting)",
  source: `<Dialog open busy title="Saving changes" onClose={close} onSubmit={save} submitLabel="Save">
  Applying your changes…
</Dialog>`,
  render: () => (
    <div class="relative min-h-[20rem]">
      <Dialog open busy title="Saving changes" onClose={noop} onSubmit={noop} submitLabel="Save">
        Applying your changes…
      </Dialog>
    </div>
  ),
};

export const WithError: Story<DialogProps> = {
  name: "With error",
  source: `<Dialog
  open
  title="Confirm changes"
  error="Could not save. Please try again."
  onClose={close}
  onSubmit={save}
  submitLabel="Save"
>
  Apply these changes to your workspace?
</Dialog>`,
  render: () => (
    <div class="relative min-h-[20rem]">
      <Dialog
        open
        title="Confirm changes"
        error="Could not save. Please try again."
        onClose={noop}
        onSubmit={noop}
        submitLabel="Save"
      >
        Apply these changes to your workspace?
      </Dialog>
    </div>
  ),
};
