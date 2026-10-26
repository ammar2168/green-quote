// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QuoteForm } from "./quote-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderForm() {
  render(
    <QuoteForm
      defaults={{ fullName: "Ada Lovelace", email: "ada@example.com" }}
    />,
  );

  return userEvent.setup();
}

async function fillValidQuote(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Address"), "12 St James's Square");
  await user.type(screen.getByLabelText("Monthly consumption"), "500");
  await user.type(screen.getByLabelText("System size"), "5");
  await user.type(screen.getByLabelText("Down payment (optional)"), "1000");
}

const submitButton = () =>
  screen.getByRole("button", { name: /pre-qualification|calculating/i });

describe("QuoteForm", () => {
  it("opens the saved quote, and is ready for another when you come back", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ id: "quote-1" }, { status: 201 }),
    );
    const user = renderForm();

    await fillValidQuote(user);
    await user.click(submitButton());

    expect(push).toHaveBeenCalledWith("/quotes/quote-1");
    // The regression: the button stayed on "Calculating…" for good, so a
    // second quote could not be submitted after navigating back.
    expect(submitButton()).toHaveProperty("disabled", false);
    expect(submitButton().textContent).toBe("Get pre-qualification");
    // Cleared for the next quote, keeping what comes from the account.
    expect(screen.getByLabelText("Address")).toHaveProperty("value", "");
    expect(screen.getByLabelText("System size")).toHaveProperty("value", "");
    expect(screen.getByLabelText("Full name")).toHaveProperty(
      "value",
      "Ada Lovelace",
    );
  });

  it("shows Calculating… and cannot be resubmitted while saving", async () => {
    let respond!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    const user = renderForm();

    await fillValidQuote(user);
    await user.click(submitButton());

    expect(submitButton().textContent).toBe("Calculating…");
    expect(submitButton()).toHaveProperty("disabled", true);

    respond(Response.json({ id: "quote-1" }, { status: 201 }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("shows field errors without calling the API, keeping what was typed", async () => {
    const user = renderForm();

    await fillValidQuote(user);
    await user.clear(screen.getByLabelText("System size"));
    await user.type(screen.getByLabelText("System size"), "1000");
    await user.click(submitButton());

    expect(
      screen.getByText("System size must be 100 kW or less."),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("System size")).toHaveProperty(
      "value",
      "1000",
    );
    expect(submitButton()).toHaveProperty("disabled", false);
  });

  it("explains a failed request and lets you try again", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = renderForm();

    await fillValidQuote(user);
    await user.click(submitButton());

    expect(screen.getByText(/could not save your quote/i)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(submitButton()).toHaveProperty("disabled", false);
    expect(screen.getByLabelText("Address")).toHaveProperty(
      "value",
      "12 St James's Square",
    );
  });
});
