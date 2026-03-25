import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheatsheetView } from "../cheatsheet-view";

describe("CheatsheetView", () => {
  it("renders normalized round labels and chips", () => {
    render(
      <CheatsheetView
        data={{
          strategy: {
            rounds_10_12: "Fill roster",
            rounds_13_plus: "Sleepers",
          },
          targets: {},
          avoid: [],
          opponents: [],
        }}
      />
    );

    expect(screen.getByText("Rounds 10-12")).toBeInTheDocument();
    expect(screen.queryByText("rounds_10_12")).not.toBeInTheDocument();
  });

  it("normalizes target section category labels", () => {
    render(
      <CheatsheetView
        data={{
          strategy: {},
          targets: {
            rounds_1_3: ["Shohei Ohtani"],
          },
          avoid: [],
          opponents: [],
        }}
      />
    );

    expect(screen.getByText("Rounds 1-3")).toBeInTheDocument();
  });
});
