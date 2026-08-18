import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/robots";

/** Next's native `robots.txt` route. The rules are built in `lib/robots.ts` so they can be tested. */
export default function robots(): MetadataRoute.Robots {
  return buildRobots();
}
