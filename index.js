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

bunch.define('TestDep', [{readOnly: false}, function () {

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

bunch.define('TestDep2Computed', function (TestDep$, ComputedObservable) {
	return ComputedObservable(TestDep$, function (TestDep) {
		return {
			...TestDep,
			blaaa: 'asdf'
		};
	});
})


bunch.resolve(function (TestDep$, TestDep2Computed$) {

	TestDep2Computed$.onChange(function (value) {
		console.log('TestDep2Computed changed: ', value);
	});

	console.log('testDep$; ', TestDep$);
	TestDep$.value = { a: 'no', b: 'yeah' }

	bunch.resolve(function (TestDep) {
		console.log('testDep2: ', TestDep);
	})
})

