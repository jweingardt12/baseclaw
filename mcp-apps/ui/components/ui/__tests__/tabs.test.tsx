import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/preact";
import { Tabs, TabsList, TabsTrigger } from "../tabs";

describe("Tabs", () => {
  it("uses default tabs list styling", () => {
    const { container } = render(
      <Tabs value="one" onValueChange={vi.fn()}>
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    var list = container.querySelector('[data-slot="tabs-list"]') as HTMLDivElement | null;
    expect(list?.className).toContain("inline-flex");
    expect(list?.className).toContain("bg-muted");
  });

  it("supports line variant styling", () => {
    const { container } = render(
      <Tabs value="one" onValueChange={vi.fn()}>
        <TabsList variant="line">
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    var list = container.querySelector('[data-slot="tabs-list"]') as HTMLDivElement | null;
    expect(list?.className).toContain("bg-transparent");
    expect(list?.getAttribute("data-variant")).toBe("line");
  });

  it("renders triggers with tab slot classes", () => {
    render(
      <Tabs defaultValue="one" onValueChange={vi.fn()}>
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    var trigger = screen.getByText("Two");
    expect(trigger.getAttribute("data-slot")).toBe("tabs-trigger");
    expect(trigger.className).toContain("rounded-md");
  });
});
