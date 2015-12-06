var gulp = require('gulp')

	// Tools
	, gutil = require('gulp-util')
	, clean = require('gulp-clean')
	, concat = require('gulp-concat')
	, rename = require('gulp-rename')

	// Styles
	, sass = require('gulp-ruby-sass')
	, autoprefixer = require('gulp-autoprefixer')
	, minifycss = require('gulp-minify-css')

	// Markup
	, minifyhtml = require('gulp-minify-html')
	, processhtml = require('gulp-processhtml')

	// Scripts
	, jshint = require('gulp-jshint')
	, uglify = require('gulp-uglify')

	, connect = require('gulp-connect')
	, paths;


var config = {
	path: {
		src:    'src',
		dist:   'dist',
		css:    'css',
		scss:   'scss',
		js:     'js',
		img:    'img',
		fonts:  'fonts',
	},
	serverport: 8080,
	livereloadport: 35729,
};

paths = {
	assets: 'src/assets/**/*',
	scss:    'src/scss/', 
	libs:   [
	],
//	js:     ['src/js/**/*.js'],
	js:     ['src/js/*.js'],
	dist:   './dist/'
};

// UTILS

gulp.task('clean', function () {
	var stream = gulp.src(config.path.dist, {read: false})
		.pipe(clean({force: true}))
		.on('error', gutil.log);
	return stream;
});

gulp.task('copy', ['clean'], function () {
	gulp.src([
//		'src/bower_components/jquery/jquery.js'
		])
		.pipe(gulp.dest(config.path.dist))
		.on('error', gutil.log);
});


// STYLES

gulp.task('styles', function(){
	return sass(paths.scss + 'main.scss', {
		style: 'expanded',
		sourcemap: true 
		})
		.pipe(autoprefixer('last 2 version'))
		.pipe(gulp.dest('src/css'))

		// prod
		.pipe(minifycss({
			keepSpecialComments: false,
			removeEmpty: true
		}))
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest(config.path.dist))
		.pipe(connect.reload())
		.on('error', gutil.log);
});


// MARKUP

gulp.task('markup', function() {
	gulp.src('src/index.html')
		// prod
		.pipe(processhtml('index.html'))
		.pipe(minifyhtml())
		.pipe(gulp.dest(paths.dist))
		.pipe(connect.reload())
		.on('error', gutil.log);
});

gulp.task('uglify', ['lint'], function () {
	var srcs = [paths.libs[0], paths.js[0]];

	gulp.src(srcs)
		.pipe(concat('main.min.js'))
		.pipe(gulp.dest(paths.dist))
		.pipe(uglify({outSourceMaps: false}))
		.pipe(gulp.dest(paths.dist));
});

gulp.task('lint', function() {
	gulp.src(paths.js)
		.pipe(jshint('.jshintrc'))
		.pipe(jshint.reporter('default'))
		.pipe(connect.reload())
		.on('error', gutil.log);
});

// SERVER

gulp.task('connect', function () {
	connect.server({
		root: [__dirname + '/src'],
		port: 9000,
		livereload: true
	});
});

// USER TASKS

gulp.task('watch', function () {
	gulp.watch(paths.js, ['lint']);
	gulp.watch(['src/scss/**/*'], ['styles']);
	gulp.watch(['src/*.html'], ['markup']);
});

gulp.task('build', ['copy', 'uglify', 'minifycss', 'processhtml', 'minifyhtml']);

gulp.task('default', ['connect', 'watch']);


