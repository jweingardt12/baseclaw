import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders title text", () => {
    render(<EmptyState title="No players found" />);
    expect(screen.getByText("No players found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Try a different search" />);
    expect(screen.getByText("Try a different search")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: "Retry", onClick }} />);
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("calls onClick when action button clicked", () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: "Retry", onClick }} />);
    fireEvent.click(screen.getByText("Retry"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
