/**
 * "First light at sea" — the waitlist's living background.
 *
 * Original and asset-free: a dawn sky drawn from layered gradients, three
 * cloud banks drifting at different speeds (parallax), a slow breathing glow
 * where the sun is about to clear the horizon, and a faint shimmer on the
 * water below. Only transform/opacity animate, so it is GPU-composited and
 * cheap on phones. Under prefers-reduced-motion every layer holds still — the
 * composition is designed to be beautiful as a single frame.
 */
export function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      <div className="sky-base" />
      <div className="sky-cloud sky-cloud-far" />
      <div className="sky-cloud sky-cloud-mid" />
      <div className="sky-glow" />
      <div className="sky-cloud sky-cloud-near" />
      <div className="sky-sea">
        <div className="sky-shimmer" />
      </div>
      <div className="sky-vignette" />
    </div>
  );
}
