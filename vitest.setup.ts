import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement window.focus and logs a noisy "Not implemented" stack
// trace whenever SandboxedPlayer focuses an iframe's contentWindow. Each iframe
// gets its own Window instance, so stub focus on whatever contentWindow returns.
if (typeof HTMLIFrameElement !== "undefined") {
  const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
  if (desc?.get) {
    Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
      ...desc,
      get(this: HTMLIFrameElement) {
        const win = desc.get!.call(this);
        if (win) win.focus = () => {};
        return win;
      },
    });
  }
}
