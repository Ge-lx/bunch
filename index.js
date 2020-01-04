const bunch = require('./bunch')({ debug: true });

// bunch.define('testRouter', function (UserHandler) {
// 	console.log('testRouter');
// });

// bunch.define('CONFIG', function () {
// 	return {
// 		bla: 'bla',
// 		jo: 'jo'
// 	};
// });

// bunch.define('ImageHandler', function (CONFIG) {
// 	return new Promise((resolve, reject) => {
// 		// setTimeout(resolve, 4000);

// 		resolve({
// 			doSomething: () => console.log('something')
// 		});
// 	});
// });

// bunch.define('UserHandler', function (ImageHandler, utils) {
// 	return {
// 		getProfilePicture: id => ImageHandler.doSomething,
// 		getFullName: id => utils.userNameForId
// 	};
// });

// bunch.define('utils', function (CONFIG) {
// 	console.log('utils loaded.');
// 	return 'utils';
// });

// bunch.resolve(function (testRouter) {
// 	console.log('what? - ');
// })
// .catch(console.log);


// bunch.define('hi', () => 'world' );

bunch.define('TestDep', [{readOnly: true}, function () {

	let me$ = bunch.Observable({
		a: 'a',
		b: 'b'
	});

	me$.stream(function (newValue) {
		if (newValue.hasOwnProperty('hi') === false) {
			newValue.hi = 'yo';
			return newValue;
		}
	});

	return me$;
}])

bunch.resolve(function (TestDep$) {
	console.log('testDep$; ', TestDep$);
	TestDep$.value = { a: 'no', b: 'yeah' }

	bunch.resolve(function (TestDep) {
		console.log('testDep2: ', TestDep)
	})
})

