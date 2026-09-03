/* NULL — discover-apps.js
   Apps work exactly like games — same folder conventions, same scanner. */
import { scanDir } from "./discover-games.js";

export function discoverApps(rootDir) {
  return scanDir(rootDir, "apps");
}
