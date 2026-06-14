<script setup lang="ts">
// 1960s Bally cool turquoise + chrome surround for Series E Multiplier.
// Deliberately distinct from Series E 3-Line: turquoise accent, chrome rails,
// and red ×2 ×3 multiplier numerals as a side ornament. Decorative only.
</script>

<template>
  <div class="seriesmx">
    <div class="ring" />
    <!-- Chrome vertical rails on the sides -->
    <div class="rail rail-left" />
    <div class="rail rail-right" />
    <!-- Red multiplier numerals — left side ornament -->
    <div class="mult-panel left-panel">
      <span class="mult-num">×2</span>
      <span class="mult-num">×3</span>
    </div>
    <!-- Right mirror panel (reversed order) -->
    <div class="mult-panel right-panel">
      <span class="mult-num">×3</span>
      <span class="mult-num">×2</span>
    </div>
    <!-- Corner chrome accent inlays -->
    <div class="corner corner-tl" />
    <div class="corner corner-tr" />
    <div class="corner corner-bl" />
    <div class="corner corner-br" />
    <!-- Title plate -->
    <span class="plate">SERIES E · MULTIPLIER</span>
  </div>
</template>

<style scoped>
.seriesmx { position: absolute; inset: 0; overflow: hidden; border-radius: 1.25rem; }

/* Cool turquoise ring with chrome sheen */
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--chrome-accent) 20%, transparent) 0%,
    transparent 25%,
    transparent 75%,
    color-mix(in srgb, var(--chrome-accent) 15%, transparent) 100%
  );
  box-shadow:
    0 0 0 3px #071414 inset,
    0 0 0 6px color-mix(in srgb, var(--chrome-accent) 65%, #0a2020) inset,
    0 0 0 10px color-mix(in srgb, var(--chrome-secondary) 30%, transparent) inset,
    0 0 24px color-mix(in srgb, var(--chrome-glow) 45%, transparent) inset;
  animation: smx-ring 5s ease-in-out infinite;
}

/* Chrome (silver) vertical rails — distinguishes from brass rails of 3-Line */
.rail {
  position: absolute;
  top: 10px;
  bottom: 10px;
  width: 10px;
  border-radius: 5px;
  background: linear-gradient(
    to right,
    #1a2a2a,
    color-mix(in srgb, var(--chrome-secondary) 80%, #c0c8cc) 40%,
    #d0d8dc 50%,
    color-mix(in srgb, var(--chrome-secondary) 80%, #1a2a2a) 60%,
    #1a2a2a
  );
  box-shadow: 0 0 6px color-mix(in srgb, var(--chrome-glow) 40%, transparent);
}
.rail-left  { left: 4px; }
.rail-right { right: 4px; }

/* Red multiplier numeral panels — the defining ornament of this cabinet */
.mult-panel {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}
.left-panel  { left: 18px; }
.right-panel { right: 18px; }

.mult-num {
  display: block;
  font: 900 13px ui-monospace, monospace;
  color: #ef4444;
  text-shadow:
    0 0 6px #ef4444,
    0 0 14px color-mix(in srgb, #ef4444 60%, transparent);
  letter-spacing: .04em;
  animation: smx-mult 4s ease-in-out infinite;
}
.mult-num:nth-child(2) { animation-delay: .7s; }
/* Mirror panels */
.right-panel .mult-num:nth-child(1) { animation-delay: .35s; }
.right-panel .mult-num:nth-child(2) { animation-delay: 1.05s; }

/* Turquoise chrome corner inlays */
.corner {
  position: absolute;
  width: 20px;
  height: 20px;
  opacity: 0.6;
  background: color-mix(in srgb, var(--chrome-accent) 40%, #0a1a1a);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--chrome-accent) 70%, transparent),
    0 0 5px color-mix(in srgb, var(--chrome-glow) 50%, transparent);
}
.corner-tl { top: 6px;    left: 18px;  border-radius: 2px 6px 2px 2px; }
.corner-tr { top: 6px;    right: 18px; border-radius: 6px 2px 2px 2px; }
.corner-bl { bottom: 6px; left: 18px;  border-radius: 2px 2px 6px 2px; }
.corner-br { bottom: 6px; right: 18px; border-radius: 2px 2px 2px 6px; }

/* Title plate — turquoise text */
.plate {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--chrome-glow);
  font: 900 10px ui-monospace, monospace;
  letter-spacing: .18em;
  text-shadow: 0 0 8px var(--chrome-accent), 0 0 18px color-mix(in srgb, var(--chrome-glow) 50%, transparent);
  animation: smx-plate 5s ease-in-out infinite;
}

/* Subtle keyframes */
@keyframes smx-ring  { 0%, 100% { filter: brightness(1);    } 50% { filter: brightness(1.08); } }
@keyframes smx-mult  { 0%, 100% { opacity: .7; filter: brightness(1);    } 50% { opacity: 1;  filter: brightness(1.1); } }
@keyframes smx-plate { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }
</style>
