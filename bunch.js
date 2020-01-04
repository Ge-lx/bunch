// bunch.js - v1.0
// compact javascript bundler
// ---------------
// author: gelx
// license: isc

const isObserable = value => {
	return (value && value._$) ? true : false;
};
const Observable = (initialValue, readOnly = false) => {
	if (isObserable(initialValue)) {
		if (readOnly) {
			return {
				_$: true,
				isObserable,
				onChange: callback => {
					initialValue.onChange(callback);
				},
				stream: callback => {
					initialValue.stream(callback);
				},
				get value () {
					return initialValue.value;
				}
			};
		}
		return initialValue;
	}
	if (readOnly) {
		return Observable(Observable(initialValue, false), true);
	}

	let value = initialValue;
	let listeners = [];

	const registerListenerReturnUnbinder = callback => {
		listeners.push(callback);
		return () => {
			listeners = listeners.filter(listenerCb => listenerCb !== callback);
		};
	}

	return {
		_$: true,
		isObserable,
		onChange: (callback) => {
			return registerListenerReturnUnbinder(callback);
		},
		stream: (callback) => {
			const unbinder = registerListenerReturnUnbinder(callback);
			callback(value);
			return unbinder;
		},
		get value () {
			return value;
		},
		set value (newValue) {
			let oldValue = value;
			value = newValue;
			listeners.forEach(listener => {
				// Listeners can overwrite the current change by returning a truthy value to be used for further calls
				let newValue = listener(value, oldValue)
				if (newValue) {
					oldValue = value;
					value = newValue;
				}
			});
		}
	};
}

