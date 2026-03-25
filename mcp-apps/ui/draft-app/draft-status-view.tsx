import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "../components/progress";
import { Text } from "../components/text";
import { BarChart } from "@/charts";
import { KpiTile } from "../shared/kpi-tile";

interface DraftStatusData {
  total_picks: number;
  current_round: number;
  my_picks?: number;
  my_hitters?: number;
  my_pitchers?: number;
  hitters?: number;
  pitchers?: number;
  drafted_ids?: string[];
  ai_recommendation?: string | null;
}

// Roster position slots in a 23-round league
var ROSTER_SLOTS = [
  { pos: "C", count: 1, type: "bat" },
  { pos: "1B", count: 1, type: "bat" },
  { pos: "2B", count: 1, type: "bat" },
  { pos: "SS", count: 1, type: "bat" },
  { pos: "3B", count: 1, type: "bat" },
  { pos: "OF", count: 3, type: "bat" },
  { pos: "UTIL", count: 1, type: "bat" },
  { pos: "BN", count: 3, type: "bat" },
  { pos: "SP", count: 2, type: "pit" },
  { pos: "RP", count: 2, type: "pit" },
  { pos: "BN", count: 3, type: "pit" },
  { pos: "IL", count: 2, type: "any" },
];

// Build flat list of individual slots
function buildSlotList() {
  var slots: Array<{ pos: string; type: string; index: number }> = [];
  ROSTER_SLOTS.forEach(function (slot) {
    for (var i = 0; i < slot.count; i++) {
      slots.push({ pos: slot.pos, type: slot.type, index: slots.length });
    }
  });
  return slots;
}

var ALL_SLOTS = buildSlotList();

// Total batting and pitching slots (excluding IL which is "any")
var BATTING_SLOTS = ALL_SLOTS.filter(function (s) { return s.type === "bat"; }).length;
var PITCHING_SLOTS = ALL_SLOTS.filter(function (s) { return s.type === "pit"; }).length;

var TOTAL_DRAFT_PICKS = 276; // 12 teams x 23 rounds
var COLORS = ["#3b82f6", "#f97316"];

