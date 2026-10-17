import {
  forgetSubscriptionId,
  getSubscriptionId,
  peekSubscriptionId,
} from "@/src/pattern/data/SubscriptionStorage";

describe("SubscriptionStorage", () => {
  it("mints one id per list and keeps it", async () => {
    const first = await getSubscriptionId("ABCD1234");
    expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await getSubscriptionId("ABCD1234")).toBe(first);
    expect(await getSubscriptionId("WXYZ9876")).not.toBe(first);
  });

  it("peeks without minting", async () => {
    expect(await peekSubscriptionId("ABCD1234")).toBeNull();
    const id = await getSubscriptionId("ABCD1234");
    expect(await peekSubscriptionId("ABCD1234")).toBe(id);
  });

  it("forgets one list's id and keeps the others", async () => {
    await getSubscriptionId("ABCD1234");
    const other = await getSubscriptionId("WXYZ9876");
    await forgetSubscriptionId("ABCD1234");
    expect(await peekSubscriptionId("ABCD1234")).toBeNull();
    expect(await peekSubscriptionId("WXYZ9876")).toBe(other);
  });

  it("mints a new id after forgetting, so a resubscription counts afresh", async () => {
    const before = await getSubscriptionId("ABCD1234");
    await forgetSubscriptionId("ABCD1234");
    expect(await getSubscriptionId("ABCD1234")).not.toBe(before);
  });
});
