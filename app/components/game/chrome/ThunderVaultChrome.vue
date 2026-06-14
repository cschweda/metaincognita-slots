<script setup lang="ts">
// Riveted brushed-steel vault surround for Thunder Vault. Decorative only.
</script>

<template>
  <div class="vault">
    <div class="ring" />
    <!-- Rivet dots at regular intervals around the frame -->
    <span class="rivet" style="top: 8px;  left: 8px;"  />
    <span class="rivet" style="top: 8px;  left: 50%; transform: translateX(-50%);" />
    <span class="rivet" style="top: 8px;  right: 8px;" />
    <span class="rivet" style="bottom: 8px; left: 8px;" />
    <span class="rivet" style="bottom: 8px; left: 50%; transform: translateX(-50%);" />
    <span class="rivet" style="bottom: 8px; right: 8px;" />
    <span class="rivet" style="top: 50%; left: 6px;  transform: translateY(-50%);" />
    <span class="rivet" style="top: 50%; right: 6px; transform: translateY(-50%);" />
    <!-- SVG lightning bolts across the top -->
    <svg
      class="lightning"
      viewBox="0 0 200 36"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <!-- Left bolt -->
      <polyline
        points="56,2 48,16 54,16 44,34"
        fill="none"
        stroke="var(--chrome-accent)"
        stroke-width="2.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <!-- Right bolt -->
      <polyline
        points="144,2 152,16 146,16 156,34"
        fill="none"
        stroke="var(--chrome-secondary)"
        stroke-width="2.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
    <!-- Vault dial motif — concentric circles in top-right corner -->
    <svg
      class="dial"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--chrome-accent)"    stroke-width="1.5" opacity="0.5" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="var(--chrome-secondary)" stroke-width="1"   opacity="0.4" />
      <circle cx="24" cy="24" r="8"  fill="none" stroke="var(--chrome-glow)"      stroke-width="1"   opacity="0.35" />
      <circle cx="24" cy="24" r="3"  fill="var(--chrome-glow)" opacity="0.5" />
      <!-- Tick marks -->
      <line x1="24" y1="4"  x2="24" y2="9"  stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.6" />
      <line x1="44" y1="24" x2="39" y2="24" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.6" />
      <line x1="24" y1="44" x2="24" y2="39" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.6" />
      <line x1="4"  y1="24" x2="9"  y2="24" stroke="var(--chrome-accent)" stroke-width="1.5" opacity="0.6" />
    </svg>
    <!-- Title plate -->
    <span class="plate">THUNDER VAULT</span>
  </div>
</template>

<style scoped>
.vault { position: absolute; inset: 0; overflow: hidden; border-radius: 1.25rem; }

/* Brushed-steel ring: angular gradient + glow */
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--chrome-accent) 15%, transparent) 0%,
      transparent 40%,
      transparent 60%,
      color-mix(in srgb, var(--chrome-secondary) 10%, transparent) 100%
    );
  box-shadow:
    0 0 0 3px #1a1a24 inset,
    0 0 0 6px color-mix(in srgb, #607080 40%, transparent) inset,
    0 0 24px color-mix(in srgb, var(--chrome-glow) 45%, transparent) inset;
  animation: tv-ring 5s ease-in-out infinite;
}

/* Rivet dots */
.rivet {
  position: absolute;
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #8090a0, #3a4a56);
  box-shadow: 0 1px 2px #0006;
}

/* Lightning SVG spans the full top band */
.lightning {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 40px;
  animation: tv-bolt 4s ease-in-out infinite;
}

/* Vault dial — top-right corner */
.dial {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 48px;
  height: 48px;
  animation: tv-dial 6s ease-in-out infinite;
}

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
    0 0 18px color-mix(in srgb, var(--chrome-secondary) 70%, transparent);
}

/* Subtle keyframes */
@keyframes tv-ring { 0%, 100% { filter: brightness(1);   } 50% { filter: brightness(1.1);  } }
@keyframes tv-bolt { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
@keyframes tv-dial { 0%, 100% { opacity: .5;  } 50% { opacity: .85; } }
</style>
