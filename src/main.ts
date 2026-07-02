import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PiIntegration, type Integration } from "./integration.ts";
import { Session } from "./session.ts";

export default function (pi: ExtensionAPI) {
  let integration!: Integration;
  let session!: Session;

  pi.on("session_start", (_event, ctx) => {
    integration = new PiIntegration(pi, ctx);
    session = new Session(integration);
    session.restore();
    session.showStatus();
  });

  pi.on("context", (_event) => {
    session!.maybeInjectMoodMessage();
    session!.showStatus();
  });
}
