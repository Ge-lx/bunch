const { define, resolve, Observable, ComputedObservable, loadModules } = bnc_bunch;

define('router', () => {
	const currentState$ = Observable('testState');
	const onClick = e => {
		switch (e.target.getAttribute('data-name')) {
			case 'test': currentState$.value = 'testState'; break;
			case 'another': currentState$.value = 'anotherState'; break;
		}
	};

	return {
		currentState$,
		$link: ($scope, element) => {
			element.addEventListener('click', onClick);
			$scope.$onDestroy(() => element.removeEventListener('click', onClick));
		}
	};
});

define('testState', (now$) => {
	const normalModuleAttrs = {
		now$,
		hello: 'world',
		arr: [1, 2, 3, 4]
	};

	return {
		$template: `
			<h1 bnc-bind="hello"></h1>
			<bnc-module name="test2">
				<div bnc-for="item in testArr">
					<p bnc-bind="item"></p>
				</div>
			</bnc-module>
		`,
		$link: ($scope, element) => {

		},
		...normalModuleAttrs
	};
});

define('anotherState', (now$) => {
	const normalModuleAttrs = {
		now$,
		hello: 'Another',
		arr: [1, 2, 3, 4]
	};

	return {
		$template: `
			<h1 bnc-bind="hello"></h1>
			<bnc-module name="test2">
				<div bnc-for="item in testArr">
					<p bnc-bind="item"></p>
				</div>
			</bnc-module>
		`,
		$link: ($scope, element) => {

		},
		...normalModuleAttrs
	};
});

define('now', function () {
    const now$ = Observable(Date.now());
    const updateTime = () => {
    	setTimeout(updateTime, 1000);
    	// a = window.performance.now();
        now$.value = Date.now();
        // b = window.performance.now() - a;
        // console.log(`${String(b * 1000).substr(0, 4)} us`);
        
    };

    updateTime();
    return now$;
});

define('testModule', (now$) => {
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
			for (let i = 0; i < 10; i++) {
				arr[i] = getInnerArray(x + i);
			}
			return arr;
		})
	};
});
	
define('sliderValueTest', function () {
	const sliderConfig = {
		label: 'Slider Test',
		max: 20 * 1000,
		min: 20,
		step: 1
	};

	const value$ = Observable(sliderConfig.max);
	
	return {
		$template: `
			<div class="slider">
				<h5 bnc-bind="label"></h5>
				<span bnc-bind="value$"></span>
				<input type="range" bnc-attr="min: min, max: max, step: step" bnc-model="value$"></input>
			</div>
		`,
		value$,
		...sliderConfig
	};
})