/* NULL — discover-content.js
   Runs the three folder scanners and merges everything into one catalog
   object ready for the generator (build-catalog.js / build-single-files.js). */
import { discoverGames } from "./discover-games.js";
import { discoverApps } from "./discover-apps.js";
import { discoverProxies } from "./discover-proxies.js";

export function discoverContent(rootDir) {
  const g = discoverGames(rootDir);
  const a = discoverApps(rootDir);
  const p = discoverProxies(rootDir);
  return {
    site: "NULL",
    generatedAt: new Date().toISOString(),
    games: g.items,
    apps: a.items,
    proxies: p.proxies,
    notes: {
      skippedGames: g.skipped,
      skippedApps: a.skipped,
      skippedProxies: p.skipped,
    },
  };
}
