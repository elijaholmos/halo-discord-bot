import { defineConfig } from 'rollup';
import { chromeExtension, simpleReloader } from 'rollup-plugin-chrome-extension';
import resolve from '@rollup/plugin-node-resolve';
import { emptyDir } from 'rollup-plugin-empty-dir';
import { terser } from 'rollup-plugin-terser';
import zip from "rollup-plugin-zip";
import copy from 'rollup-plugin-copy';

const isProduction = !process.env.ROLLUP_WATCH;

export default defineConfig({
	input: 'src/manifest.json',
	output: {
		dir: 'dist',
		format: 'esm',
	},
	plugins: [
		emptyDir(),
		chromeExtension(),
		simpleReloader(),
		resolve(),
        copy({
            targets: [
                {
                    src: 'static',
                    dest: 'dist/static',
                },
            ],
        }),
		isProduction && terser(),
		isProduction && zip({ dir: 'dist_packed' }),
	],
});
