<script setup lang="ts">
// Gothic cathedral surround for Ruby of Gargoyle. Decorative only.
</script>

<template>
  <div class="ruby">
    <div class="ring" />
    <svg
      class="arches"
      viewBox="0 0 200 44"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M28 44 Q28 8 48 8 Q68 8 68 44 M132 44 Q132 8 152 8 Q172 8 172 44"
        fill="none"
        stroke="var(--chrome-secondary)"
        stroke-width="3"
        opacity="0.45"
      />
    </svg>
    <span class="gargoyle left">👹</span>
    <span class="gargoyle right">👹</span>
    <span class="eye">👁️</span>
    <span class="gem g1">❖</span>
    <span class="gem g2">❖</span>
    <span class="plate">◈ RUBY OF GARGOYLE ◈</span>
  </div>
</template>

<style scoped>
.ruby { position: absolute; inset: 0; }
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow:
    0 0 0 3px #1c1118 inset,
    0 0 0 7px #3a2630 inset,
    0 0 26px color-mix(in srgb, var(--chrome-accent) 55%, transparent) inset;
  animation: ruby-breathe 5s ease-in-out infinite;
}
.arches { position: absolute; top: 0; left: 0; right: 0; height: 44px; }
.gargoyle {
  position: absolute;
  top: 2px;
  font-size: 26px;
  filter: drop-shadow(0 2px 3px #000);
  animation: ruby-bob 5.5s ease-in-out infinite;
}
.gargoyle.left { left: 6px; }
.gargoyle.right { right: 6px; animation-delay: .4s; }
.eye {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 16px;
  animation: ruby-eye 4s ease-in-out infinite;
}
.gem { position: absolute; color: var(--chrome-accent); font-size: 12px; opacity: .8; }
.gem.g1 { left: 4px; top: 48%; }
.gem.g2 { right: 4px; top: 48%; }
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
/* subtle */
@keyframes ruby-breathe { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.1); } }
@keyframes ruby-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes ruby-eye { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
</style>
