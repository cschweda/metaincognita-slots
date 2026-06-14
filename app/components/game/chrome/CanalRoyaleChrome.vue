<script setup lang="ts">
// Baroque carnival-gold surround for Canal Royale. Decorative only.
</script>

<template>
  <div class="canal">
    <div class="ring" />
    <!-- Gold side rails: fluted gradient bars left and right -->
    <div class="rail rail-left" />
    <div class="rail rail-right" />
    <!-- SVG scrollwork curls at each corner -->
    <svg
      class="scrollwork top-left"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 46 C2 24 12 12 24 10 C32 8 42 14 42 26 C42 36 34 40 26 36 C18 32 20 22 28 22 C34 22 36 28 32 30"
        stroke="var(--chrome-glow)"
        stroke-width="2.5"
        stroke-linecap="round"
        opacity="0.75"
      />
    </svg>
    <svg
      class="scrollwork top-right"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M46 46 C46 24 36 12 24 10 C16 8 6 14 6 26 C6 36 14 40 22 36 C30 32 28 22 20 22 C14 22 12 28 16 30"
        stroke="var(--chrome-glow)"
        stroke-width="2.5"
        stroke-linecap="round"
        opacity="0.75"
      />
    </svg>
    <svg
      class="scrollwork bottom-left"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 2 C2 24 12 36 24 38 C32 40 42 34 42 22 C42 12 34 8 26 12 C18 16 20 26 28 26 C34 26 36 20 32 18"
        stroke="var(--chrome-glow)"
        stroke-width="2"
        stroke-linecap="round"
        opacity="0.5"
      />
    </svg>
    <svg
      class="scrollwork bottom-right"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M46 2 C46 24 36 36 24 38 C16 40 6 34 6 22 C6 12 14 8 22 12 C30 16 28 26 20 26 C14 26 12 20 16 18"
        stroke="var(--chrome-glow)"
        stroke-width="2"
        stroke-linecap="round"
        opacity="0.5"
      />
    </svg>
    <!-- Masquerade masks at top corners -->
    <span class="mask mask-left">🎭</span>
    <span class="mask mask-right">🎭</span>
    <!-- Title plate -->
    <span class="plate">★ CANAL ROYALE ★</span>
  </div>
</template>

<style scoped>
.canal { position: absolute; inset: 0; overflow: hidden; border-radius: 1.25rem; }

.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow:
    0 0 0 3px #2a1e08 inset,
    0 0 0 7px color-mix(in srgb, var(--chrome-accent) 70%, #1a1000) inset,
    0 0 28px color-mix(in srgb, var(--chrome-glow) 50%, transparent) inset;
  animation: cr-ring 4s ease-in-out infinite;
}

/* Fluted side rails — narrow gradient bars along the edges */
.rail {
  position: absolute;
  top: 16px;
  bottom: 16px;
  width: 10px;
  border-radius: 5px;
  background: repeating-linear-gradient(
    to bottom,
    color-mix(in srgb, var(--chrome-glow) 80%, transparent) 0%,
    color-mix(in srgb, var(--chrome-accent) 40%, transparent) 40%,
    color-mix(in srgb, var(--chrome-glow) 60%, transparent) 60%,
    color-mix(in srgb, var(--chrome-accent) 30%, transparent) 100%
  );
  opacity: 0.6;
}
.rail-left  { left: 4px; }
.rail-right { right: 4px; }

/* SVG scrollwork corners */
.scrollwork {
  position: absolute;
  width: 48px;
  height: 48px;
}
.scrollwork.top-left     { top: 0;    left: 0; }
.scrollwork.top-right    { top: 0;    right: 0; }
.scrollwork.bottom-left  { bottom: 0; left: 0; }
.scrollwork.bottom-right { bottom: 0; right: 0; }

/* Masquerade masks */
.mask {
  position: absolute;
  top: 4px;
  font-size: 24px;
  filter: drop-shadow(0 2px 4px #0008);
  animation: cr-bob 5s ease-in-out infinite;
}
.mask-left  { left: 52px; }
.mask-right { right: 52px; animation-delay: .55s; }

/* Title plate */
.plate {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--chrome-glow);
  font: 900 11px ui-monospace, monospace;
  letter-spacing: .18em;
  text-shadow:
    0 0 8px var(--chrome-accent),
    0 0 18px color-mix(in srgb, var(--chrome-glow) 60%, transparent);
  animation: cr-plate 5s ease-in-out infinite;
}

/* Subtle keyframes */
@keyframes cr-ring  { 0%, 100% { filter: brightness(1);    } 50% { filter: brightness(1.1); } }
@keyframes cr-bob   { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes cr-plate { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }
</style>
