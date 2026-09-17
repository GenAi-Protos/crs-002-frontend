// Re-mounted on every navigation, unlike the layout, so each destination
// arrives with the 120ms crossfade defined in globals.css. It is also the flex
// bridge between the scroll region and a page that wants the tab's full
// height (Intelligence pins its composer to the bottom edge; Clients splits
// the pane): both simply take flex-1 of this wrapper.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex min-h-0 flex-1 flex-col">{children}</div>;
}
