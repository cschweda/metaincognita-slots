import { defineStore } from 'pinia'

/** Skeleton — Task 4 replaces this file with the full session store. */
export const useSlotsStore = defineStore('slots', {
  state: () => ({
    phase: 'floor' as 'floor' | 'playing',
    liveAnnouncement: ''
  })
})
