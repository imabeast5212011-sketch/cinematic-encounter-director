function appElement(app) {
  return app?.element instanceof HTMLElement ? app.element : app?.element?.[0] ?? null;
}

function appWindowElement(app) {
  const element = appElement(app);
  const id = app?.options?.id ?? app?.id ?? "";
  const byId = id ? document.getElementById(id) : null;
  return element?.closest?.(".application, .window-app, .app")
    ?? byId?.closest?.(".application, .window-app, .app")
    ?? byId
    ?? element
    ?? null;
}

function viewportSize() {
  return {
    width: Math.max(360, globalThis.innerWidth ?? document.documentElement?.clientWidth ?? 960),
    height: Math.max(360, globalThis.innerHeight ?? document.documentElement?.clientHeight ?? 720)
  };
}

export function keepApplicationWindowScrollable(app, { minWidth = 420, minHeight = 320, fillWidth = false, fillHeight = false } = {}) {
  const element = appWindowElement(app);
  const rendered = appElement(app);
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
    const nextHeight = fillHeight ? fitHeight : Math.min(currentHeight, fitHeight);
    const nextWidth = fillWidth ? fitWidth : Math.min(currentWidth, fitWidth);

    try {
      app.setPosition?.({
        top: Math.round(top),
        left: Math.round(left),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight)
      });
    } catch (_error) {
      // Style fallback below handles Foundry builds without setPosition.
    }

    element.dataset.cedFitWindow = "true";
    element.style.top = `${Math.round(top)}px`;
    element.style.left = `${Math.round(left)}px`;
    element.style.maxHeight = `${Math.round(fitHeight)}px`;
    element.style.maxWidth = `${Math.round(fitWidth)}px`;
    element.style.height = `${Math.round(nextHeight)}px`;
    element.style.width = `${Math.round(nextWidth)}px`;
    element.style.overflow = "hidden";

    const header = Array.from(element.children).find((child) => child.classList?.contains("window-header"));
    const chromeHeight = Math.ceil(header?.getBoundingClientRect?.().height || 34);
    const contentHeight = Math.max(180, fitHeight - chromeHeight);
    const content = element.querySelector(".window-content, .application-content")
      ?? rendered?.closest?.(".window-content, .application-content")
      ?? rendered
      ?? element;
    content.style.minHeight = "0";
    content.style.maxHeight = `${contentHeight}px`;
    content.style.overflowX = "hidden";
    content.style.overflowY = "auto";
    content.style.display = "flex";
    content.style.flexDirection = "column";

    const scrollParts = new Set([
      ...element.querySelectorAll("[data-application-part], .ced-shell, .ced-editor-layout, .ced-action-form"),
      ...(rendered ? [rendered] : [])
    ]);
    scrollParts.forEach((part) => {
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
