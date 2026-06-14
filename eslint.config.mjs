// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // The per-machine cabinet chrome modules are dense inline SVG (paths, lines,
    // gradients). Forcing one-attribute-per-line / single-space on SVG geometry
    // hurts readability with no real benefit, so relax those two formatting rules
    // for this directory only.
    files: ['app/components/game/chrome/**/*.vue'],
    rules: {
      'vue/max-attributes-per-line': 'off',
      'vue/no-multi-spaces': 'off'
    }
  }
)
