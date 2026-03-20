import { mountApp } from "../shared/boot";
import { AppShell } from "../shared/app-shell";
import { PlayerReportView } from "./player-report-view";
import { BreakoutsView } from "./breakouts-view";
import { RedditView } from "./reddit-view";
import { ProspectsView } from "./prospects-view";
import { TransactionsView } from "./transactions-view";
import { TeamsView } from "../mlb-app/teams-view";
import { RosterView as MlbRosterView } from "../mlb-app/roster-view";
import { PlayerView as MlbPlayerView } from "../mlb-app/player-view";
import { StatsView as MlbStatsView } from "../mlb-app/stats-view";
import { InjuriesView } from "../mlb-app/injuries-view";
import { StandingsView as MlbStandingsView } from "../mlb-app/standings-view";
import { ScheduleView } from "../mlb-app/schedule-view";
import { DraftStatusView } from "../draft-app/draft-status-view";
import { DraftRecommendView } from "../draft-app/draft-recommend-view";
import { CheatsheetView } from "../draft-app/cheatsheet-view";
import { BestAvailableView } from "../draft-app/best-available-view";
import { DraftBoardView } from "../draft-app/draft-board-view";
import "../globals.css";

function IntelApp() {
  return (
    <AppShell name="Fantasy Intelligence">
      {({ data, toolName, app, navigate }) => {
        switch (toolName) {
          case "intel-player": return <PlayerReportView data={data} app={app} navigate={navigate} />;
          case "intel-breakouts":
          case "intel-busts": return <BreakoutsView data={data} app={app} navigate={navigate} />;
          case "intel-reddit":
          case "intel-trending": return <RedditView data={data} app={app} navigate={navigate} />;
          case "intel-prospects": return <ProspectsView data={data} app={app} navigate={navigate} />;
          case "intel-transactions": return <TransactionsView data={data} app={app} navigate={navigate} />;
          case "mlb-teams": return <TeamsView data={data} />;
          case "mlb-roster": return <MlbRosterView data={data} app={app} navigate={navigate} />;
          case "mlb-player": return <MlbPlayerView data={data} app={app} navigate={navigate} />;
          case "mlb-stats": return <MlbStatsView data={data} />;
          case "mlb-injuries": return <InjuriesView data={data} />;
          case "mlb-standings": return <MlbStandingsView data={data} />;
          case "mlb-schedule": return <ScheduleView data={data} />;
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

mountApp(IntelApp);
