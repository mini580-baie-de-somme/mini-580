/** Whether TipTap should replace its document from an incoming markdown prop. */
export function shouldApplyParentMarkdownToVisualEditor(
  lastSyncedMarkdown: string,
  incomingMarkdown: string
): boolean {
  return incomingMarkdown !== lastSyncedMarkdown;
}
