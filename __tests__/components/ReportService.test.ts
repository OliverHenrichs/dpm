import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { reportList } from "@/src/firebase/ReportService";

jest.mock("@/src/firebase/firebaseConfig", () => ({
  firebaseAvailable: true,
  db: {},
  APP_TOKEN: "test-token",
  REPORTS: "reports",
}));

jest.mock("@/src/firebase/auth", () => ({
  ensureSignedIn: jest.fn(async () => "reporter-uid"),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db: unknown, ...path: string[]) => path.join("/")),
  setDoc: jest.fn(async () => undefined),
  serverTimestamp: jest.fn(() => "now"),
}));

describe("reportList", () => {
  it("writes one report per list and reporter, as the rules accept it", async () => {
    await reportList("AB12CD34", "child", "  Pattern 2  ", "me@example.com");

    expect(doc).toHaveBeenCalledWith({}, "reports", "AB12CD34_reporter-uid");
    expect(setDoc).toHaveBeenCalledWith("reports/AB12CD34_reporter-uid", {
      shareCode: "AB12CD34",
      reporterUid: "reporter-uid",
      reason: "child",
      details: "Pattern 2",
      contact: "me@example.com",
      createdAt: serverTimestamp(),
      appToken: "test-token",
    });
  });

  it("leaves out empty details and contact", async () => {
    await reportList("AB12CD34", "spam", "   ", "");

    const data = (setDoc as jest.Mock).mock.calls[0][1];
    expect(data).not.toHaveProperty("details");
    expect(data).not.toHaveProperty("contact");
  });
});
