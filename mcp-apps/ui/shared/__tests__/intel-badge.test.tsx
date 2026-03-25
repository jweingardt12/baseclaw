import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntelBadge } from "../intel-badge";

describe("IntelBadge", () => {
  it("returns null when intel is null", () => {
    const { container } = render(<IntelBadge intel={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when intel is undefined", () => {
    const { container } = render(<IntelBadge intel={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when no tier and no hot_cold", () => {
    const { container } = render(<IntelBadge intel={{ statcast: {}, trends: {} }} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders tier badge with correct color class", () => {
    render(<IntelBadge intel={{ statcast: { quality_tier: "elite" } }} />);
    const badge = screen.getByText("elite");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-primary");
  });

  it("renders hot/cold icon with correct color class", () => {
    const { container } = render(<IntelBadge intel={{ trends: { hot_cold: "hot" } }} />);
    const icon = container.querySelector(".text-red-500");
    expect(icon).toBeInTheDocument();
    expect(icon!.textContent).toBe("\u{1F525}");
  });

  it("renders both tier and hot/cold when present", () => {
    const { container } = render(
      <IntelBadge intel={{ statcast: { quality_tier: "strong" }, trends: { hot_cold: "cold" } }} />
    );
    expect(screen.getByText("strong")).toBeInTheDocument();
    const icons = container.querySelectorAll(".text-blue-400");
    expect(icons.length).toBeGreaterThan(0);
  });
});
