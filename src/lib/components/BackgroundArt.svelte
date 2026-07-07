<!-- Decorative animated brush strokes behind the app content. -->
<div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
  <svg
    class="h-full w-full"
    viewBox="0 0 1440 900"
    fill="none"
    preserveAspectRatio="xMidYMid slice"
  >
    <defs>
      <linearGradient id="tp-g1" x1="0" y1="0" x2="1" y2="0.3">
        <stop offset="0" stop-color="#3b82f6" />
        <stop offset="1" stop-color="#8b5cf6" />
      </linearGradient>
      <linearGradient id="tp-g2" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#8b5cf6" />
        <stop offset="1" stop-color="#ec4899" />
      </linearGradient>
      <linearGradient id="tp-g3" x1="0" y1="0" x2="1" y2="-0.2">
        <stop offset="0" stop-color="#14b8a6" />
        <stop offset="1" stop-color="#3b82f6" />
      </linearGradient>
    </defs>
    <path
      class="stroke-anim"
      style="animation-duration: 26s"
      d="M -80 180 C 260 60, 480 320, 820 240 S 1280 120, 1560 260"
      stroke="url(#tp-g1)"
      stroke-width="3"
      stroke-linecap="round"
    />
    <path
      class="stroke-anim"
      style="animation-duration: 38s; animation-delay: -12s"
      d="M -60 640 C 320 780, 620 520, 940 620 S 1360 760, 1540 600"
      stroke="url(#tp-g2)"
      stroke-width="4"
      stroke-linecap="round"
    />
    <path
      class="stroke-anim"
      style="animation-duration: 31s; animation-delay: -20s"
      d="M 1520 60 C 1180 220, 980 40, 700 160 S 220 340, -100 240"
      stroke="url(#tp-g3)"
      stroke-width="2.5"
      stroke-linecap="round"
    />
  </svg>
</div>

<style>
  .stroke-anim {
    stroke-dasharray: 620 2380;
    opacity: 0.35;
    animation-name: tp-draw;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }

  :global(html.dark) .stroke-anim {
    opacity: 0.22;
  }

  @keyframes tp-draw {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: -3000;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stroke-anim {
      animation: none;
      stroke-dasharray: none;
      opacity: 0.15;
    }
  }
</style>
