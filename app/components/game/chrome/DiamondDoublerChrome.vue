<script setup lang="ts">
// Ice-and-chrome surround for Diamond Doubler. The coldest, cleanest cabinet. Decorative only.
</script>

<template>
  <div class="diamond">
    <div class="ring" />
    <!-- Frosted facet polygons at each corner -->
    <svg
      class="facet facet-tl"
      viewBox="0 0 60 60"
      aria-hidden="true"
    >
      <polygon points="0,0 48,0 0,48"          fill="var(--chrome-glow)" opacity="0.08" />
      <polygon points="6,0 36,0 0,30"           fill="var(--chrome-secondary)" opacity="0.07" />
      <polygon points="0,0 48,0 24,24"          fill="none" stroke="var(--chrome-glow)" stroke-width="0.8" opacity="0.3" />
      <polygon points="6,0 36,0 18,18"          fill="none" stroke="var(--chrome-secondary)" stroke-width="0.6" opacity="0.2" />
    </svg>
    <svg
      class="facet facet-tr"
      viewBox="0 0 60 60"
      aria-hidden="true"
    >
      <polygon points="60,0 12,0 60,48"         fill="var(--chrome-glow)" opacity="0.08" />
      <polygon points="54,0 24,0 60,30"         fill="var(--chrome-secondary)" opacity="0.07" />
      <polygon points="60,0 12,0 36,24"         fill="none" stroke="var(--chrome-glow)" stroke-width="0.8" opacity="0.3" />
      <polygon points="54,0 24,0 42,18"         fill="none" stroke="var(--chrome-secondary)" stroke-width="0.6" opacity="0.2" />
    </svg>
    <svg
      class="facet facet-bl"
      viewBox="0 0 60 60"
      aria-hidden="true"
    >
      <polygon points="0,60 48,60 0,12"         fill="var(--chrome-glow)" opacity="0.07" />
      <polygon points="0,60 0,30 36,60"         fill="var(--chrome-secondary)" opacity="0.06" />
      <polygon points="0,60 48,60 24,36"        fill="none" stroke="var(--chrome-glow)" stroke-width="0.8" opacity="0.25" />
    </svg>
    <svg
      class="facet facet-br"
      viewBox="0 0 60 60"
      aria-hidden="true"
    >
      <polygon points="60,60 12,60 60,12"       fill="var(--chrome-glow)" opacity="0.07" />
      <polygon points="60,60 60,30 24,60"       fill="var(--chrome-secondary)" opacity="0.06" />
      <polygon points="60,60 12,60 36,36"       fill="none" stroke="var(--chrome-glow)" stroke-width="0.8" opacity="0.25" />
    </svg>
    <!-- Restrained sparkle dots -->
    <span class="sparkle s1" />
    <span class="sparkle s2" />
    <span class="sparkle s3" />
    <span class="sparkle s4" />
    <!-- Prismatic gleam sweep across the ring top -->
    <div class="gleam" />
    <!-- Title plate -->
    <span class="plate">DIAMOND DOUBLER</span>
  </div>
</template>

<style scoped>
.diamond { position: absolute; inset: 0; overflow: hidden; border-radius: 1.25rem; }

/* Ice-blue ring with cool silver sheen */
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow:
    0 0 0 3px #0e1820 inset,
    0 0 0 6px color-mix(in srgb, var(--chrome-secondary) 50%, transparent) inset,
    0 0 0 9px color-mix(in srgb, var(--chrome-accent) 25%, transparent) inset,
    0 0 24px color-mix(in srgb, var(--chrome-glow) 40%, transparent) inset;
  animation: dd-ring 5s ease-in-out infinite;
}

/* Frosted facet SVGs — one per corner */
.facet {
  position: absolute;
  width: 60px;
  height: 60px;
}
.facet-tl { top: 0;    left: 0; }
.facet-tr { top: 0;    right: 0; }
.facet-bl { bottom: 0; left: 0; }
.facet-br { bottom: 0; right: 0; }

/* Sparkle dots — tiny, subtle */
.sparkle {
  position: absolute;
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--chrome-glow);
  box-shadow: 0 0 4px var(--chrome-glow);
  animation: dd-sparkle 4s ease-in-out infinite;
}
.s1 { top: 20%;  left: 4px;   animation-delay: 0s; }
.s2 { top: 70%;  right: 4px;  animation-delay: 1s; }
.s3 { top: 10%;  right: 18px; animation-delay: 2s; }
.s4 { top: 80%;  left: 18px;  animation-delay: 3s; }

/* Prismatic gleam — a soft diagonal highlight that drifts across the top edge */
.gleam {
  position: absolute;
  top: 0;
  left: -60%;
  width: 40%;
  height: 100%;
  background: linear-gradient(
    105deg,
    transparent 0%,
    color-mix(in srgb, var(--chrome-glow) 12%, transparent) 45%,
    color-mix(in srgb, var(--chrome-secondary) 8%, transparent) 55%,
    transparent 100%
  );
  animation: dd-gleam 6s ease-in-out infinite;
}

/* Title plate */
.plate {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--chrome-secondary);
  font: 900 11px ui-monospace, monospace;
  letter-spacing: .2em;
  text-shadow:
    0 0 8px var(--chrome-glow),
    0 0 18px color-mix(in srgb, var(--chrome-accent) 60%, transparent);
  animation: dd-plate 5s ease-in-out infinite;
}

/* Subtle keyframes */
@keyframes dd-ring    { 0%, 100% { filter: brightness(1);    } 50% { filter: brightness(1.08); } }
@keyframes dd-sparkle { 0%, 100% { opacity: .3;  transform: scale(1);   } 50% { opacity: .9; transform: scale(1.2); } }
@keyframes dd-gleam   { 0%       { transform: translateX(0);      opacity: 0; }
                        20%      { opacity: 1; }
                        80%      { opacity: 1; }
                        100%     { transform: translateX(350%);   opacity: 0; } }
@keyframes dd-plate   { 0%, 100% { opacity: .7; } 50% { opacity: 1; } }
</style>