export function DraftStatusView({ data }: { data: DraftStatusData }) {
  var hitters = data.my_hitters || data.hitters || 0;
  var pitchers = data.my_pitchers || data.pitchers || 0;
  var myPicks = data.my_picks || hitters + pitchers;

  var rosterData = [
    { name: "Hitters", value: hitters },
    { name: "Pitchers", value: pitchers },
  ].filter(function (d) { return d.value > 0; });

  var total = hitters + pitchers;
  var hitterPct = total > 0 ? Math.round((hitters / total) * 100) : 0;
  var pitcherPct = total > 0 ? 100 - hitterPct : 0;

  // Build filled status for each slot
  var filledBatting = Math.min(hitters, BATTING_SLOTS);
  var filledPitching = Math.min(pitchers, PITCHING_SLOTS);

  // Build slot fill array
  var slotFillIndex = 0;
  var battingFilled = 0;
  var pitchingFilled = 0;

  var slotStatuses = ALL_SLOTS.map(function (slot) {
    var filled = false;
    if (slot.type === "bat") {
      if (battingFilled < filledBatting) {
        filled = true;
        battingFilled++;
      }
    } else if (slot.type === "pit") {
      if (pitchingFilled < filledPitching) {
        filled = true;
        pitchingFilled++;
      }
    } else {
      // IL slots - fill with overflow
      var overflowBat = Math.max(0, hitters - BATTING_SLOTS);
      var overflowPit = Math.max(0, pitchers - PITCHING_SLOTS);
      if (slotFillIndex < overflowBat + overflowPit) {
        filled = true;
      }
      slotFillIndex++;
    }
    return { pos: slot.pos, type: slot.type, filled: filled };
  });

  var filledCount = slotStatuses.filter(function (s) { return s.filled; }).length;
  var totalSlots = ALL_SLOTS.length;
  var draftPct = Math.round((data.total_picks / TOTAL_DRAFT_PICKS) * 100);

  return (
    <div className="space-y-3">
      {/* KPI Grid */}
      <div className="kpi-grid">
        <KpiTile value={data.current_round} label="Round" color="primary" />
        <KpiTile value={myPicks} label="My Picks" color="info" />
        <KpiTile value={hitters} label="Hitters" color="success" />
        <KpiTile value={pitchers} label="Pitchers" color="warning" />
      </div>

      {/* Draft Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Draft Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data.total_picks + " of " + TOTAL_DRAFT_PICKS + " picks"}
              </span>
              <span className="font-mono font-medium">
                {draftPct + "%"}
              </span>
            </div>
            <Progress value={data.total_picks} max={TOTAL_DRAFT_PICKS} />
            <Text>
              {(TOTAL_DRAFT_PICKS - data.total_picks) + " picks remaining"}
            </Text>
          </div>
        </CardContent>
      </Card>

      {/* Roster Composition - Pie Chart + Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Roster Composition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {rosterData.length > 0 && (
              <div className="flex-shrink-0 mx-auto sm:mx-0" style={{ width: 120 }}>
                <BarChart
                  data={rosterData.map(function (d, i) {
                    return { label: d.name, value: d.value, color: COLORS[i % COLORS.length] };
                  })}
                  height={96}
                  showLabels
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              {total > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-emerald-500 font-medium">{hitterPct + "% H"}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: hitterPct + "%" }}
                    />
                  </div>
                  <span className="text-orange-500 font-medium">{pitcherPct + "% P"}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roster Fill Grid */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Roster Fill</CardTitle>
            <Badge variant="secondary" className="font-mono">
              {filledCount + " / " + totalSlots}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Batting Slots */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Batting</p>
              <div className="flex flex-wrap gap-1.5">
                {slotStatuses
                  .filter(function (s) { return s.type === "bat"; })
                  .map(function (slot, i) {
                    return (
                      <div
                        key={"bat-" + i}
                        className={
                          "flex items-center justify-center w-10 h-10 rounded-lg border-2 text-xs font-bold transition-colors " +
                          (slot.filled
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "border-dashed border-muted-foreground/20 bg-transparent text-muted-foreground/20")
                        }
                      >
                        {slot.pos}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Pitching Slots */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Pitching</p>
              <div className="flex flex-wrap gap-1.5">
                {slotStatuses
                  .filter(function (s) { return s.type === "pit"; })
                  .map(function (slot, i) {
                    return (
                      <div
                        key={"pit-" + i}
                        className={
                          "flex items-center justify-center w-10 h-10 rounded-lg border-2 text-xs font-bold transition-colors " +
                          (slot.filled
                            ? "border-orange-500 bg-orange-500/15 text-orange-600 dark:text-orange-400"
                            : "border-dashed border-muted-foreground/20 bg-transparent text-muted-foreground/20")
                        }
                      >
                        {slot.pos}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* IL Slots */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Injured List</p>
              <div className="flex flex-wrap gap-1.5">
                {slotStatuses
                  .filter(function (s) { return s.type === "any"; })
                  .map(function (slot, i) {
                    return (
                      <div
                        key={"il-" + i}
                        className={
                          "flex items-center justify-center w-10 h-10 rounded-lg border-2 text-xs font-bold transition-colors " +
                          (slot.filled
                            ? "border-red-500 bg-red-500/15 text-red-600 dark:text-red-400"
                            : "border-dashed border-muted-foreground/20 bg-transparent text-muted-foreground/20")
                        }
                      >
                        {slot.pos}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Fill Progress */}
            <div className="pt-1">
              <Progress value={filledCount} max={totalSlots} indicatorClassName="bg-green-500" />
              <Text className="mt-1">
                {(totalSlots - filledCount) + " slots remaining"}
              </Text>
            </div>
          </div>
        </CardContent>
      </Card>

      {(data.drafted_ids || []).length > 0 && (
        <Text>{(data.drafted_ids || []).length} players drafted overall</Text>
      )}
    </div>
  );
}
