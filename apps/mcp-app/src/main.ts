import { App } from "@modelcontextprotocol/ext-apps";
import "./style.css";

type Block = {
  taskId: string;
  title: string;
  start: string;
  end: string;
  durationMinutes: number;
};
type Result = {
  structuredContent?: Record<string, unknown> | undefined;
  content?: { type: string; text?: string }[] | undefined;
};
const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `<header><span class="mark" aria-hidden="true">0</span><div><h1>Deadline Zero</h1><div class="tagline">Turn chaos into a plan that adapts.</div></div></header><main aria-live="polite"><section class="summary"><p id="summary">Your plan is ready. Protect the nearest deadlines and keep space for the things you can’t move.</p><span id="risk" class="risk">Plan status: waiting for plan</span></section><h2>Up next</h2><ol id="timeline" aria-label="Scheduled work"></ol><div class="actions"><button id="start" type="button">Start next task</button><button id="expand" class="secondary" type="button">Expand plan</button></div><p id="feedback" class="feedback" role="status"></p></main>`;
const app = new App({ name: "Deadline Zero", version: "0.1.0" }, {});
let nextTaskId: string | undefined;
let lastResult: Result | undefined;
let hostLocale = "en";
let hostTimeZone: string | undefined;
let fullscreen = false;
let lastBlocks: Block[] = [];
const clock = (value: string) =>
  new Intl.DateTimeFormat(hostLocale, {
    hour: "numeric",
    minute: "2-digit",
    ...(hostTimeZone ? { timeZone: hostTimeZone } : {}),
  }).format(new Date(value));
function readResult(result: Result) {
  lastResult = result;
  const data =
    result.structuredContent ??
    (() => {
      try {
        return JSON.parse(
          result.content?.find((x) => x.type === "text")?.text ?? "{}",
        ) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();
  const schedule = (data.schedule ??
    data.updatedPlan ??
    data.newPlan ??
    data.currentPlan ??
    data.simulatedPlan) as
    { blocks?: Block[]; riskLevel?: string; warnings?: string[] } | undefined;
  const blocks = schedule?.blocks ?? lastBlocks;
  if (schedule?.blocks) lastBlocks = schedule.blocks;
  const timeline = document.querySelector<HTMLOListElement>("#timeline")!;
  timeline.replaceChildren();
  for (const block of blocks.slice(0, fullscreen ? blocks.length : 6)) {
    const item = document.createElement("li");
    const time = document.createElement("time");
    time.dateTime = block.start;
    time.textContent = clock(block.start);
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = block.title;
    const duration = document.createElement("small");
    duration.textContent = `${block.durationMinutes} minutes`;
    text.append(title, document.createElement("br"), duration);
    item.append(time, text);
    timeline.append(item);
  }
  nextTaskId = blocks[0]?.taskId;
  const risk = document.querySelector<HTMLSpanElement>("#risk")!;
  const level = schedule?.riskLevel ?? "LOW";
  risk.textContent = `Plan status: ${level.toLowerCase()}`;
  risk.className = `risk ${level === "HIGH" ? "high" : ""}`;
  const warningList = schedule?.warnings ?? [];
  document.querySelector("#summary")!.textContent = warningList.length
    ? `Some work may not fit. ${warningList[0]}`
    : blocks.length
      ? `Your plan has ${blocks.length} upcoming work block${blocks.length === 1 ? "" : "s"}.`
      : "No scheduled work was returned. Ask Alexa to create a plan.";
  if (typeof data.confirmationSummary === "string")
    document.querySelector("#summary")!.textContent = data.confirmationSummary;
  if (typeof data.explanation === "string")
    document.querySelector("#summary")!.textContent = data.explanation;
  if (typeof data.action === "string")
    document.querySelector("#summary")!.textContent = data.action;
  if (typeof data.impact === "string")
    document.querySelector("#summary")!.textContent =
      `Hypothetically, ${data.impact} The saved plan is unchanged.`;
  if (typeof data.completionPercentage === "number")
    document.querySelector("#summary")!.textContent =
      `${data.completionPercentage}% complete. ${data.completedCount} finished; ${data.remainingCount} remaining.`;
  if (data.deleted === true) {
    lastBlocks = [];
    nextTaskId = undefined;
    timeline.replaceChildren();
    document.querySelector("#risk")!.textContent = "Plan status: no saved data";
    document.querySelector("#summary")!.textContent =
      typeof data.confirmationSummary === "string"
        ? data.confirmationSummary
        : "Your saved planning data was deleted.";
  }
  if (data.error && typeof data.error === "object") {
    const error = data.error as { message?: string; nextAction?: string };
    document.querySelector("#summary")!.textContent =
      `${error.message ?? "I couldn’t update your plan."} ${error.nextAction ?? "Try again."}`;
  }
}
app.ontoolresult = readResult;
app.ontoolinput = () => {
  document.querySelector("#feedback")!.textContent = "Updating your plan…";
};
app.onhostcontextchanged = (context) => {
  if (context.locale) {
    hostLocale = context.locale;
    document.documentElement.lang = context.locale;
  }
  if (context.timeZone) hostTimeZone = context.timeZone;
  if (lastResult) readResult(lastResult);
};
app.connect().catch(() => {
  document.querySelector("#feedback")!.textContent =
    "Plan display is unavailable. You can still use the spoken plan.";
});
document
  .querySelector<HTMLButtonElement>("#start")!
  .addEventListener("click", async () => {
    if (!nextTaskId) {
      document.querySelector("#feedback")!.textContent =
        "Ask Alexa to create a plan first.";
      return;
    }
    try {
      await app.callServerTool({
        name: "start_focus_session",
        arguments: { taskId: nextTaskId },
      });
      document.querySelector("#feedback")!.textContent =
        "Focus session started.";
    } catch {
      document.querySelector("#feedback")!.textContent =
        "I couldn’t start the session. Try asking Alexa to start the next task.";
    }
  });
document
  .querySelector<HTMLButtonElement>("#expand")!
  .addEventListener("click", async () => {
    try {
      const result = await app.requestDisplayMode({
        mode: fullscreen ? "inline" : "fullscreen",
      });
      fullscreen = result.mode === "fullscreen";
      document.querySelector<HTMLButtonElement>("#expand")!.textContent =
        fullscreen ? "Show summary" : "Expand plan";
      if (lastResult) readResult(lastResult);
    } catch {
      document.querySelector("#feedback")!.textContent =
        "Fullscreen view is not available on this Alexa surface.";
    }
  });
