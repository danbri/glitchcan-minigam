// ---------- world tools: the city, for anyone allowed to ask ----------
// The same vocabulary as Moglob, the other 3D world in foafos (londat docklands/api.js), so one caller can drive both:
//   get_view, describe_view   where you are and what you can see
//   find_places, go_to        what there is to visit, and going there
//   set_time                  the light
// Drift's own tools follow: start_tour, stop_tour. They reach the caller two ways, both from this one list: the frame
// that holds the page (the webmcp.* messages of londat docklands/frame-bridge.js, which the shell's FoafTools speaks)
// and the page's own document.modelContext (WebMCP), where the browser has it. Design:
// docs/foafos-world-tools-20261104.md. The story is not a tool: it belongs to the story runner.
const WORLD_API = "drift-1";
function worldWhere() {
  const [lead, where, far] = statusParts(true);
  return { app: "drift", api_version: WORLD_API, place: where || NAV.siteName, doing: lead || "Here", altitude: far || null,
    site: NAV.site.id, mode: NAV.mode, time: ["day", "dusk", "night", "snow"][todIdx], world: "Titan" };
}
function worldFind(query) {
  const q = String(query || "").trim().toLowerCase();
  return DESTS.filter((d) => !q || d.name.toLowerCase().includes(q) || d.id.includes(q))
    .map((d) => ({ id: d.id, name: d.name, kind: d.space ? "space" : "surface" }));
}
const WORLD_TOOLS = [
  { name: "get_view", readOnly: true, description: "Where the view is now: the place, what you are doing there, and the time of day.",
    inputSchema: { type: "object", properties: {} }, run: () => worldWhere() },
  { name: "describe_view", readOnly: true, description: "The view in one plain sentence.",
    inputSchema: { type: "object", properties: {} },
    run: () => {
      const w = worldWhere(), when = w.time === "snow" ? "in the snow" : w.time === "day" ? "by day" : "at " + w.time;
      const where = NAV.mode === "trip" ? `Flying to ${NAV.trip.dest.name}` : `At ${w.place}`;
      return { ...w, text: `${where} on ${w.world}, ${when}.` };
    } },
  { name: "find_places", readOnly: true, description: "Places you can go, by name. With no query, all of them.",
    inputSchema: { type: "object", properties: { query: { type: "string" } } }, run: (a) => ({ places: worldFind(a.query) }) },
  { name: "go_to", description: "Fly to a place on Titan or in the Saturn system, by name or id. Use find_places to see them.",
    inputSchema: { type: "object", properties: { place: { type: "string" } }, required: ["place"] },
    run: (a) => {
      const q = String(a.place).trim().toLowerCase();
      const d = DESTS.find((x) => x.id === q || x.name.toLowerCase() === q) || DESTS.find((x) => x.name.toLowerCase().includes(q));
      if (!d) throw new Error(`No place called ${a.place}. Use find_places.`);
      goTo(d.id);
      return { ...worldWhere(), found: { id: d.id, name: d.name }, arriving: true };
    } },
  { name: "set_time", description: "Change the light: day, dusk, night or snow.",
    inputSchema: { type: "object", properties: { time: { type: "string", enum: ["day", "dusk", "night", "snow"] } }, required: ["time"] },
    run: (a) => {
      if (!["day", "dusk", "night", "snow"].includes(a.time)) throw new Error("Use day, dusk, night or snow.");
      taleWantTime(a.time);
      return worldWhere();
    } },
  { name: "start_tour", description: "Start the Grand tour of Titan and the Saturn system.",
    inputSchema: { type: "object", properties: {} }, run: () => { goTo("tour"); return worldWhere(); } },
  { name: "stop_tour", description: "Stop the Grand tour where it is.",
    inputSchema: { type: "object", properties: {} }, run: () => { tourHold(); return worldWhere(); } },
];
function worldToolCall(name, args) {
  const t = WORLD_TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`No tool called ${name}.`);
  return t.run(args && typeof args === "object" ? args : {});
}
(function worldToolsStart() {
  const list = WORLD_TOOLS.map(({ name, description, inputSchema, readOnly }) => ({ name, description, inputSchema, readOnly: !!readOnly }));
  const mc = document.modelContext;
  if (mc && mc.registerTool) for (const t of WORLD_TOOLS) {
    Promise.resolve(mc.registerTool({ name: t.name, description: t.description, inputSchema: t.inputSchema,
      annotations: { readOnlyHint: !!t.readOnly }, execute: async (a) => JSON.stringify(worldToolCall(t.name, a)) })).catch(() => {});
  }
  if (window.parent === window) return;
  const parent = window.parent;
  const post = (m) => { try { parent.postMessage(m, "*"); } catch (e) { /* the parent is gone */ } };
  const announce = () => post({ type: "webmcp.tools", api: WORLD_API, tools: list });
  window.addEventListener("message", (e) => {
    const m = e.data;
    if (!m || typeof m.type !== "string" || !m.type.startsWith("webmcp.") || e.source !== parent) return;
    if (m.type === "webmcp.list") { announce(); return; }
    if (m.type !== "webmcp.call") return;
    try { post({ type: "webmcp.result", id: m.id, ok: true, value: JSON.parse(JSON.stringify(worldToolCall(String(m.name), m.args) ?? null)) }); }
    catch (err) { post({ type: "webmcp.result", id: m.id, ok: false, error: String((err && err.message) || err) }); }
  });
  announce();
})();
