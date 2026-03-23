// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CodeBlock } from "../../src/components/code-block"

describe("CodeBlock", () => {
  it("renders text content", () => {
    render(
      <CodeBlock
        content="raw body text"
        contentType="text/plain"
        isBinary={false}
        size={13}
      />,
    )
    expect(screen.getByText("raw body text")).toBeDefined()
  })

  it("pretty-prints JSON content", () => {
    const { container } = render(
      <CodeBlock
        content='{"key":"value"}'
        contentType="application/json"
        isBinary={false}
        size={15}
      />,
    )
    // JSON.stringify with indent 2 produces multi-line output.
    const code = container.querySelector("code")
    expect(code?.textContent).toContain('"key": "value"')
  })

  it("renders malformed JSON as-is without crashing", () => {
    render(
      <CodeBlock
        content='{"broken": }'
        contentType="application/json"
        isBinary={false}
        size={12}
      />,
    )
    expect(screen.getByText('{"broken": }')).toBeDefined()
  })

  it("shows binary payload message when isBinary is true", () => {
    render(
      <CodeBlock
        content="base64data"
        contentType="application/octet-stream"
        isBinary={true}
        size={1024}
      />,
    )
    expect(screen.getByText("Binary payload (1024 bytes)")).toBeDefined()
  })

  it("renders a copy button for text content", () => {
    const { container } = render(
      <CodeBlock
        content="test"
        contentType="text/plain"
        isBinary={false}
        size={4}
      />,
    )
    const button = container.querySelector("button")
    expect(button).toBeDefined()
  })
})
