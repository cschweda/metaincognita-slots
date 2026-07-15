<!-- Fills the dead width beside a 3-reel cabinet in theater so it reads as a
     lavish Vegas machine, not three lonely symbols. Purely decorative. -->
<template>
  <div
    class="theater-towers"
    aria-hidden="true"
  >
    <div
      v-for="side in ['left', 'right']"
      :key="side"
      class="theater-tower"
      :class="`theater-tower--${side}`"
      data-test="side-tower"
    >
      <span
        v-for="n in 9"
        :key="n"
        class="theater-bulb"
      />
    </div>
  </div>
</template>

<style scoped>
.theater-towers { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.theater-tower {
  position: absolute; top: 0; bottom: 0; width: clamp(40px, 10vw, 140px);
  display: flex; flex-direction: column; align-items: center; justify-content: space-evenly;
  background: linear-gradient(180deg, #3a2708, #16100333);
  box-shadow: inset 0 0 40px rgba(212, 168, 71, 0.35);
}
.theater-tower--left { left: 0; }
.theater-tower--right { right: 0; }
.theater-bulb {
  width: clamp(8px, 1.4vw, 18px); aspect-ratio: 1; border-radius: 999px;
  background: radial-gradient(circle at 35% 30%, #fff2c4, #f6c453 55%, #b57d1e);
  box-shadow: 0 0 12px 3px rgba(255, 200, 90, 0.75);
  animation: theater-bulb-pulse 1.1s ease-in-out infinite;
}
.theater-tower--right .theater-bulb { animation-delay: 0.55s; }
@keyframes theater-bulb-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .theater-bulb { animation: none; opacity: 0.9; }
}
</style>
