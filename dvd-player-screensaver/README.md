# DVD Screensaver

A dependency-free recreation of the classic bouncing DVD Video logo. It runs entirely in the browser and does not send data anywhere.

## Controls

- **Full Screen** or <kbd>F</kbd> toggles full-screen mode.
- **Change Color** or <kbd>C</kbd> advances to the next color scheme.
- **Pause** or <kbd>Space</kbd> pauses or resumes the animation.
- **Reset** or <kbd>R</kbd> restores the default color, speed, size, pause state, counter, and URL.
- The speed and logo-size sliders update the motion immediately.

The controls hide after a few seconds and return on pointer movement, touch, or keyboard input. Colors change only when requested, and the counter records near-simultaneous horizontal and vertical collisions as corner hits.

## Shareable settings

The controls keep these query parameters in the URL:

- `speed` — movement speed from `40` to `300` pixels per second
- `size` — logo size from `10` to `45` percent of the larger viewport dimension
- `scheme` — color-scheme index from `0` to `7`

Legacy `logo-color` and `background-color` parameters are also supported when they contain valid CSS colors. For example:

~~~text
?speed=140&size=22&scheme=3
?logo-color=cyan&background-color=navy
~~~

## Accessibility and motion

All actions are available through labeled buttons and keyboard shortcuts. Full-screen and pause states are announced to assistive technology. When `prefers-reduced-motion: reduce` is active, the animation is disabled and the logo is centered.

## Development

There is no build step. Serve the repository locally and open `/dvd-player-screensaver/`. For this repository's usual local server, use:

~~~text
http://localhost:8080/dvd-player-screensaver/
~~~
