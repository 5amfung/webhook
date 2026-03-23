// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MethodBadge } from "../../src/components/method-badge"

describe("MethodBadge", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the method text", () => {
    render(<MethodBadge method="GET" />)
    expect(screen.getByText("GET")).toBeDefined()
  })

  it("applies specific styles for known HTTP methods", () => {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
    const expectedColors = ["emerald", "blue", "amber", "orange", "red"]

    methods.forEach((method, i) => {
      render(<MethodBadge method={method} />)
      const badge = screen.getByText(method)
      expect(badge.className).toContain(expectedColors[i])
      cleanup()
    })
  })

  it("falls back to gray style for unknown methods", () => {
    render(<MethodBadge method="OPTIONS" />)
    const badge = screen.getByText("OPTIONS")
    expect(badge.className).toContain("gray")
  })
})
