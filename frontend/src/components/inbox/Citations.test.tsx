import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Citation, Validation } from "@/lib/types";
import { CitationList, ValidationReport } from "./Citations";

afterEach(cleanup);

const base: Validation = {
  passed: true, invalid_citation_ids: [], unsupported_claims: [], unverified_numbers: [], ungrounded: false, retrieved_ids: ["D1-C001"], fact_ids: [],
};

describe("ValidationReport", () => {
  it("confirms a grounded draft", () => {
    render(<ValidationReport validation={base} insufficient={false} />);
    expect(screen.getByText(/Every claim traces/)).toBeTruthy();
  });

  it("lists every problem found by the backend check", () => {
    render(<ValidationReport validation={{ ...base, passed: false, invalid_citation_ids: ["D9-C999"], unverified_numbers: ["60"] }} insufficient={false} />);
    expect(screen.getByText(/Citation check found problems/)).toBeTruthy();
    expect(screen.getByText(/D9-C999/)).toBeTruthy();
    expect(screen.getByText(/Numbers not found in any source: 60/)).toBeTruthy();
  });

  it("explains insufficient evidence instead of pass/fail", () => {
    render(<ValidationReport validation={base} insufficient />);
    expect(screen.getByText(/doesn’t cover this/)).toBeTruthy();
  });
});

describe("CitationList", () => {
  const cites: Citation[] = [
    { id: "D1-C003", kind: "passage", document_id: 1, document_title: "Returns & Refunds Policy", section: "RR-3 Damaged", page: null, excerpt: "Report within 14 days.", score: 0.81 },
    { id: "ELIGIBILITY", kind: "fact", label: "Business-rule check", excerpt: "eligible=True" },
  ];

  it("shows sources and expands the exact passage on demand", () => {
    render(<CitationList citations={cites} />);
    expect(screen.getByText("Returns & Refunds Policy")).toBeTruthy();
    expect(screen.queryByText("Report within 14 days.")).toBeNull();
    fireEvent.click(screen.getByText("Returns & Refunds Policy"));
    expect(screen.getByText("Report within 14 days.")).toBeTruthy();
    expect(screen.getByText(/Verified by a tool call/)).toBeTruthy();
  });
});
