import { mountApp } from "../shared/boot";
import { AppShell } from "../shared/app-shell";
import { RosterView } from "./roster-view";
import { FreeAgentsView } from "./free-agents-view";
import { PlayerListView } from "./player-list-view";
import { ActionView } from "./action-view";
import { WhoOwnsView } from "./who-owns-view";
import { RankingsView } from "../valuations-app/rankings-view";
import { CompareView } from "../valuations-app/compare-view";
import { ValueView } from "../valuations-app/value-view";
import "../globals.css";

function RosterApp() {
  return (
    <AppShell name="Yahoo Fantasy Roster">
      {({ data, toolName, app, navigate }) => {
        switch (toolName) {
          case "roster": return <RosterView data={data} app={app} navigate={navigate} />;
          case "free-agents":
          case "search": return <FreeAgentsView data={data} app={app} navigate={navigate} />;
          case "player-list": return <PlayerListView data={data} app={app} navigate={navigate} />;
          case "add":
          case "drop":
          case "swap":
          case "waiver-claim":
          case "waiver-claim-swap": return <ActionView data={data} app={app} navigate={navigate} />;
          case "who-owns": return <WhoOwnsView data={data} app={app} navigate={navigate} />;
          case "rankings": return <RankingsView data={data} app={app} navigate={navigate} />;
          case "compare": return <CompareView data={data} app={app} navigate={navigate} />;
          case "value": return <ValueView data={data} app={app} navigate={navigate} />;
          default: return <div className="p-4 text-muted-foreground">Unknown view: {toolName}</div>;
        }
      }}
    </AppShell>
  );
}

mountApp(RosterApp);
