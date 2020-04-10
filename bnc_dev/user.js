const { define, resolve, Observable, ComputedObservable } = bnc_bunch;

define('now', function () {
    const now$ = Observable(Date.now());
    const updateTime = () => {
    	a = window.performance.now();
        now$.value = Date.now();
        b = window.performance.now() - a;
        console.log(`${String(b * 1000).substr(0, 4)} us`);
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

		// let b = 0
		// while (b < 1000000) {
		// 	b++;
		// }

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

define('nestedForLoopModule', function (now$) {
	const getInnerArray = (a) => [a+1, a+2, 3, 4];
	let x = 0;

	return {
		outerArray$: ComputedObservable(now$, function (now) {
			let arr = [];
			x++;
			for (let i = 0; i < 10 + x; i++) {
				arr[i] = getInnerArray(x + i);
			}
			return arr;
		})
	};
});
	
