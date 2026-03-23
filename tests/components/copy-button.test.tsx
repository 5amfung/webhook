// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CopyButton } from "../../src/components/copy-button"

describe("CopyButton", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("renders a button", () => {
    render(<CopyButton value="test" />)
    expect(screen.getByRole("button")).toBeDefined()
  })

  it("copies value to clipboard on click", async () => {
    // userEvent.setup() installs a clipboard stub on navigator.clipboard.
    // We spy on the stub's writeText after setup() to capture calls.
    const user = userEvent.setup()
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)

    render(<CopyButton value="hello world" />)
    await user.click(screen.getByRole("button"))
    expect(writeTextSpy).toHaveBeenCalledWith("hello world")
  })

  it("shows check icon after copying", async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)

    render(<CopyButton value="test" />)
    const button = screen.getByRole("button")

    // Before click: Copy icon (no check icon).
    expect(button.querySelector(".lucide-copy")).toBeDefined()

    await user.click(button)

    // After click: Check icon appears.
    expect(button.querySelector(".lucide-check")).toBeDefined()
  })

  it("reverts to copy icon after 2000ms", async () => {
    vi.useFakeTimers()
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)

    render(<CopyButton value="test" />)

    // Use fireEvent (synchronous) to avoid userEvent timer deadlocks under fake timers.
    await act(() => {
      fireEvent.click(screen.getByRole("button"))
    })

    // Check icon should be visible.
    expect(screen.getByRole("button").querySelector(".lucide-check")).toBeDefined()

    // Advance past the feedback timeout, wrapped in act() to flush React state updates.
    await act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Copy icon should be back.
    expect(screen.getByRole("button").querySelector(".lucide-copy")).toBeDefined()
  })
})
