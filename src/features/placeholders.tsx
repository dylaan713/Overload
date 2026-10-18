import { EmptyState } from "../ui/EmptyState";
import type { SheetView } from "../ui/SheetStack";

// Temporary content until Plans B and C fill these screens.
export const LogPlaceholder = () => <EmptyState text="Logging a workout arrives in the next build." />;
export const ProgressPlaceholder = () => <EmptyState text="Charts, records and weekly volume arrive in a later build." />;
export const HistoryPlaceholder = () => <EmptyState text="Your workout calendar arrives in a later build." />;

export const settingsPlaceholderView = (): SheetView => ({
  id: "settings",
  title: "Settings",
  render: () => <EmptyState text="Settings are on their way." />,
});
