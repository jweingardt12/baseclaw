import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatBar } from "../stat-bar";

describe("StatBar", () => {
  it("renders bar with correct percentage width style", () => {
    const { container } = render(<StatBar value={50} max={100} />);
    const bar = container.querySelector("[style]") as HTMLElement;
    expect(bar).toBeInTheDocument();
    expect(bar.style.width).toBe("50%");
  });

  it("clamps to 100% when value exceeds max", () => {
    const { container } = render(<StatBar value={200} max={100} />);
    const bar = container.querySelector("[style]") as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("clamps to 0% when value is negative", () => {
    const { container } = render(<StatBar value={-10} max={100} />);
    const bar = container.querySelector("[style]") as HTMLElement;
    expect(bar.style.width).toBe("0%");
  });

  it("applies variant color class", () => {
    const { container } = render(<StatBar value={50} variant="success" />);
    const bar = container.querySelector("[style]") as HTMLElement;
    expect(bar.className).toContain("bg-sem-success");
  });

  it("applies custom barClassName", () => {
    const { container } = render(<StatBar value={50} barClassName="bg-purple-500" />);
    const bar = container.querySelector("[style]") as HTMLElement;
    expect(bar.className).toContain("bg-purple-500");
  });

  it("shows label when showLabel is true", () => {
    render(<StatBar value={75} max={100} showLabel={true} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("shows custom label text", () => {
    render(<StatBar value={75} max={100} showLabel={true} label="75th" />);
    expect(screen.getByText("75th")).toBeInTheDocument();
  });
});
