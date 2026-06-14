<script setup lang="ts">
// 1960s Bally warm brass + cream bakelite surround for Series E 3-Line. The least animated module. Decorative only.
</script>

<template>
  <div class="series3">
    <div class="ring" />
    <!-- Brass vertical rails on the sides -->
    <div class="rail rail-left" />
    <div class="rail rail-right" />
    <!-- Cream bakelite corner inlays -->
    <div class="corner corner-tl" />
    <div class="corner corner-tr" />
    <div class="corner corner-bl" />
    <div class="corner corner-br" />
    <!-- Bell finial centered on top -->
    <span class="bell">🔔</span>
    <!-- Title plate -->
    <span class="plate">SERIES E · 3-LINE</span>
  </div>
</template>

<style scoped>
.series3 { position: absolute; inset: 0; overflow: hidden; border-radius: 1.25rem; }

/* Warm brass gradient ring — soft tungsten glow */
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--chrome-accent) 30%, transparent) 0%,
    transparent 30%,
    transparent 70%,
    color-mix(in srgb, var(--chrome-accent) 20%, transparent) 100%
  );
  box-shadow:
    0 0 0 3px #2a1f08 inset,
    0 0 0 6px color-mix(in srgb, var(--chrome-accent) 70%, #1a1208) inset,
    0 0 0 10px color-mix(in srgb, var(--chrome-accent) 30%, transparent) inset,
    0 0 22px color-mix(in srgb, var(--chrome-glow) 35%, transparent) inset;
  /* Period-correct: only a very gentle single glow pulse */
  animation: se3-glow 5s ease-in-out infinite;
}

/* Brass vertical rails */
.rail {
  position: absolute;
  top: 12px;
  bottom: 12px;
  width: 10px;
  border-radius: 5px;
  background: linear-gradient(
    to right,
    #3a2c0a,
    color-mix(in srgb, var(--chrome-accent) 80%, #c8a030) 40%,
    #c8a030 50%,
    color-mix(in srgb, var(--chrome-accent) 80%, #3a2c0a) 60%,
    #3a2c0a
  );
  box-shadow: 0 0 5px color-mix(in srgb, var(--chrome-glow) 40%, transparent);
}
.rail-left  { left: 4px; }
.rail-right { right: 4px; }

/* Cream bakelite corner inlays */
.corner {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: var(--chrome-secondary);
  opacity: 0.55;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--chrome-accent) 60%, transparent),
    inset 0 0 4px rgba(0,0,0,.4);
}
.corner-tl { top: 6px;    left: 18px; border-radius: 2px 8px 2px 2px; }
.corner-tr { top: 6px;    right: 18px; border-radius: 8px 2px 2px 2px; }
.corner-bl { bottom: 6px; left: 18px;  border-radius: 2px 2px 8px 2px; }
.corner-br { bottom: 6px; right: 18px; border-radius: 2px 2px 2px 8px; }

/* Bell finial — the one decorative flourish, barely moving */
.bell {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 20px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.6));
  animation: se3-bell 6s ease-in-out infinite;
}

/* Title plate — warm cream text */
.plate {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--chrome-secondary);
  font: 900 11px ui-monospace, monospace;
  letter-spacing: .26em;
  text-shadow: 0 0 6px var(--chrome-glow), 0 1px 0 #2a1f08;
}

/* Minimal keyframes — the least animated module */
@keyframes se3-glow { 0%, 100% { filter: brightness(1);    } 50% { filter: brightness(1.07); } }
@keyframes se3-bell { 0%, 100% { transform: translateX(-50%) rotate(0deg);   }
                      45%      { transform: translateX(-50%) rotate(-3deg);   }
                      55%      { transform: translateX(-50%) rotate(3deg);    } }
</style>
