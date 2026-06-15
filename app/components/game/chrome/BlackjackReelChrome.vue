<script setup lang="ts">
// Card-room glam surround for Hit or Bust. Decorative only.
</script>

<template>
  <div class="hob">
    <!-- Felt ring border -->
    <div class="ring" />
    <!-- Side felt texture rails -->
    <div class="rail rail-left" />
    <div class="rail rail-right" />
    <!-- Corner suit ornaments — spades/clubs gold, hearts/diamonds red -->
    <span class="suit tl">♠</span>
    <span class="suit tr">♥</span>
    <span class="suit bl">♣</span>
    <span class="suit br">♦</span>
    <!-- Chip stack flourish at lower-left and lower-right -->
    <svg class="chips chips-left" viewBox="0 0 24 40" aria-hidden="true">
      <ellipse cx="12" cy="36" rx="10" ry="4" fill="#1a6b41" stroke="#d4a017" stroke-width="1.2" />
      <rect x="2" y="30" width="20" height="6" rx="2" fill="#1a6b41" stroke="#d4a017" stroke-width="1.2" />
      <ellipse cx="12" cy="30" rx="10" ry="4" fill="#c41e3a" stroke="#d4a017" stroke-width="1.2" />
      <rect x="2" y="22" width="20" height="8" rx="2" fill="#c41e3a" stroke="#d4a017" stroke-width="1" />
      <ellipse cx="12" cy="22" rx="10" ry="4" fill="#1a1a1a" stroke="#d4a017" stroke-width="1.2" />
      <rect x="2" y="14" width="20" height="8" rx="2" fill="#1a1a1a" stroke="#d4a017" stroke-width="1" />
      <ellipse cx="12" cy="14" rx="10" ry="4" fill="#14532d" stroke="#d4a017" stroke-width="1.2" />
    </svg>
    <svg class="chips chips-right" viewBox="0 0 24 40" aria-hidden="true">
      <ellipse cx="12" cy="36" rx="10" ry="4" fill="#14532d" stroke="#d4a017" stroke-width="1.2" />
      <rect x="2" y="30" width="20" height="6" rx="2" fill="#14532d" stroke="#d4a017" stroke-width="1.2" />
      <ellipse cx="12" cy="30" rx="10" ry="4" fill="#1a1a1a" stroke="#d4a017" stroke-width="1.2" />
      <rect x="2" y="22" width="20" height="8" rx="2" fill="#1a1a1a" stroke="#d4a017" stroke-width="1" />
      <ellipse cx="12" cy="22" rx="10" ry="4" fill="#c41e3a" stroke="#d4a017" stroke-width="1.2" />
      <rect x="2" y="14" width="20" height="8" rx="2" fill="#c41e3a" stroke="#d4a017" stroke-width="1" />
      <ellipse cx="12" cy="14" rx="10" ry="4" fill="#1a6b41" stroke="#d4a017" stroke-width="1.2" />
    </svg>
    <!-- Neon title plate -->
    <span class="plate">HIT OR BUST · 21</span>
  </div>
</template>

<style scoped>
.hob { position: absolute; inset: 0; overflow: hidden; border-radius: 1.25rem; }

/* Felt-green ring with gold inner trim */
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow:
    0 0 0 3px #021008 inset,
    0 0 0 7px color-mix(in srgb, var(--chrome-secondary) 70%, #0a2010) inset,
    0 0 0 10px color-mix(in srgb, var(--chrome-accent) 55%, transparent) inset,
    0 0 28px color-mix(in srgb, var(--chrome-glow) 40%, transparent) inset;
  animation: hob-ring 5s ease-in-out infinite;
}

/* Side rails with a woven felt gradient */
.rail {
  position: absolute;
  top: 14px;
  bottom: 14px;
  width: 8px;
  border-radius: 4px;
  background: repeating-linear-gradient(
    to bottom,
    color-mix(in srgb, var(--chrome-secondary) 80%, transparent) 0%,
    color-mix(in srgb, var(--chrome-secondary) 40%, transparent) 40%,
    color-mix(in srgb, var(--chrome-secondary) 70%, transparent) 60%,
    color-mix(in srgb, var(--chrome-secondary) 30%, transparent) 100%
  );
  opacity: 0.55;
}
.rail-left  { left: 3px; }
.rail-right { right: 3px; }

/* Suit glyphs at corners */
.suit {
  position: absolute;
  font-size: 20px;
  line-height: 1;
  font-style: normal;
  animation: hob-twinkle 4s ease-in-out infinite;
}
/* Spades and clubs: gold */
.suit.tl,
.suit.bl {
  color: var(--chrome-glow);
  text-shadow: 0 0 6px var(--chrome-accent), 0 0 14px color-mix(in srgb, var(--chrome-glow) 50%, transparent);
}
/* Hearts and diamonds: casino red */
.suit.tr,
.suit.br {
  color: #e84040;
  text-shadow: 0 0 6px #ff6060, 0 0 14px #c4141440;
  animation-delay: .6s;
}

.suit.tl { top: 5px;    left: 14px;  }
.suit.tr { top: 5px;    right: 14px; animation-delay: .3s; }
.suit.bl { bottom: 20px; left: 14px;  animation-delay: .9s; }
.suit.br { bottom: 20px; right: 14px; animation-delay: 1.2s; }

/* Chip stacks */
.chips {
  position: absolute;
  width: 24px;
  height: 40px;
  opacity: 0.85;
  animation: hob-chips 6s ease-in-out infinite;
}
.chips-left  { bottom: 18px; left: 24px; }
.chips-right { bottom: 18px; right: 24px; animation-delay: 1.5s; }

/* Neon "HIT OR BUST · 21" title plate */
.plate {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--chrome-glow);
  font: 900 11px ui-monospace, monospace;
  letter-spacing: .2em;
  text-shadow:
    0 0 6px var(--chrome-accent),
    0 0 14px color-mix(in srgb, var(--chrome-glow) 70%, transparent),
    0 0 28px color-mix(in srgb, var(--chrome-glow) 30%, transparent);
  animation: hob-neon 4.5s ease-in-out infinite;
}

/* Subtle keyframes */
@keyframes hob-ring    { 0%, 100% { filter: brightness(1);    } 50% { filter: brightness(1.1);  } }
@keyframes hob-twinkle { 0%, 100% { opacity: .75; }             50% { opacity: 1;                } }
@keyframes hob-chips   { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes hob-neon    { 0%, 100% { opacity: .8; }              50% { opacity: 1;                } }
</style>
