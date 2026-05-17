import { build, context } from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';

const production = process.env.NODE_ENV === 'production';

const buildOptions = {
  bundle: true,
  entryPoints: ['./src/neon-relic.mjs', './src/neon-relic.scss'],
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  format: 'esm',
  logLevel: 'info',
  sourcemap: !production ? 'inline' : false,
  minifyWhitespace: production,
  minifySyntax: production,
  drop: production ? ['console', 'debugger'] : [],
  plugins: [
    sassPlugin({
      logger: {
        warn: () => '',
      },
    }),
    {
      name: 'external-files',
      setup(inBuild) {
        inBuild.onResolve({ filter: /(\/assets|\/fonts|\/systems)/ }, () => {
          return { external: true };
        });
      },
    },
  ],
};

const esbuildConfig = async ({ watch = false } = {}) => {
  if (watch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    return ctx;
  }
  return build(buildOptions);
};

export default esbuildConfig;

// Auto-execute when run directly
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  esbuildConfig();
}
