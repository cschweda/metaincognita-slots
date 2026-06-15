export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt'
  ],

  ssr: false,

  devtools: {
    enabled: true
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      // inline so the first paint is dark even before any stylesheet arrives
      bodyAttrs: { style: 'background-color: #0a0a0a' },
      title: 'Slots Simulator',
      meta: [
        { name: 'description', content: 'Educational slot machine simulator — play ten authentic archetypes (including a press-your-luck blackjack reel), run bankroll-risk simulations in the Sim Lab, and explore the math the floor never shows in the /learn section.' },
        { property: 'og:title', content: 'Slots Simulator' },
        { property: 'og:description', content: 'Ten machines, a Monte-Carlo Sim Lab (risk of ruin, survival curve, drawdown histograms), and /learn explainers on house edge, virtual reels, and hold-and-spin math.' },
        { property: 'og:image', content: '/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Slots Simulator' },
        { name: 'twitter:description', content: 'Ten machines, a Monte-Carlo Sim Lab (risk of ruin, survival curve, drawdown histograms), and /learn explainers on house edge, virtual reels, and hold-and-spin math.' },
        { name: 'twitter:image', content: '/og-image.png' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  spaLoadingTemplate: true,

  compatibilityDate: '2025-01-15',

  nitro: {
    preset: 'netlify_static',
    // Belt-and-suspenders: these routes are also linked from the nav/index so
    // the crawler finds them, but list them explicitly so each prerenders to
    // its own HTML (and the CSP-hash script covers them).
    prerender: {
      routes: [
        '/sim-lab',
        '/learn',
        '/learn/house-edge',
        '/learn/telnaes-reels',
        '/learn/hold-and-spin',
        '/learn/gargoyles-eye'
      ]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  icon: {
    clientBundle: {
      scan: true
    }
  }
})
