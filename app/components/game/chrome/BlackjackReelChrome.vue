<script setup lang="ts">
// Lucky 21 — green-felt + gold cabinet backdrop. Decorative only.
// aria-hidden, pointer-events:none, reduced-motion-safe (via .chrome-frame in main.css).
</script>

<template>
  <div
    class="l21-chrome"
    aria-hidden="true"
  >
    <!-- Outer gold border ring -->
    <div class="l21-ring" />
    <!-- Inset felt fill -->
    <div class="l21-felt" />
    <!-- Gold top rail -->
    <div class="l21-rail l21-rail-top" />
    <!-- Gold bottom rail -->
    <div class="l21-rail l21-rail-bottom" />
    <!-- Corner card-suit ornaments -->
    <span class="l21-suit l21-tl">♠</span>
    <span class="l21-suit l21-tr">♥</span>
    <span class="l21-suit l21-bl">♣</span>
    <span class="l21-suit l21-br">♦</span>
  </div>
</template>

<style scoped>
.l21-chrome {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 1.25rem;
  pointer-events: none;
}

/* Gold/dark outer ring */
.l21-ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow:
    0 0 0 3px #04221a inset,
    0 0 0 6px #b8860b inset,
    0 0 0 9px #04221a inset,
    0 0 40px rgba(184, 134, 11, 0.25) inset;
  animation: l21-ring-glow 4s ease-in-out infinite;
}

/* Subtle felt texture behind the game content */
.l21-felt {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(21, 114, 90, 0.18) 0%, transparent 70%);
  pointer-events: none;
}

/* Top and bottom gold accent rails */
.l21-rail {
  position: absolute;
  left: 10px;
  right: 10px;
  height: 3px;
  background: linear-gradient(90deg, transparent, #b8860b 20%, #ffd24a 50%, #b8860b 80%, transparent);
  border-radius: 2px;
  opacity: 0.6;
}
.l21-rail-top    { top: 6px; }
.l21-rail-bottom { bottom: 6px; }

/* Corner suit glyphs */
.l21-suit {
  position: absolute;
  font-size: 18px;
  line-height: 1;
  font-style: normal;
  animation: l21-twinkle 3.5s ease-in-out infinite;
}
.l21-tl,
.l21-bl {
  color: #ffd24a;
  text-shadow: 0 0 5px #b8860b, 0 0 12px rgba(255, 210, 74, 0.45);
}
.l21-tr,
.l21-br {
  color: #e84040;
  text-shadow: 0 0 5px #ff6060, 0 0 12px rgba(196, 20, 20, 0.35);
  animation-delay: 0.5s;
}
.l21-tl { top: 8px;    left: 12px;  }
.l21-tr { top: 8px;    right: 12px; animation-delay: 0.25s; }
.l21-bl { bottom: 18px; left: 12px;  animation-delay: 0.75s; }
.l21-br { bottom: 18px; right: 12px; animation-delay: 1s; }

/* Keyframes */
@keyframes l21-ring-glow {
  0%, 100% { filter: brightness(1); }
  50%       { filter: brightness(1.12); }
}
@keyframes l21-twinkle {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1; }
}
</style>
