export async function showPasstoAgentPreviewPanel(
  payload: { title: string; message: string },
  ctx: {
    hasUI?: boolean;
    ui: {
      custom?<T>(factory: (tui: unknown, theme: { fg(name: string, text: string): string; bold(text: string): string }, kb: unknown, done: (value: T | undefined) => void) => {
        render(width: number): string[];
        invalidate(): void;
        handleInput(data: string): void;
      }): Promise<T | undefined>;
      notify(message: string, type?: "info" | "warning" | "error"): void;
    };
  },
): Promise<void> {
  if (!ctx.hasUI || !ctx.ui.custom) {
    ctx.ui.notify(`${payload.title}\n${payload.message}`, "info");
    return;
  }

  const [{ DynamicBorder, getMarkdownTheme }, { Container, Markdown, matchesKey, Text }] = await Promise.all([
    import("@mariozechner/pi-coding-agent"),
    import("@mariozechner/pi-tui"),
  ]);

  await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
    const container = new Container();
    const border = new DynamicBorder((s: string) => theme.fg("accent", s));
    const mdTheme = getMarkdownTheme();

    container.addChild(border);
    container.addChild(new Text(theme.fg("accent", theme.bold(payload.title)), 1, 0));
    container.addChild(new Markdown(payload.message, 1, 1, mdTheme));
    container.addChild(new Text(theme.fg("dim", "Press Enter or Esc to continue"), 1, 0));
    container.addChild(border);

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, "enter") || matchesKey(data, "escape")) {
          done(undefined);
        }
      },
    };
  });
}
