import { describe, expect, it } from "vitest";
import { hasReceiptAttachment, materialsAnswerRequiresReceipt } from "@/modules/crm/lib/materials";

describe("materials receipt helpers", () => {
  it("does not require a receipt when materials answer is no", () => {
    expect(
      materialsAnswerRequiresReceipt([
        { title: "Materials used?", notes: "No", status: "completed" },
      ]),
    ).toBe(false);
  });

  it("requires a receipt when materials answer is yes", () => {
    expect(
      materialsAnswerRequiresReceipt([
        { title: "Materials used?", notes: "Yes", status: "completed" },
      ]),
    ).toBe(true);
  });

  it("detects receipt attachments by type or filename", () => {
    expect(hasReceiptAttachment([{ file_type: "receipt", file_name: "upload.jpg" }])).toBe(true);
    expect(hasReceiptAttachment([{ file_type: "photo", file_name: "merchant-receipt.jpg" }])).toBe(true);
    expect(hasReceiptAttachment([{ file_type: "photo", file_name: "boiler.jpg" }])).toBe(false);
  });
});
