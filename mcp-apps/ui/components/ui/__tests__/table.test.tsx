import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table";

describe("Table", () => {
  it("renders with horizontal overflow wrapper classes", () => {
    var { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Column</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Value</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    var wrapper = container.querySelector("div");
    expect(wrapper?.className).toContain("overflow-x-auto");
    expect(screen.getByRole("table").className).toContain("w-full");
  });
});
