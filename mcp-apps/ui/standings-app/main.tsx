import { mountApp } from "../shared/boot";
import { AppShell } from "../shared/app-shell";
import { StandingsView } from "./standings-view";
import { MatchupsView } from "./matchups-view";
import { InfoView } from "./info-view";
import { TransactionsView } from "./transactions-view";
import { StatCategoriesView } from "./stat-categories-view";
import { MatchupDetailView } from "./matchup-detail-view";
import { TransactionTrendsView } from "./transaction-trends-view";
import { LeaguePulseView } from "./league-pulse-view";
import { PowerRankingsView } from "./power-rankings-view";
import { SeasonPaceView } from "./season-pace-view";
import "../globals.css";

function StandingsApp() {
  return (
    <AppShell name="Yahoo Fantasy Standings">
      {({ data, toolName, app, navigate }) => {
        switch (toolName) {
          case "standings": return <StandingsView data={data} />;
          case "matchups":
          case "scoreboard": return <MatchupsView data={data} app={app} navigate={navigate} toolName={toolName} />;
          case "info": return <InfoView data={data} />;
          case "transactions": return <TransactionsView data={data} />;
          case "stat-categories": return <StatCategoriesView data={data} />;
          case "matchup-detail": return <MatchupDetailView data={data} app={app} navigate={navigate} />;
          case "transaction-trends": return <TransactionTrendsView data={data} />;
          case "league-pulse": return <LeaguePulseView data={data} />;
          case "power-rankings": return <PowerRankingsView data={data} />;
          case "season-pace": return <SeasonPaceView data={data} />;
          default: return <div className="p-4 text-muted-foreground">Unknown view: {toolName}</div>;
        }
      }}
    </AppShell>
  );
}

mountApp(StandingsApp);
