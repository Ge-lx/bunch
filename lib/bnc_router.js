(function ({ define, resolve, load, Observable, ComputedObservable }) {
	// Define a observable module to act as the path-backend
	define('fragment', (utils) => {
		const fragment$ = Observable();
		const onHashChange = () => {
			const parsedFragment = utils.parseQueryParms(window.location.hash.substring(1));
			fragment$.value = parsedFragment;
		};

		fragment$.onChange((newObj, oldObj) => {
			if (newObj !== oldObj) {
				window.location.hash = utils.serializeQueryParams(newObj)	
			}
		});
		window.addEventListener('hashchange', onHashChange);

		onHashChange();
		return fragment$;
	});

	// Bind the path backend.
	define('path', (fragment$) => fragment$);

	define('bnc_router', (fragment$, $states, path$) => {
		// Check $states definition
		if (Array.isArray($states) === false) {
			console.error('bnc_router expectes \'$states\' to be defined as an array of the state\'s module\'s names. Got ', $states);
		}
		return Promise
			.all($states
				.map(stateName => load(stateName)
					.then(({ value: loadedModule }) => {
						const isValidModule = ['$when', '$go'].every(ident => typeof loadedModule[ident] === 'function');
						if (!isValidModule) {
							console.error(`Could not load '${stateName}' because it is not a valid state: `, loadedModule);
							return null;
						}
						loadedModule.$name = stateName;
						return loadedModule;
					})
					.catch(error => {
						console.error(`Could not load '${stateName}': `, error);
						return null;
					})))
			.then(loadedAndFaliedStates => loadedAndFaliedStates.filter(state => state !== null))
			.then(states => {
				const currentState$ = Observable();

				path$.stream((path, oldPath) => {
					const matchingStates = states.filter(state => state.$when(path));
					if (matchingStates.length > 1) {
						console.error('Multiple states matched ', { path, matchingStates });
					} else if (matchingStates.length < 1) {
						console.error('No state matched ', { path });
					} else {
						const newState = matchingStates[0];
						const oldState = currentState$.value;
						if (newState === oldState) {
							return;
						}
						if (oldState && typeof oldState.$onLeave === 'function') {
							oldState.$onLeave();
						}
						if (typeof matchingStates[0].$onEnter === 'function') {
							matchingStates[0].$onEnter();
						}
						currentState$.value = newState;
					}
				});

				const currentStateName$ = ComputedObservable(currentState$, state => state.$name);
				return {
					path$,
					currentState$,
					currentStateName$,
					states,
					$template: `<bnc-state name="currentStateName$"></bnc-state>`
				};
			});
	});

/*	Documentation by example

	define('state_home', (path$) => {

		return {
			$go: () => path$.value = {}, // Set the path$ to a value which identifies this state
			$when: path => Object.keys(path).length === 0, // Recognize the path$ value corresponding to this state
			$onEnter: () => {}, // Callback which is called on entering this state (not required)
			$template: `
				<div> Hello, world! </div>
			`
		};
	});

	define('$states', () => ['state_home']); // The $states array which informs 'bnc_router' of the existing states


// Usage of the router element:
// index.html

<html>
	<body>
		<bnc-root>
			<bnc-element name="bnc_router"></bnc-element>
		</bnc-root>
	<body>
<html>
*/

}(bnc_bunch));