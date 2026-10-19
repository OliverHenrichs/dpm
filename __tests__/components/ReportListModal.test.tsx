import React from "react";
import ReportListModal from "@/src/legal/components/ReportListModal";
import { reportList } from "@/src/firebase/ReportService";
import { createTestPatternList } from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

jest.mock("@/src/firebase/ReportService", () => ({
  reportList: jest.fn(),
}));

const mockedReport = reportList as jest.MockedFunction<typeof reportList>;

const LIST = createTestPatternList({
  name: "Thursday WCS",
  shareCode: "AB12CD34",
  readonly: true,
});

beforeEach(() => {
  mockedReport.mockResolvedValue(undefined);
});

function renderReport() {
  const onClose = jest.fn();
  renderWithProviders(<ReportListModal list={LIST} onClose={onClose} />, {
    activeListId: null,
  });
  return { onClose };
}

describe("ReportListModal", () => {
  it("sends nothing until a reason is chosen", () => {
    renderReport();
    fireEvent.press(screen.getByText("Send report"));
    expect(mockedReport).not.toHaveBeenCalled();
  });

  it("sends the reason, details and contact for the list's code", async () => {
    renderReport();
    fireEvent.press(screen.getByText("Endangers a child"));
    fireEvent.changeText(screen.getByLabelText("Details"), "Pattern 2");
    fireEvent.changeText(
      screen.getByLabelText("Your email (optional)"),
      "me@example.com",
    );
    fireEvent.press(screen.getByText("Send report"));

    expect(await screen.findByText("Report sent")).toBeOnTheScreen();
    expect(mockedReport).toHaveBeenCalledWith(
      "AB12CD34",
      "child",
      "Pattern 2",
      "me@example.com",
    );
  });

  it("closes after the confirmation", async () => {
    const { onClose } = renderReport();
    fireEvent.press(screen.getByText("Spam or misleading"));
    fireEvent.press(screen.getByText("Send report"));
    fireEvent.press(await screen.findByText("OK"));

    expect(onClose).toHaveBeenCalled();
  });

  it("says so when the report could not be sent, and keeps what was typed", async () => {
    mockedReport.mockRejectedValue(new Error("offline"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    renderReport();
    fireEvent.press(screen.getByText("Something else"));
    fireEvent.changeText(screen.getByLabelText("Details"), "Odd links");
    fireEvent.press(screen.getByText("Send report"));

    expect(
      await screen.findByText(
        "The report could not be sent. Check your connection and try again.",
      ),
    ).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByLabelText("Details").props.value).toBe("Odd links"),
    );
  });
});
