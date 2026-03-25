import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntelPanel } from "../intel-panel";
import type { PlayerIntel } from "../intel-badge";

const FULL_INTEL: PlayerIntel = {
  statcast: {
    barrel_pct_rank: 85,
    ev_pct_rank: 90,
    avg_exit_velo: 91.2,
    quality_tier: "elite",
  },
  trends: {
    last_14_days: { AVG: ".320", HR: 4 },
    hot_cold: "hot",
  },
};

describe("IntelPanel", () => {
  it("returns null when no data sections have content", () => {
    const { container } = render(<IntelPanel intel={{}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders collapsed state with Intel label", () => {
    render(<IntelPanel intel={FULL_INTEL} />);
    expect(screen.getByText("Intel")).toBeInTheDocument();
  });

  it("renders chevron icon element in toggle button", () => {
    const { container } = render(<IntelPanel intel={FULL_INTEL} />);
    const button = container.querySelector("button")!;
    expect(button.children.length).toBeGreaterThanOrEqual(1);
  });

  it("clicking toggle expands panel content", () => {
    const { container } = render(<IntelPanel intel={FULL_INTEL} />);
    const button = container.querySelector("button")!;
    fireEvent.click(button);
    expect(screen.getByText("Statcast")).toBeInTheDocument();
  });

  it("expanded content has animate-fade-in class", () => {
    const { container } = render(<IntelPanel intel={FULL_INTEL} />);
    const button = container.querySelector("button")!;
    fireEvent.click(button);
    const expandedDiv = container.querySelector(".animate-fade-in");
    expect(expandedDiv).toBeInTheDocument();
  });

  it("shows quality tier badge when present", () => {
    render(<IntelPanel intel={FULL_INTEL} />);
    expect(screen.getByText("elite")).toBeInTheDocument();
  });
});
