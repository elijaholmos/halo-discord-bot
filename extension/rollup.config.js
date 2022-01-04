import { defineConfig } from 'rollup';
import { chromeExtension, simpleReloader } from 'rollup-plugin-chrome-extension';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { emptyDir } from 'rollup-plugin-empty-dir';

export default defineConfig({
    input: 'src/manifest.json',
    output: {
        dir: 'dist',
        format: 'esm',
    },
    plugins: [
        chromeExtension(),
        simpleReloader(),
        resolve(),
        commonjs(),
        emptyDir(),
    ],
});
