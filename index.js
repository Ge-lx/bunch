const bunch = require('./bunch')({ debug: true });

bunch.define('testRouter', function (ImageHandler) {
	console.log('testRouter');
});

bunch.define('CONFIG', function () {
	return {
		bla: 'bla',
		jo: 'jo'
	};
});

bunch.define('ImageHandler', function (CONFIG, UserHandler) {
	return new Promise((resolve, reject) => {
		// setTimeout(resolve, 4000);

		resolve({
			doSomething: () => console.log('something')
		});
	});
});

bunch.define('UserHandler', function (ImageHandler, utils) {
	return {
		getProfilePicture: id => ImageHandler.doSomething,
		getFullName: id => utils.userNameForId
	};
});

bunch.define('utils', function (CONFIG) {
	console.log('utils loaded.');
	return 'utils';
});

bunch.resolve(function (testRouter) {
	console.log('what? - ');
})
.catch(console.log);


bunch.define('hi', () => 'world' );