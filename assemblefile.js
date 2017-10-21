// Gulp etc
const assemble = require('assemble');
const gulp = require('gulp');
const watch = require('gulp-watch');
const sass = require('gulp-sass');
const rename = require('gulp-rename');
const svgmin = require('gulp-svgmin'); // Minify SVGs
const svgstore = require('gulp-svgstore'); // Compile SVG spritesheets
const autoprefixer = require('gulp-autoprefixer'); // Autoprefix CSS
const browserify = require('browserify'); // CommonJS
const source = require('vinyl-source-stream');
const connect = require('gulp-connect'); // Simple file server
const browsersync = require('browser-sync'); // Sync browser with updates
const babelify = require('babelify'); // ES6 Transpiling
const del = require('del');
const flatten = require('gulp-flatten'); // Flattern paths
const fs = require('fs'); // File system manip
const permalinks = require('assemble-permalinks');
const plumber = require('gulp-plumber');

const bs = browsersync.create();

const site = assemble();

const servePort = 8888;

const buildDir = './dist';
const sourceDir = './src';

const distAssets= {
  'cssPath': 'assets/css/',
  'cssFilename': 'style.css',

  'jsPath': 'assets/js/',
  'jsFilename': 'script.js'
}

// Compile JS
// ------------------------------------------------------
site.task('js', (cb) => {
  browserify({
    // Module location
    paths: [
      `${sourceDir}/_js/modules`,
      `${sourceDir}/_js/helpers`,
      `${sourceDir}/_data`,
    ],

    // Entry point
    entries: `${sourceDir}/_js/index.js`,
  })
    .transform(babelify, { presets: ['es2015'] })
    .bundle()

    // Prevent watch crash on error
    .pipe(plumber())

    // Pass desired output filename to vinyl-source-stream
    .pipe(source(distAssets.jsFilename))

    .pipe(gulp.dest(`${buildDir}/${distAssets.jsPath}`))

    // Refresh BS
    .pipe(bs.stream());
  cb();
});

// Compile CSS
// ------------------------------------------------------
site.task('css', (cb) => {
  site.src(`${sourceDir}/_css/index.scss`)
    // Prevent watch crash on error
    .pipe(plumber())

    // Compile
    .pipe(sass())

    .pipe(autoprefixer({
      browsers: ['last 2 versions'],
    }))

    // Rename
    .pipe(rename({
      basename: distAssets.cssFilename,
      extname: '' // ext provided in object so trim existing .css from ext
    }))

    // Place
    .pipe(site.dest(`${buildDir}/${distAssets.cssPath}`))

    // Refresh BS
    .pipe(bs.stream());

  cb();
});

// Assemble static html
// ------------------------------------------------------

// Load partials, layouts, pages, site data
site.task('load', (cb) => {
  site.data(distAssets)
  site.data('src/_data/*.json');

  // Apply stand layout to all rendered templates
  site.option('layout', 'standard');

  site.partials([
    `${sourceDir}/_templates/components/*.hbs`,
    `${sourceDir}/_templates/pages/*.hbs`,
    `${sourceDir}/_templates/includes/*`,
  ]);
  site.layouts(`${sourceDir}/_templates/layouts/*.hbs`);
  site.helpers(`${sourceDir}/_templates/helpers/*.js`);

  cb();
});

// Build site
site.task('build', ['load'], (cb) => {

  // Render index file
  site
    .src(`${sourceDir}/_templates/pages/index.hbs`)
    .pipe(site.renderFile())
    .pipe(rename({
      extname: '.html',
    }))
    .pipe(flatten())
    .pipe(site.dest(`${buildDir}`))
    .pipe(bs.stream());


  cb();
});

// Create SVG Sprites
// ------------------------------------------------------
site.task('svg', (cb) => {
  site.src(`${sourceDir}/_icons/**.svg`)
    .pipe(svgmin())
    .pipe(svgstore({
      inlineSvg: true,
    }))
    .pipe(rename({
      basename: 'spritesheet',
    }))
    .pipe(site.dest(`${sourceDir}/_templates/includes/`));
  cb();
});

// Clear dist directory
// ------------------------------------------------------
site.task('clear', () => del(['dist/**']));

// Start browser-sync
// ------------------------------------------------------
site.task('serve', () => {
  connect.server({
    root: buildDir,
    port: servePort,
  });

  bs.init({
    proxy: `localhost:${servePort}/${buildDir}`,
    notify: false,
    open: false,
  });

  // CSS
  watch(`${sourceDir}/_css/**/*.scss`, () => {
    site.build(['css'], (err) => {
      if (err) throw err;
      console.log('CSS compiled');
    });
  });

  // JS
  watch(`${sourceDir}/_js/**/*`, () => {
    site.build('js', (err) => {
      if (err) throw err;
      console.log('JS bundled');
    });
  });

  // Templates
  watch(`${sourceDir}/_templates/**`, () => {
    site.build('build', (err) => {
      if (err) throw err;
      console.log('Templates built');
    });
  });

  // Icons
  watch(`${sourceDir}/_icons/**`, () => {
    site.build('svg', (err) => {
      if (err) throw err;
      console.log('Spritesheet compiled');
    });
  });
});

// Assign default task
site.task('build-site', ['svg', 'build', 'css', 'js']);
site.task('deploy', ['clear', 'build-site']);
site.task('default', ['build-site', 'serve']);

// Expose instance to assemble's CLI
module.exports = site;
