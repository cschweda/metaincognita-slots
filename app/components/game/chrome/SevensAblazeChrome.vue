<script setup lang="ts">
// Hot-rod fire surround for Sevens Ablaze. Decorative only.
</script>

<template>
  <div class="sevens">
    <div class="ring" />
    <!-- Charred side rails -->
    <div class="rail rail-left" />
    <div class="rail rail-right" />
    <!-- Layered SVG flames rising from the bottom edge -->
    <svg
      class="flames"
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <!-- Back layer — secondary (orange), wider, slower -->
      <path
        class="flame-back"
        d="M0 60 Q10 40 18 50 Q26 30 34 45 Q42 20 50 40 Q58 28 66 48 Q74 32 82 44 Q90 18 100 38 Q110 22 118 44 Q126 30 134 48 Q142 20 150 40 Q158 32 166 48 Q174 36 182 50 Q190 40 200 60 Z"
        fill="var(--chrome-secondary)"
        opacity="0.55"
      />
      <!-- Front layer — accent (red), narrower, livelier -->
      <path
        class="flame-front"
        d="M10 60 Q18 38 26 50 Q36 22 44 44 Q54 30 62 52 Q72 16 80 42 Q92 26 100 46 Q108 28 118 50 Q128 18 136 44 Q146 32 154 52 Q164 24 172 46 Q180 38 190 60 Z"
        fill="var(--chrome-accent)"
        opacity="0.7"
      />
    </svg>
    <!-- Ember dots drifting upward -->
    <span class="ember e1" />
    <span class="ember e2" />
    <span class="ember e3" />
    <span class="ember e4" />
    <span class="ember e5" />
    <!-- Title plate -->
    <span class="plate">🔥 SEVENS ABLAZE 🔥</span>
  </div>
</template>

<style scoped>
.sevens { position: absolute; inset: 0; overflow: hidden; border-radius: 1.25rem; }

/* Charred dark ring with hot red/orange glow */
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow:
    0 0 0 3px #1a0505 inset,
    0 0 0 7px #2d0f0f inset,
    0 0 28px color-mix(in srgb, var(--chrome-accent) 60%, transparent) inset,
    0 0 8px color-mix(in srgb, var(--chrome-secondary) 40%, transparent) inset;
  animation: sa-ring 4s ease-in-out infinite;
}

/* Charred vertical rail strips on the sides */
.rail {
  position: absolute;
  top: 8px;
  bottom: 28px;
  width: 8px;
  border-radius: 4px;
  background: linear-gradient(to bottom, #3a1010, #1a0505 60%, #2d0f0f);
  box-shadow: 0 0 6px color-mix(in srgb, var(--chrome-accent) 50%, transparent);
}
.rail-left  { left: 3px; }
.rail-right { right: 3px; }

/* Flame SVG — sits along the bottom edge */
.flames {
  position: absolute;
  bottom: 18px;
  left: 0;
  right: 0;
  height: 60px;
  pointer-events: none;
}

/* Back flame — gentle height/opacity flicker */
.flame-back { animation: sa-flame-back 3.2s ease-in-out infinite; transform-origin: bottom center; }
/* Front flame — slightly offset phase */
.flame-front { animation: sa-flame-front 2.8s ease-in-out infinite; transform-origin: bottom center; animation-delay: .3s; }

/* Ember dots — small, drift upward gently */
.ember {
  position: absolute;
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--chrome-secondary);
  box-shadow: 0 0 4px var(--chrome-accent);
  animation: sa-ember 4.5s ease-in-out infinite;
}
.e1 { left: 15%;  bottom: 28px; animation-delay: 0s;    animation-duration: 4.5s; }
.e2 { left: 30%;  bottom: 28px; animation-delay: .9s;   animation-duration: 5s;   }
.e3 { left: 50%;  bottom: 28px; animation-delay: 1.8s;  animation-duration: 4.2s; }
.e4 { left: 68%;  bottom: 28px; animation-delay: .4s;   animation-duration: 5.2s; }
.e5 { left: 82%;  bottom: 28px; animation-delay: 2.4s;  animation-duration: 4.8s; }

/* Title plate */
.plate {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--chrome-glow);
  font: 900 10px ui-monospace, monospace;
  letter-spacing: .16em;
  text-shadow: 0 0 10px var(--chrome-accent), 0 0 20px var(--chrome-secondary);
}

/* Subtle keyframes — no strobing */
@keyframes sa-ring       { 0%, 100% { filter: brightness(1);   } 50% { filter: brightness(1.1); } }
@keyframes sa-flame-back {
  0%, 100% { transform: scaleY(1);    opacity: .55; }
  50%      { transform: scaleY(1.06); opacity: .75; }
}
@keyframes sa-flame-front {
  0%, 100% { transform: scaleY(1);    opacity: .7; }
  50%      { transform: scaleY(1.08); opacity: .9; }
}
@keyframes sa-ember {
  0%   { transform: translateY(0)   scale(1);   opacity: .8; }
  60%  { transform: translateY(-36px) scale(.8); opacity: .6; }
  100% { transform: translateY(-60px) scale(.5); opacity: 0; }
}
</style>