const init = function setup (cfg = {}) {
	const config = {
		version: 1.0,
		debug: cfg.debug || false,
		registrationTimeout: cfg.registrationTimeout || 5000
	};

	const utils = {
		getArguments: (func) => {
		    const ARROW = true;
		    const FUNC_ARGS = ARROW ? /^(function)?\s*[^\(]*\(\s*([^\)]*)\)/m : /^(function)\s*[^\(]*\(\s*([^\)]*)\)/m;
		    const FUNC_ARG_SPLIT = /,/;
		    const FUNC_ARG = /^\s*(_?)(.+?)\1\s*$/;
		    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

		    return ((func || '').toString().replace(STRIP_COMMENTS, '').match(FUNC_ARGS) || ['', '', ''])[2]
		        .split(FUNC_ARG_SPLIT)
		        .map(function(arg) {
		            return arg.replace(FUNC_ARG, function(all, underscore, name) {
		                return name.split('=')[0].trim();
		            });
		        })
		        .filter(String);
		}
	};

	const Log = {
		info: string => console.log(`Bunch v${config.version}: ${string}`),
		debug: (string, obj) => {
			if (config.debug === true) {
				if (obj) {
					console.log(`Bunch v${config.version}: ${string}`, obj);
				} else {
					Log.info(string);
				}
				
			}
		}
	};

	const activeModules = {};
	const registeredModules = {};

	const registrations = (function () {
		let callbackMap = {};

		return {
			when: (name) => {
				if (registeredModules.hasOwnProperty(name)) {
					return Promise.resolve(registeredModules[name]);
				}

				return new Promise((resolve, reject) => {
					Log.debug(`Waiting for registration of ${name}...`);
					if (callbackMap.hasOwnProperty(name)) {
						callbackMap[name].push(resolve);
					} else {
						callbackMap[name] = [resolve];
					}

					const timeout = setTimeout || window.setTimeout;
					timeout(() => {
							reject(new Error(`Did not see registration of '${name}' within 5000ms of first resolvement. Did you define it?`));
						},
						config.registrationTimeout
					);
				});
			},
			register: (config) => {
				if (registeredModules.hasOwnProperty(config.name)) {
					throw new Error(`Modulename '${config.name}'' is already taken, sorry. Choose a different one.`);
				}
				registeredModules[config.name] = config;

				if (callbackMap.hasOwnProperty(config.name)) {
					let callbacks = callbackMap[config.name];
					delete callbackMap[config.name];

					callbacks.forEach(callback => {
						return callback(config);
					});
				}
			}
		}
	}());

	const loadModule = (moduleConfig, waitingChain = []) => {
		if (waitingChain.includes(moduleConfig.name)) {
			throw new Error(`Circular dependency detected. Module '${moduleConfig.name}' is waiting for itself through '${waitingChain[waitingChain.length - 1]}'.`)
		}
		if (activeModules.hasOwnProperty(moduleConfig.name)) {
			return Promise.resolve(activeModules[moduleConfig.name]);
		}

		let moduleLoadedCallback = function () {};
		if (moduleConfig.noCache !== true) {
			Log.debug(`Loading module ${moduleConfig.name}...`, waitingChain);
			waitingChain = [...waitingChain, moduleConfig.name];

			activeModules[moduleConfig.name] = new Promise((resolve, reject) => {
				moduleLoadedCallback = resolve;
			});
		}

		const dependencies = Promise.all(utils
			.getArguments(moduleConfig.loadingFunction)
			.map(dependencyExpression => {
				const split = dependencyExpression.split('|'); // Yes, this doesn't work
				const as$ = split[0].endsWith('$');
				const name = as$ ? split[0].slice(0, -1) : split[0];
				const version = split[1];

				return registrations.when(name)
					.then(config => {
						if (version && config.version !== version) {
							throw new Error(`Version mismatch for '${name}": Expected ${version}, found ${config.version}`);
						}
						return { config, as$ };
					});
			}));

		const loadingModule = dependencies
			.then(dependencies => {
				return Promise.all(dependencies
					.map(({ config, as$ }) => {
						Log.debug(`Loading '${config.name}' as dependency of '${moduleConfig.name}'`);
						return loadModule(config, waitingChain)
							.then( moduleProperty => {
								return { moduleProperty, as$ };
							});
				}));
			});

		return loadingModule
			.then(loadedDependencies => {
				const $orValueDependencies = loadedDependencies.map(({ moduleProperty, as$ }) => {
					return as$ ? moduleProperty.$ : moduleProperty.$.value;
				});

				return moduleConfig.loadingFunction(...$orValueDependencies);
			})
			.then(resolvedModule => {
				const module$ = Observable(resolvedModule, moduleConfig.readOnly === true)
				const loadedModule = {
					config: moduleConfig,
					$: module$
				};

				if (moduleConfig.noCache !== true) {
					moduleLoadedCallback(loadedModule);
					activeModules[moduleConfig.name] = loadedModule;
				};

				Log.debug(`Loaded '${moduleConfig.name}'`);
				return loadedModule;
			})
	};

	const external = (name, url) => {
		throw new Error(`External registrations are not yet supported.`);
	};

	const define = (...args) => {
		let config = {
			name: args[0],
			...(Array.isArray(args[1]) ? 
				{ ...args[1][0], loadingFunction: args[1][1] } :
				{ version: 0, loadingFunction: args[1] }
			)
		};

		Log.debug(`Module registration with: `, config);

		if (typeof config.loadingFunction !== 'function' || typeof config.name !== 'string') {
			throw new Error(`Module '${config.name}'' is not properly exported. Use: \n\n 	bunch.export(name, loader);\n or  bunch.export(name, [{...config}, loader]);`);
		}

		registrations.register(config);
	};

	const resolve = fn => {
		if (typeof fn !== 'function') {
			throw new Error(`Argument is not of type function. Usage:\n    bunch.get( (...dependencies) => { /* your code */ }).then(...)!`);
		}
		return loadModule({
			name: 'resolve',
			noCache: true,
			loadingFunction: fn
		});
	};

	return { external, define, resolve, Observable, isObserable };
};

const bunch = init;
if (typeof exports === "object") {
  module.exports = bunch
}