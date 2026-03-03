import { describe, it, expect } from "vitest";
import { render } from "@testing-library/preact";
import { Card, CardContent, CardHeader, CardTitle } from "../card";

describe("Card", () => {
  it("uses command-center card shell styling", () => {
    var { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    );

    var card = container.querySelector("div");
    expect(card?.className).toContain("rounded-xl");
    expect(card?.className).toContain("bg-card");
  });
});
