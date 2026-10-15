/**
 * A pointer event at the given spot and time. The time is set by hand: jsdom stamps events with
 * the real clock, and gestures care how long a press lasted.
 */
export function pointer(type: string, { id = 1, x = 0, y = 0, time = 0, button = 0 } = {}) {
  const event = new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, button, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'timeStamp', { value: time });
  return event;
}
