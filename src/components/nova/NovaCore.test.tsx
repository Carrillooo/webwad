import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NovaCore } from "./NovaCore";

// motion/react animates via rAF; jsdom renders the initial DOM fine.
describe("NovaCore", () => {
  it("renders an accessible activation button in idle", () => {
    render(<NovaCore level={0} onActivate={() => {}} />);
    expect(screen.getByRole("button", { name: /Hablar con NOVA/ })).toBeInTheDocument();
    expect(screen.getByText("Pulsa para hablar")).toBeInTheDocument();
  });

  it("invokes onActivate when clicked", () => {
    const onActivate = vi.fn();
    render(<NovaCore level={0} onActivate={onActivate} />);
    screen.getByRole("button", { name: /Hablar con NOVA/ }).click();
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
