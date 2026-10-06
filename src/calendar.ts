export type UnavailableWindow = { start: string; end: string; label?: string };

/** Calendar port: planner consumes a bounded unavailable-time snapshot and never talks to a provider directly. */
export interface CalendarProvider {
  getUnavailableWindows(from: string, to: string): UnavailableWindow[];
}

/** Local deterministic provider backed by customer-entered holds; can be replaced by a consented real calendar adapter. */
export class MockCalendarProvider implements CalendarProvider {
  constructor(private readonly windows: readonly UnavailableWindow[]) {}
  getUnavailableWindows(from: string, to: string): UnavailableWindow[] {
    const start = Date.parse(from),
      end = Date.parse(to);
    return this.windows
      .filter((w) => Date.parse(w.start) < end && Date.parse(w.end) > start)
      .map((w) => ({ ...w }));
  }
}
