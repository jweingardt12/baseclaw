import { mountApp } from "../shared/boot";
import { AppShell } from "../shared/app-shell";
import { LineupOptimizeView } from "./lineup-optimize-view";
import { CategoryCheckView } from "./category-check-view";
import { InjuryReportView } from "./injury-report-view";
import { WaiverAnalyzeView } from "./waiver-analyze-view";
import { StreamingView } from "./streaming-view";
import { TradeEvalView } from "./trade-eval-view";
import { DailyUpdateView } from "./daily-update-view";
import { TradeBuilderView } from "./trade-builder-view";
import { SimulateView } from "./simulate-view";
import { ScoutView } from "./scout-view";
import { MatchupStrategyView } from "./matchup-strategy-view";
import { SetLineupView } from "./set-lineup-view";
import { PendingTradesView } from "./pending-trades-view";
import { TradeActionView } from "./trade-action-view";
import { WhatsNewView } from "./whats-new-view";
import { TradeFinderView } from "./trade-finder-view";
import { WeekPlannerView } from "./week-planner-view";
import { CloserMonitorView } from "./closer-monitor-view";
import { PitcherMatchupView } from "./pitcher-matchup-view";
import { MorningBriefingView } from "./morning-briefing-view";
import { CategoryTrendView } from "./category-trend-view";
import { PuntAdvisorView } from "./punt-advisor-view";
import { PlayoffPlannerView } from "./playoff-planner-view";
import { OptimalMovesView } from "./optimal-moves-view";
import { ILStashAdvisorView } from "./il-stash-advisor-view";
import { TrashTalkView } from "./trash-talk-view";
import { RivalHistoryView } from "./rival-history-view";
import { AchievementsView } from "./achievements-view";
import { WeeklyNarrativeView } from "./weekly-narrative-view";
import { FaabRecommendView } from "./faab-recommend-view";
import { OwnershipTrendsView } from "./ownership-trends-view";
import { RosterStatsView } from "./roster-stats-view";
import { WorkflowSummaryView } from "./workflow-summary-view";
import "../globals.css";

function SeasonApp() {
  return (
    <AppShell name="Yahoo Fantasy Season Manager">
      {({ data, toolName, app, navigate }) => {
        switch (toolName) {
          case "lineup-optimize": return <LineupOptimizeView data={data} app={app} navigate={navigate} />;
          case "category-check": return <CategoryCheckView data={data} />;
          case "injury-report": return <InjuryReportView data={data} app={app} navigate={navigate} />;
          case "waiver-analyze": return <WaiverAnalyzeView data={data} app={app} navigate={navigate} />;
          case "streaming": return <StreamingView data={data} app={app} navigate={navigate} />;
          case "trade-eval": return <TradeEvalView data={data} app={app} navigate={navigate} />;
          case "trade-builder": return <TradeBuilderView data={data} app={app} navigate={navigate} />;
          case "category-simulate": return <SimulateView data={data} app={app} navigate={navigate} />;
          case "scout-opponent": return <ScoutView data={data} app={app} navigate={navigate} />;
          case "matchup-strategy": return <MatchupStrategyView data={data} app={app} navigate={navigate} />;
          case "daily-update": return <DailyUpdateView data={data} app={app} navigate={navigate} />;
          case "set-lineup": return <SetLineupView data={data} app={app} navigate={navigate} />;
          case "pending-trades": return <PendingTradesView data={data} app={app} navigate={navigate} />;
          case "propose-trade":
          case "accept-trade":
          case "reject-trade": return <TradeActionView data={data} app={app} navigate={navigate} />;
          case "whats-new": return <WhatsNewView data={data} app={app} navigate={navigate} />;
          case "trade-finder": return <TradeFinderView data={data} app={app} navigate={navigate} />;
          case "week-planner": return <WeekPlannerView data={data} />;
          case "closer-monitor": return <CloserMonitorView data={data} app={app} navigate={navigate} />;
          case "pitcher-matchup": return <PitcherMatchupView data={data} />;
          case "morning-briefing": return <MorningBriefingView data={data} app={app} navigate={navigate} />;
          case "category-trends": return <CategoryTrendView data={data} />;
          case "punt-advisor": return <PuntAdvisorView data={data} app={app} navigate={navigate} />;
          case "playoff-planner": return <PlayoffPlannerView data={data} app={app} navigate={navigate} />;
          case "optimal-moves": return <OptimalMovesView data={data} app={app} navigate={navigate} />;
          case "il-stash-advisor": return <ILStashAdvisorView data={data} app={app} navigate={navigate} />;
          case "trash-talk": return <TrashTalkView data={data} app={app} navigate={navigate} />;
          case "rival-history": return <RivalHistoryView data={data} app={app} navigate={navigate} />;
          case "achievements": return <AchievementsView data={data} app={app} navigate={navigate} />;
          case "weekly-narrative": return <WeeklyNarrativeView data={data} app={app} navigate={navigate} />;
          case "faab-recommend": return <FaabRecommendView data={data} app={app} navigate={navigate} />;
          case "ownership-trends": return <OwnershipTrendsView data={data} app={app} navigate={navigate} />;
          case "roster-stats": return <RosterStatsView data={data} app={app} navigate={navigate} />;
          case "league-landscape":
          case "roster-health":
          case "waiver-recommendations":
          case "auto-lineup":
          case "trade-analysis":
          case "game-day-manager":
          case "waiver-deadline-prep":
          case "trade-pipeline":
          case "weekly-digest":
          case "season-checkpoint":
            return <WorkflowSummaryView data={data} />;
          default: return <div className="p-4 text-muted-foreground">Unknown view: {toolName}</div>;
        }
      }}
    </AppShell>
  );
}

mountApp(SeasonApp);
