import { mountApp } from "../shared/boot";
import { AppShell } from "../shared/app-shell";
import { DraftStatusView } from "./draft-status-view";
import { DraftRecommendView } from "./draft-recommend-view";
import { CheatsheetView } from "./cheatsheet-view";
import { BestAvailableView } from "./best-available-view";
import { DraftBoardView } from "./draft-board-view";
import "../globals.css";

function DraftApp() {
  return (
    <AppShell name="Yahoo Fantasy Draft Assistant">
      {({ data, toolName, app, navigate }) => {
        switch (toolName) {
          case "draft-status": return <DraftStatusView data={data} />;
          case "draft-recommend": return <DraftRecommendView data={data} app={app} navigate={navigate} />;
          case "draft-cheatsheet": return <CheatsheetView data={data} app={app} navigate={navigate} />;
          case "best-available": return <BestAvailableView data={data} app={app} navigate={navigate} />;
          case "draft-board": return <DraftBoardView data={data} />;
          default: return <div className="p-4 text-muted-foreground">Unknown view: {toolName}</div>;
        }
      }}
    </AppShell>
  );
}

mountApp(DraftApp);
