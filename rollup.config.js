// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'node_modules/pmtiles/dist/esm/index.js',
  output: {
    file: 'lib/pmtiles/pmtiles-bundle.js',
    format: 'esm'
  },
  plugins: [resolve()]
};
