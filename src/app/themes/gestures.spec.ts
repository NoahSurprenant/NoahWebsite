import { pointer } from '../testing/pointer';
import { Gestures } from './gestures';

describe('Gestures', () => {
  function setUp() {
    const element = document.createElement('div');
    const handlers = { press: vi.fn(), drag: vi.fn(), pinch: vi.fn(), tap: vi.fn(), release: vi.fn() };
    const gestures = new Gestures(element, handlers);
    const send = (type: string, options: Parameters<typeof pointer>[1]) => element.dispatchEvent(pointer(type, options));
    return { element, handlers, gestures, send };
  }

  it('reports a drag as the moves between pointer events, and the press and release around it', () => {
    const { handlers, send } = setUp();
    send('pointerdown', { x: 10, y: 10 });
    expect(handlers.press).toHaveBeenCalledOnce();
    send('pointermove', { x: 15, y: 8 });
    send('pointermove', { x: 30, y: 8 });
    expect(handlers.drag.mock.calls.map(([dx, dy]) => [dx, dy])).toEqual([[5, -2], [15, 0]]);
    send('pointerup', { x: 30, y: 8, time: 100 });
    expect(handlers.release).toHaveBeenCalledOnce();
    // It moved too far to be a tap
    expect(handlers.tap).not.toHaveBeenCalled();
  });

  it('keeps the pointer while it is down, so a drag can leave the element', () => {
    const { element, send } = setUp();
    element.setPointerCapture = vi.fn();
    send('pointerdown', { id: 7 });
    expect(element.setPointerCapture).toHaveBeenCalledWith(7);
  });

  it('calls a quick press in one spot a tap, but not a long one', () => {
    const { handlers, send } = setUp();
    send('pointerdown', { x: 10, y: 10, time: 0 });
    send('pointermove', { x: 13, y: 12, time: 50 });
    send('pointerup', { x: 13, y: 12, time: 150 });
    expect(handlers.tap).toHaveBeenCalledOnce();

    send('pointerdown', { time: 1000 });
    send('pointerup', { time: 2000 });
    expect(handlers.tap).toHaveBeenCalledOnce();
  });

  it('reports two pointers moving apart or together as a pinch, never as a drag or tap', () => {
    const { handlers, send } = setUp();
    send('pointerdown', { id: 1, x: 100, y: 100 });
    send('pointerdown', { id: 2, x: 200, y: 100 });
    // Only ever pressed once
    expect(handlers.press).toHaveBeenCalledOnce();
    send('pointermove', { id: 2, x: 300, y: 100 });
    expect(handlers.pinch).toHaveBeenLastCalledWith(2);
    send('pointermove', { id: 1, x: 200, y: 100 });
    expect(handlers.pinch).toHaveBeenLastCalledWith(0.5);
    expect(handlers.drag).not.toHaveBeenCalled();

    // Lifting one finger isn't the release; the other one drags on
    send('pointerup', { id: 2, x: 300, y: 100 });
    expect(handlers.release).not.toHaveBeenCalled();
    send('pointermove', { id: 1, x: 210, y: 100 });
    expect(handlers.drag).toHaveBeenCalledOnce();
    send('pointerup', { id: 1, x: 210, y: 100 });
    expect(handlers.release).toHaveBeenCalledOnce();
    expect(handlers.tap).not.toHaveBeenCalled();
  });

  it('skips a pinch from two pointers in the same spot, which has no size to scale', () => {
    const { handlers, send } = setUp();
    send('pointerdown', { id: 1, x: 100, y: 100 });
    send('pointerdown', { id: 2, x: 100, y: 100 });
    send('pointermove', { id: 2, x: 150, y: 100 });
    expect(handlers.pinch).not.toHaveBeenCalled();
  });

  it('ignores other mouse buttons, and pointers it never saw go down', () => {
    const { handlers, send } = setUp();
    send('pointerdown', { button: 2 });
    send('pointermove', { x: 50 });
    send('pointerup', { x: 50 });
    send('pointercancel', {});
    expect(Object.values(handlers).every(handler => handler.mock.calls.length === 0)).toBe(true);
  });

  it('ends the gesture without a tap when the browser takes the pointer away', () => {
    const { handlers, send } = setUp();
    send('pointerdown', {});
    send('pointercancel', {});
    expect(handlers.release).toHaveBeenCalledOnce();
    expect(handlers.tap).not.toHaveBeenCalled();
  });

  it('works with only some of the handlers', () => {
    const element = document.createElement('div');
    new Gestures(element, {});
    for (const [type, id, x] of [['pointerdown', 1, 0], ['pointermove', 1, 20], ['pointerdown', 2, 50], ['pointermove', 2, 90], ['pointerup', 2, 90], ['pointerup', 1, 20]] as const) {
      element.dispatchEvent(pointer(type, { id, x }));
    }
    element.dispatchEvent(pointer('pointerdown'));
    expect(element.dispatchEvent(pointer('pointerup'))).toBe(true);
  });

  it('stops listening when disposed', () => {
    const { handlers, gestures, send } = setUp();
    gestures.dispose();
    send('pointerdown', {});
    send('pointerup', {});
    send('pointermove', {});
    send('pointercancel', {});
    expect(handlers.press).not.toHaveBeenCalled();
  });
});
