function appElement(app) {
  return app?.element instanceof HTMLElement ? app.element : app?.element?.[0] ?? null;
}

function viewportSize() {
  return {
    width: Math.max(360, globalThis.innerWidth ?? document.documentElement?.clientWidth ?? 960),
    height: Math.max(360, globalThis.innerHeight ?? document.documentElement?.clientHeight ?? 720)
  };
}

export function keepApplicationWindowScrollable(app, { minWidth = 420, minHeight = 320 } = {}) {
  const element = appElement(app);
  if (!element) return;

  const apply = () => {
    const margin = 8;
    const viewport = viewportSize();
    const rect = element.getBoundingClientRect();
    let top = Number.isFinite(rect.top) ? rect.top : margin;
    let left = Number.isFinite(rect.left) ? rect.left : margin;

    if (top < margin || top > viewport.height - minHeight) top = margin;
    if (left < margin || left > viewport.width - minWidth) left = margin;

    const fitHeight = Math.max(minHeight, viewport.height - top - margin);
    const fitWidth = Math.max(minWidth, viewport.width - left - margin);
    const currentHeight = Number.parseFloat(element.style.height) || rect.height || fitHeight;
    const currentWidth = Number.parseFloat(element.style.width) || rect.width || fitWidth;

    element.style.top = `${Math.round(top)}px`;
    element.style.left = `${Math.round(left)}px`;
    element.style.maxHeight = `${Math.round(fitHeight)}px`;
    element.style.maxWidth = `${Math.round(fitWidth)}px`;
    element.style.height = `${Math.round(Math.min(currentHeight, fitHeight))}px`;
    element.style.width = `${Math.round(Math.min(currentWidth, fitWidth))}px`;
    element.style.overflow = "hidden";

    const header = Array.from(element.children).find((child) => child.classList?.contains("window-header"));
    const chromeHeight = Math.ceil(header?.getBoundingClientRect?.().height || 34);
    const contentHeight = Math.max(180, fitHeight - chromeHeight);
    const content = element.querySelector(".window-content, .application-content") ?? element;
    content.style.minHeight = "0";
    content.style.maxHeight = `${contentHeight}px`;
    content.style.overflowX = "hidden";
    content.style.overflowY = "auto";
    content.style.display = "flex";
    content.style.flexDirection = "column";

    element.querySelectorAll("[data-application-part], .ced-shell, .ced-editor-layout, .ced-action-form").forEach((part) => {
      part.style.minHeight = "0";
      part.style.maxHeight = `${contentHeight}px`;
      part.style.overflowX = "hidden";
      part.style.overflowY = "auto";
    });
  };

  releaseApplicationWindowScrollable(app);
  apply();
  app._cedViewportConstraint = apply;
  globalThis.addEventListener?.("resize", apply);
}

export function releaseApplicationWindowScrollable(app) {
  if (!app?._cedViewportConstraint) return;
  globalThis.removeEventListener?.("resize", app._cedViewportConstraint);
  app._cedViewportConstraint = null;
}
