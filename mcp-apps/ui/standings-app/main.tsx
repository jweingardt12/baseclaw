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
import { LeagueHistoryView } from "../history-app/league-history-view";
import { RecordBookView } from "../history-app/record-book-view";
import { PastStandingsView } from "../history-app/past-standings-view";
import { PastDraftView } from "../history-app/past-draft-view";
import { PastTeamsView } from "../history-app/past-teams-view";
import { PastTradesView } from "../history-app/past-trades-view";
import { PastMatchupView } from "../history-app/past-matchup-view";
import "../globals.css";

function StandingsApp() {
  return (
    <AppShell name="Yahoo Fantasy League">
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
          case "league-history": return <LeagueHistoryView data={data} />;
          case "record-book": return <RecordBookView data={data} />;
          case "past-standings": return <PastStandingsView data={data} app={app} navigate={navigate} />;
          case "past-draft": return <PastDraftView data={data} app={app} navigate={navigate} />;
          case "past-teams": return <PastTeamsView data={data} app={app} navigate={navigate} />;
          case "past-trades": return <PastTradesView data={data} app={app} navigate={navigate} />;
          case "past-matchup": return <PastMatchupView data={data} app={app} navigate={navigate} />;
          default: return <div className="p-4 text-muted-foreground">Unknown view: {toolName}</div>;
        }
      }}
    </AppShell>
  );
}

mountApp(StandingsApp);
