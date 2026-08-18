/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WEB3FORMS_ENDPOINT } from "@/lib/contact";
import { ToastProvider } from "@/lib/toast-context";
import { ContactForm } from "@/components/ContactForm";

const VALID_INPUT: Record<string, string> = {
  "Your name": "Ananya Iyer",
  Email: "ananya@example.com",
  Message: "Could you tell me the drop length of the Kundan Rani Haar?",
};

function ContactPage(): JSX.Element {
  return (
    <ToastProvider>
      <ContactForm />
    </ToastProvider>
  );
}

function fillValidForm(): void {
  for (const [label, value] of Object.entries(VALID_INPUT)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

async function submit(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  });
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
});

describe("validation", () => {
  it("reports every problem on submit and focuses the first", async () => {
    render(<ContactPage />);
    await submit();

    expect(screen.getByText("Enter a name")).toBeDefined();
    expect(screen.getByText("Enter an email address")).toBeDefined();
    expect(screen.getByText("Tell us how we can help")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText("Your name"));
  });

  it("does not flag the optional subject", async () => {
    render(<ContactPage />);
    await submit();

    expect(
      screen.queryByText(/Keep the subject under/),
    ).toBeNull();
  });

  it("never calls the endpoint on a failed submit", async () => {
    process.env.NEXT_PUBLIC_WEB3FORMS_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(<ContactPage />);
    await submit();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("without a Web3Forms key — the cosmetic branch", () => {
  it("says delivery is not connected rather than claiming a send", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(<ContactPage />);
    fillValidForm();
    await submit();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Message delivery is not connected yet"),
    ).toBeDefined();
    expect(screen.getByText(/it has not been sent/)).toBeDefined();
    expect(screen.queryByText("Message sent")).toBeNull();
  });

  it("offers the way back to the form", async () => {
    render(<ContactPage />);
    fillValidForm();
    await submit();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Back to the form" }));
    });

    expect(screen.getByLabelText("Your name")).toBeDefined();
  });
});

describe("with a Web3Forms key — the delivery branch", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_WEB3FORMS_KEY = "test-key";
  });

  it("posts the payload and confirms the send", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    render(<ContactPage />);
    fillValidForm();
    await submit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, requestInit] = fetchMock.mock.calls[0];
    expect(endpoint).toBe(WEB3FORMS_ENDPOINT);
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      access_key: "test-key",
      name: "Ananya Iyer",
      email: "ananya@example.com",
      subject: "New enquiry from the Morchadi Gems website",
      message: VALID_INPUT.Message,
    });

    expect(screen.getByRole("heading", { name: "Message sent" })).toBeDefined();
    expect(screen.queryByText("Message delivery is not connected yet")).toBeNull();
  });

  it("sends the subject when one was given", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    render(<ContactPage />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/Subject/), {
      target: { value: "Order enquiry" },
    });
    await submit();

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).subject).toBe(
      "Order enquiry",
    );
  });

  it("reports a rejected submission instead of a success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    render(<ContactPage />);
    fillValidForm();
    await submit();

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Message sent" })).toBeNull();
  });

  it("reports a network failure instead of a success", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    render(<ContactPage />);
    fillValidForm();
    await submit();

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Message sent" })).toBeNull();
  });
});
