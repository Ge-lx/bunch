const { define, resolve, Observable, ComputedObservable } = bnc_bunch;


define('now', function () {
    const now$ = Observable(Date.now());
    const updateTime = () => {
        now$.value = Date.now();
        setTimeout(updateTime, 1000);
    };

    updateTime();
    return now$;
});

define('testModule', function (now$) {
	let last = false;
	let a = 0;
	return ComputedObservable(now$, function (now) {
		last = !last;
		a++;

		return {
			now: now,
			hello: 'world!',
			showHello: last,
			nowString: 'Hello, world! at ' + now,
			testArr: [a + 1, a + 2, a + 3, 4, 5, 6, 7, 8],
			testObj: { a: 'hi', b: [1, 2, 3, 4], bool: last }
		};
	});
});

define('test2', function () {
	return {
		testArr: [1, 2, 3, 4, 5, 6, 7, 8]
	};
});


define('nestedForLoopModule', function () {
	const getInnerArray = () => [1, 2, 3, 4];

	return {
		outerArray: [getInnerArray(), getInnerArray(), getInnerArray(), getInnerArray()]
	};
});
	
