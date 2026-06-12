<script setup lang="ts">
// Placeholder floor listing. Real floor page lands in Plan 3.
const machines: { id: string, name: string }[] = []
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-200 p-8 font-mono">
    <h1 class="text-2xl text-amber-400 mb-4">
      Slots Simulator — engine milestone
    </h1>
    <p class="text-neutral-400 mb-6">
      Headless engine under construction. Run <code>pnpm verify</code> for the floor report.
    </p>
    <ul>
      <li v-for="m in machines" :key="m.id">{{ m.name }}</li>
    </ul>
  </div>
</template>
