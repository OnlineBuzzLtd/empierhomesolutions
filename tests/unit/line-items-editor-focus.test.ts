// @vitest-environment jsdom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LineItemsEditor } from "@/modules/crm/components/forms/LineItemsEditor";

// Regression: rows were keyed on their description, so every keystroke in the
// Description box re-mounted the row and threw the cursor out of the input.
// Staff had to click back into the box after each letter on a new quote.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function descriptionInputs(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[placeholder="Description"]'));
}

describe("LineItemsEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps the description input focused while typing", () => {
    act(() => root.render(createElement(LineItemsEditor, { name: "line_items" })));

    let input = descriptionInputs(container)[0];
    input.focus();

    for (const next of ["B", "Bo", "Boi", "Boiler"]) {
      act(() => typeInto(input, next));
      const current = descriptionInputs(container)[0];
      expect(current).toBe(input);
      expect(document.activeElement).toBe(input);
      input = current;
    }

    expect(input.value).toBe("Boiler");
    const hidden = container.querySelector<HTMLInputElement>('input[name="line_items"]')!;
    expect(JSON.parse(hidden.value)[0].description).toBe("Boiler");
  });

  it("keeps focus on the right row when several lines exist", () => {
    act(() =>
      root.render(
        createElement(LineItemsEditor, {
          name: "line_items",
          initialItems: [
            { description: "Boiler", qty: 1, unit_price: 2000 },
            { description: "Flush", qty: 1, unit_price: 300 },
          ],
        }),
      ),
    );

    const second = descriptionInputs(container)[1];
    second.focus();
    act(() => typeInto(second, "Flushing"));

    expect(descriptionInputs(container)[1]).toBe(second);
    expect(document.activeElement).toBe(second);
    expect(descriptionInputs(container).map((i) => i.value)).toEqual(["Boiler", "Flushing"]);
  });
});
