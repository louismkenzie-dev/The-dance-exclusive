/**
 * The admin and staff design kit — the same app-feel language the parent
 * booking journey and the registers already use, in the pieces the studio's
 * own screens need. Screens compose these rather than inventing their own
 * headers, cards and spacing, so the portal reads as one product.
 */
export { AdminPage } from "./AdminPage";
export { PageHeader } from "./PageHeader";
export { RecordCard, RecordList } from "./RecordCard";
export { Fab } from "./Fab";
export { FilterBar } from "./FilterBar";
export { StatTile, StatGrid } from "./StatTile";
export { DesktopOnly, PhoneOnly } from "./Responsive";

// Re-exported from the booking kit so an admin screen has one import for
// everything it needs, and the two portals cannot drift apart.
export { Chip, ChipRow } from "@/components/booking/Chips";
export { EmptyState } from "@/components/booking/EmptyState";
export { SectionHeading } from "@/components/booking/SectionHeading";
export { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
export { SegmentedControl, type Segment } from "@/components/booking/SegmentedControl";
