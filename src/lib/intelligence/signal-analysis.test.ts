import { describe, expect, it } from "vitest";
import { analyzeTelegram, type SignalFeed, type SignalNews } from "./signal-analysis";
const now = "2026-09-28T12:00:00Z";
function item(id: string, minutesAgo: number, source: string, place: string | null): SignalNews {
  return { id, title: `Report ${id}`, link: `https://${source}/${id}`, published: new Date(Date.parse(now) - minutesAgo * 60_000).toISOString(), source, source_name: source, alert_kind: "news", place: place ? { name: place } : null, coords_anchor: null, also_reported_by: [] };
}
function feed(news: SignalNews[]): SignalFeed { return { news, sources: [], timestamp: now }; }
describe("Telegram activity analysis", () => {
  it("flags a rising place only when multiple channels carry increased recent activity", () => {
    const result = analyzeTelegram(feed([item("a", 4, "t.me/one", "Gaza"), item("b", 9, "t.me/two", "Gaza"), item("c", 18, "t.me/one", "Gaza"), item("d", 90, "t.me/one", "Gaza")]));
    expect(result.trends[0]).toMatchObject({ name: "Gaza", lastHour: 3, priorHour: 1, channels: 2, state: "rising" });
  });
  it("keeps one-channel activity from being called a rise and excludes unlocated posts from place trends", () => {
    const result = analyzeTelegram(feed([item("a", 4, "t.me/one", "Iran"), item("b", 9, "t.me/one", "Iran"), item("c", 5, "t.me/one", null), item("wire", 2, "bbc.com", "Iran")]));
    expect(result.trends[0]).toMatchObject({ name: "Iran", channels: 1, state: "active" });
    expect(result.posts).toHaveLength(3);
    expect(result.fresh).toHaveLength(3);
  });
  it("counts a repeated carrier once and handles missing feed timestamps", () => {
    const duplicate = item("a", 4, "t.me/one", "Iran");
    duplicate.also_reported_by = [{ source: "t.me/one", source_name: "One", link: duplicate.link, published: duplicate.published }];
    expect(analyzeTelegram(feed([duplicate])).posts).toHaveLength(1);
    expect(analyzeTelegram({ ...feed([duplicate]), timestamp: "invalid" }).trends).toHaveLength(0);
  });
  it("prefers a specifically mentioned place over a broad source anchor", () => {
    const post = item("gaza", 4, "t.me/one", "Israel");
    post.title = "New aid plan for Gaza";
    expect(analyzeTelegram(feed([post])).trends[0].name).toBe("Gaza");
  });
});
