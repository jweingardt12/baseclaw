import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TradeEvalView } from "../trade-eval-view";

describe("TradeEvalView", () => {
  it("does not crash when numeric fields are missing", () => {
    render(<TradeEvalView data={{} as any} />);
    expect(screen.getByText("Trade Evaluation")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getAllByText("+0.0").length).toBeGreaterThan(0);
  });

  it("renders player value safely when value is a string", () => {
    render(
      <TradeEvalView
        data={{
          give_players: [{ name: "Player A", value: "1.37" as any }],
          get_players: [{ name: "Player B", value: 0.3 }],
          give_value: 1.2 as any,
          get_value: 0.8,
          net_value: 0.4,
          grade: "B",
        }}
      />
    );

    expect(screen.getByText("z=1.4")).toBeInTheDocument();
  });
});
