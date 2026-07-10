<script setup lang="ts">
// Carnival-neon marquee surround for Wonder Wheel. Decorative only.
</script>

<template>
  <div class="ww">
    <div class="ring" />
    <!-- bulb arch across the top -->
    <div
      class="arch"
      aria-hidden="true"
    >
      <span
        v-for="b in 13"
        :key="b"
        class="arch-bulb"
        :style="{ animationDelay: `${(b % 3) * 0.5}s` }"
      />
    </div>
    <!-- neon side piping -->
    <div class="pipe pipe-left" />
    <div class="pipe pipe-right" />
    <!-- corner starbursts -->
    <svg
      class="burst burst-tl"
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <path
        d="M20 2l3.4 11 11.2 1-8.8 7 3 11-8.8-6.6L11.2 32l3-11-8.8-7 11.2-1z"
        fill="var(--chrome-accent)"
        opacity="0.85"
      />
    </svg>
    <svg
      class="burst burst-br"
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <path
        d="M20 2l3.4 11 11.2 1-8.8 7 3 11-8.8-6.6L11.2 32l3-11-8.8-7 11.2-1z"
        fill="var(--chrome-secondary)"
        opacity="0.85"
      />
    </svg>
    <span class="plate">🎡 WONDER WHEEL 🎡</span>
  </div>
</template>

<style scoped>
.ww { position: absolute; inset: 0; overflow: hidden; border-radius: 1.25rem; }

.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  border: 3px solid #7c3aed;
  box-shadow:
    inset 0 0 26px rgba(124, 58, 237, 0.35),
    0 0 18px rgba(236, 72, 153, 0.35);
}

.arch {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
}
.arch-bulb {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff6c8, #fbbf24 45%, #b45309);
  box-shadow: 0 0 6px #fbbf24;
  animation: ww-tw 1.5s infinite alternate;
}
@keyframes ww-tw {
  from { opacity: 0.35; }
  to { opacity: 1; }
}

.pipe {
  position: absolute;
  top: 18px;
  bottom: 18px;
  width: 4px;
  border-radius: 4px;
}
.pipe-left {
  left: 5px;
  background: linear-gradient(180deg, #ec4899, #06b6d4);
  box-shadow: 0 0 10px rgba(236, 72, 153, 0.7);
}
.pipe-right {
  right: 5px;
  background: linear-gradient(180deg, #06b6d4, #ec4899);
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.7);
}

.burst { position: absolute; width: 30px; height: 30px; }
.burst-tl { top: 10px; left: 12px; }
.burst-br { bottom: 10px; right: 12px; }

.plate {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  font-family: ui-monospace, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: #f5d0fe;
  text-shadow: 0 0 8px rgba(236, 72, 153, 0.8);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .arch-bulb { animation: none; opacity: 1; }
}
</style>
