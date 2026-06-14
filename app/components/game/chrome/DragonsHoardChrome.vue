<script setup lang="ts">
// Dragon hoard surround for Dragon's Hoard. Decorative only.
</script>

<template>
  <div class="dragons">
    <div class="ring" />
    <!-- SVG scale arcs along the sides -->
    <svg
      class="scales left-scales"
      viewBox="0 0 20 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <ellipse cx="10" cy="20"  rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.5" />
      <ellipse cx="10" cy="46"  rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.45" />
      <ellipse cx="10" cy="72"  rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.4" />
      <ellipse cx="10" cy="98"  rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.4" />
      <ellipse cx="10" cy="124" rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.45" />
      <ellipse cx="10" cy="150" rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.5" />
      <ellipse cx="10" cy="176" rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.4" />
    </svg>
    <svg
      class="scales right-scales"
      viewBox="0 0 20 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <ellipse cx="10" cy="20"  rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.5" />
      <ellipse cx="10" cy="46"  rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.45" />
      <ellipse cx="10" cy="72"  rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.4" />
      <ellipse cx="10" cy="98"  rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.4" />
      <ellipse cx="10" cy="124" rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.45" />
      <ellipse cx="10" cy="150" rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.5" />
      <ellipse cx="10" cy="176" rx="9" ry="12" fill="none" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.4" />
    </svg>
    <!-- Dragon at top-center with softly flickering flame -->
    <span class="dragon">🐲</span>
    <span class="flame">🔥</span>
    <!-- Coin row along the bottom -->
    <div class="coins">
      <span class="coin">🪙</span>
      <span class="coin">🪙</span>
      <span class="coin">🪙</span>
      <span class="coin">🪙</span>
      <span class="coin">🪙</span>
    </div>
    <!-- Title plate -->
    <span class="plate">DRAGON'S HOARD</span>
  </div>
</template>

<style scoped>
.dragons { position: absolute; inset: 0; overflow: hidden; border-radius: 1.25rem; }

.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow:
    0 0 0 3px #071207 inset,
    0 0 0 7px color-mix(in srgb, var(--chrome-accent) 60%, #0a200a) inset,
    0 0 26px color-mix(in srgb, var(--chrome-accent) 45%, transparent) inset;
  animation: dh-ring 5s ease-in-out infinite;
}

/* Scale arcs on the sides */
.scales {
  position: absolute;
  top: 20px;
  bottom: 20px;
  width: 18px;
}
.left-scales  { left: 2px; }
.right-scales { right: 2px; }

/* Dragon + flame at top-center */
.dragon {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 28px;
  filter: drop-shadow(0 2px 4px #000);
  animation: dh-bob 5s ease-in-out infinite;
}

.flame {
  position: absolute;
  top: 8px;
  left: calc(50% + 14px);
  font-size: 16px;
  animation: dh-flame 2.8s ease-in-out infinite;
}

/* Coin row */
.coins {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
}
.coin {
  font-size: 14px;
  display: block;
  animation: dh-shimmer 3.5s ease-in-out infinite;
}
.coin:nth-child(2) { animation-delay: .7s; }
.coin:nth-child(3) { animation-delay: 1.4s; }
.coin:nth-child(4) { animation-delay: 2.1s; }
.coin:nth-child(5) { animation-delay: 2.8s; }

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
  text-shadow: 0 0 8px var(--chrome-accent);
}

/* Subtle keyframes */
@keyframes dh-ring    { 0%, 100% { filter: brightness(1);    } 50% { filter: brightness(1.1); } }
@keyframes dh-bob     { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-2px); } }
@keyframes dh-flame   { 0%, 100% { opacity: .7; } 50% { opacity: 1; } }
@keyframes dh-shimmer { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
</style>
