import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Suspense } from "react";
import { MOCK_DATA } from "../preview-app/mock-data";
import { VIEW_GROUPS } from "../preview-app/view-registry";

const noop = vi.fn();

for (const group of VIEW_GROUPS) {
  describe(group.name, () => {
    for (const view of group.views) {
      const mockData = MOCK_DATA[view.id];
      if (!mockData) {
        it.skip(view.id + " — no mock data");
        continue;
      }

      it("renders " + view.id + " without crashing", async () => {
        const Component = view.component;
        const extraProps = { ...(view.props || {}), app: null, navigate: noop };
        let container: HTMLElement;

        await act(async () => {
          const result = render(
            <Suspense fallback={<div>loading</div>}>
              <Component data={mockData} {...extraProps} />
            </Suspense>
          );
          container = result.container;
        });

        expect(container!.innerHTML).not.toBe("");
        expect(container!.textContent).not.toContain("View crashed");
      });
    }
  });
}
