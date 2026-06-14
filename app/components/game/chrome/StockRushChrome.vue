<script setup lang="ts">
// Pachinko neon surround for Stock Rush. Decorative only.
</script>

<template>
  <div class="stock">
    <div class="tube" />
    <div class="sign">
      大当り · STOCK RUSH
    </div>
    <div class="bulbs">
      <span class="bulb b1" />
      <span class="bulb b2" />
      <span class="bulb b3" />
      <span class="bulb b4" />
    </div>
    <span class="icon torii">⛩️</span>
    <span class="icon cat">🐱</span>
  </div>
</template>

<style scoped>
.stock { position: absolute; inset: 0; }

.tube {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--chrome-accent) 80%, transparent) inset,
    0 0 0 8px color-mix(in srgb, var(--chrome-secondary) 50%, transparent) inset,
    0 0 22px color-mix(in srgb, var(--chrome-glow) 55%, transparent) inset,
    0 0 40px color-mix(in srgb, var(--chrome-accent) 25%, transparent) inset;
  animation: sr-tube 4s ease-in-out infinite;
}

.sign {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  color: var(--chrome-glow);
  font: 900 11px ui-monospace, monospace;
  letter-spacing: .14em;
  text-shadow:
    0 0 6px var(--chrome-glow),
    0 0 14px var(--chrome-secondary);
  animation: sr-sign 5s ease-in-out infinite;
}

.bulbs {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}

.bulb {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chrome-accent);
  box-shadow: 0 0 6px var(--chrome-accent);
  animation: sr-glow 2.4s ease-in-out infinite;
}
.b2 { animation-delay: .6s; background: var(--chrome-secondary); box-shadow: 0 0 6px var(--chrome-secondary); }
.b3 { animation-delay: 1.2s; background: var(--chrome-glow); box-shadow: 0 0 6px var(--chrome-glow); }
.b4 { animation-delay: 1.8s; }

.icon {
  position: absolute;
  font-size: 22px;
  bottom: 4px;
  filter: drop-shadow(0 2px 4px #000);
  animation: sr-bob 6s ease-in-out infinite;
}
.torii { left: 8px; }
.cat { right: 8px; animation-delay: .8s; }

/* subtle keyframes */
@keyframes sr-tube { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.1); } }
@keyframes sr-sign { 0%, 100% { opacity: .7; } 50% { opacity: 1; } }
@keyframes sr-glow { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
@keyframes sr-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
</style>
