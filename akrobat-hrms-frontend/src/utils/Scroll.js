// A horizontally-scrollable strip (module filter chips, a wide table
// wrapped in overflow-x-auto) can trap an ordinary vertical mouse-wheel
// scroll — the browser tries to apply the wheel delta to that element's
// own scroll box, finds nothing to move (no vertical overflow there),
// and on some Windows/touchpad driver combinations swallows the event
// entirely instead of letting it bubble up to scroll the page. Attach
// this as onWheel on any overflow-x-auto container so a mostly-vertical
// gesture always scrolls the page, while a mostly-horizontal one (shift
// + wheel, or a trackpad swipe) still pans the strip as normal.
export function passVerticalWheel(e) {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    window.scrollBy(0, e.deltaY);
    e.preventDefault();
  }
}
