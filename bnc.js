/* bnc.js - bunch node controller */

(function () {
	const bnc_bunch = bunch({ debug: true });
	const { define, resolve, load, Observable, ComputedObservable, debug } = bnc_bunch;

	const ID = (function () {
		let id = 1;
		return () => ++id;
	}());

	const evalInScope = (scope, expression) => {
	    const evaluator = Function.apply(null, [...Object.keys(scope), 'expr', 'return eval(expr)']);
	    return evaluator.apply(null, [...Object.values(scope), expression]);
	};

	(function augmentPromise () {
		Promise.try = (handler, ...args) => {
			try {
				if (args.length > 0) {
					handler = handler.bind(null, ...args);
				}
				var value = handler();
				if (value instanceof Promise) {
					return value;
				} else {
					return Promise.resolve(value);	
				}
			} catch (error) {
				return Promise.reject(error);
			}
		};
	}());

	const bnc_scope = ($, $parent) => {
		const onDestroyCallbacks = [];
		const onDestroy = (cb) => {
			onDestroyCallbacks.push(cb);
		};

		const $registerWatcher = (function (){
			const registerWatchers = [];
			let unbindWatchers = [];

			const activateWatcher = (watcher, immediate = true) => {
				if ($.value.hasOwnProperty(watcher.identifier)) {
					const obs = Observable($.value[watcher.identifier]);
					const unbind = immediate ? obs.stream(watcher.update) : obs.onChange(watcher.update);
					unbindWatchers.push(unbind);
				} else {
					throw new Error(`Failed to activate watcher for '${watcher.identifier}' on ${$.value}`);
				}
			};

			const unbindFromObservable = $.onChange(() => {
				unbindWatchers.forEach(unbind => unbind());
				unbindWatchers = [];
				registerWatchers.forEach(watcher => activateWatcher(watcher));
			});
			onDestroy(() => {
				unbindWatchers.forEach(unbind => unbind());
				unbindFromObservable();
			});

			return (identifier, update, immediate = true) => {
				if (identifier.includes('.')) {
					const idx = identifier.indexOf('.');
					const variable = identifier.slice(0, idx);
					const expression = identifier.slice(idx + 1, identifier.length);

					const evalAndUpdate = (function (originalUpdate){
						return (variableValue) => {
							const evaluated = (function () {
								try {
									return evalInScope(variableValue, expression);
								} catch (error) {
									console.error('Error while evaluating expression: ', { variable, variableValue, expression, error });
									return null;
								}
							}());
							originalUpdate(evaluated);
						};
					}(update));

					[identifier, update] = [variable, evalAndUpdate];
				}
				const watcher = { identifier, update };
				try {
					activateWatcher(watcher, immediate);
					registerWatchers.push(watcher);
				} catch (error) {
					$parent.$watcher(identifier, update, immediate);
				}	
			};
		}());

		return {
			$bnc_scope: true,
			id: ID(),
			$,
			$parent,
			onDestroy,
			$watcher: $registerWatcher,
			$destroy () { onDestroyCallbacks.forEach(cb => cb()); },
			$get (identifier) {
				if ($.value.hasOwnProperty(identifier)) {
					return Observable($.value[identifier]).value;
				} else {
					return $parent.$get(identifier);
				}
			}
		};
	};

	define('debounce', () => {
	    return (delay, callee) => {
	        let lastCall = Date.now() - delay;
	        return (...args) => {
	            const now = Date.now();
	            if (now - lastCall > delay) {
	                lastCall = now;
	                return callee(...args);    
	            } else {
	                lastCall = now;
	            }
	        };
	    };
	});

	define('bnc_docready', () => {
	    return new Promise((pResolve, pReject) => {
	        document.addEventListener("DOMContentLoaded", pResolve);
	    });
	});

	define('bnc', () => {
		let scope_map = {};
		const controllers = [];
		const directives = [];

		const $link = (bnc_scope, element) => {
			const idString = `$${bnc_scope.id}`
			element.setAttribute('bnc-id', idString);
			scope_map[idString] = bnc_scope;
		};

		const $unlink = (element) => {
			const idFromElem = element.getAttribute('bnc-id');
			element.removeAttribute('bnc-id');
			const scope = scope_map[idFromElem];
			delete scope_map[idFromElem];
			return scope;
		};

		const $nearest = (element) => {
			const nearestModuleElement = element.closest('[bnc-id]');
			const bncModuleId = nearestModuleElement ? nearestModuleElement.getAttribute('bnc-id') : null;
			return bncModuleId ? scope_map[bncModuleId] : null;
		};

		const $activateChildren = (handlers, element, activateElement = false) => {
			const pendingActivations = [];

			if (activateElement) {
				handlers.forEach(({ selector, handler }) => {
					if (element.matches(selector)) {
						pendingActivations.push(handler(element, $nearest(element)))
					}
				});
			}

			return Promise.all(pendingActivations)
				.then(() => {
					const childrenActivations = [];

					for (let child of element.children) {
						childrenActivations.push($activateChildren(handlers, child, true));
					}

					return Promise.all(childrenActivations);
				});
		};

		const $destroy = (element, includeElement = false) => {
			const unbindAndDestroy = element => {
				const scope = $unlink(element);
				scope.$destroy();
			};

			const childBncModuleElements = element.querySelectorAll('[bnc-id]');
			childBncModuleElements.forEach(unbindAndDestroy);

			if (includeElement) {
				unbindAndDestroy(element);
			}
		};

		const $rebuildSubtree = (element) => {
			return Promise.resolve()
				.then(() => $activateChildren(controllers, element))
				.then(() => $activateChildren(directives, element));
		};

		const $rebuild = () => { 
			const $element = document.querySelector('bnc-root').parentElement
			$destroy($element);
			if (Object.keys(scope_map).length > 0) {
				console.error('$destory() on $rootElement did not empty scope_map: ', scope_map);
				scope_map = {};
			}
			return $rebuildSubtree($element);
		};

		const $refresh = () => {
			if (Object.keys(scope_map).length > 0) {
				return $rebuild();
			}
		};

		return {
			$link,
			$unlink,
			$nearest,
			$destroy,
			scope_map,
			$rebuildSubtree,
			$rebuild,
			$controller (selector, handler) {
				if (debug) {
					console.log(`$controller registered for selector ${selector}`);	
				}
				controllers.push({
					selector,
					handler: (element, nearest) => {
						return Promise.try(handler, element, nearest)
							.then(returnValue => {
								if (returnValue && returnValue.$bnc_scope === true) {
									$link(returnValue, element);
								}
							});
					}
				});
				$refresh();
			},
			$directive (selector, handler) { 
				if (debug) {
					console.log(`$directive registered for selector ${selector}`);	
				}
				directives.push({
					selector,
					handler: (element, nearest) => Promise.try(handler, element, nearest)
				});
				$refresh();
			}
		};
	});

	define('bnc_root', (bnc) => {
		return bnc.$controller('bnc-root', (element) => {
			return {
				id: 'root',
				$destroy () {},
				$watcher (identifier) { console.error(`$watcher for identifier ${identifier} bubbled up to bnc_root.`); },
				$get (identifier) { console.error(`$get for identifier ${identifier} bubbled up to bnc_root.`);	}
			};
		});
	});

	define('bnc_module', (bnc) => {
		return bnc.$controller('bnc-module', (element, bnc_parent) => {
			const moduleName = element.getAttribute('name');
			if (!moduleName) {
				console.error(`Missing 'name' attribute on <bnc-module> tag: `, element);
				return;
			}
			return load(moduleName)
				.then((module$) => {
					const scope = bnc_scope(module$, bnc_parent);

					if (typeof module$.value.$link === 'function') {
						module$.value.$link(scope, element);
					}
					return scope;
				})
				.catch(error => console.error(`Failed to load module ${moduleName} `, error));
		});
	});

	// Todo unify with bnc_state
	define('bnc_element', (bnc) => {
		bnc.$controller('bnc-element', (element, $nearest) => {
			const stateName = element.getAttribute('name');
			
			return load(stateName)
				.then(module$ => {
					const template = module$.value.$template;
					if (typeof template !== 'string') {
						console.error(`bnc-element - ${name} does not define a $template`);
						return;
					}
					element.innerHTML = template;

					const $scope = bnc_scope(module$, $nearest);
					if (typeof module$.value.$link === 'function') {
						module$.value.$link($scope, element);
					}
					return $scope;
				})
				.catch(error => console.error(`bnc-element - could not find ${stateName}`, error));
		});
	});

	define('bnc_state', (bnc) => {
		bnc.$controller('bnc-state', (element, $nearest) => {
			const identifier = element.getAttribute('name');
			
			let $scope = null;
			const updateScope = stateName => load(stateName)
				.then(module$ => {					
					const template = module$.value.$template;
					if (typeof template !== 'string') {
						console.error(`bnc-router - ${name} does not define a $template`);
						return;
					}
					element.innerHTML = template;

					if ($scope !== null) {
						bnc.$destroy(element, true);
					}
					$scope = bnc_scope(module$, $nearest);
					if (typeof module$.value.$link === 'function') {
						module$.value.$link($scope, element);
					}
					bnc.$link($scope, element);
				});
			
			$nearest.$watcher(identifier, stateName => {
				return updateScope(stateName)
					.then(() => bnc.$rebuildSubtree(element))
					.catch(error => console.error(`bnc-router - could not find ${stateName}`));
			}, false);

			const stateName = $nearest.$get(identifier)
			return updateScope(stateName)
				.catch(error => console.error(`bnc-router - could not find ${stateName}`))
				.then(() => null); // We don't want bnc to bind it twice
		});
	});

	define('bnc_for', (bnc) => {
		const OBJ_REGEX = /^([$A-Z_][0-9A-Z_$]*), ([$A-Z_][0-9A-Z_$]*) of ([$A-Z_][0-9A-Z_$]*)$/i;
		const ARR_REGEX = /^(?:([$A-Z_][0-9A-Z_$]*), )?([$A-Z_][0-9A-Z_$]*) in ([$A-Z_][0-9A-Z_$]*)$/i;

		return bnc.$controller('[bnc-for]', (element, nearestModule) => {
			return new Promise((resolve, reject) => {
				const expression = element.getAttribute('bnc-for');
				let createChildren = null;
				let identifier = null;

				if (element.children.length !== 1) {
					console.error('<bnc-for> must have exactly one child node.');
					return;
				}
				const childTemplateElement = element.children[0];
				element.removeChild(childTemplateElement);

				const createChild = (scopeObj) => {	
					const childScope = bnc_scope(Observable(scopeObj), nearestModule);
					const clonedElement = childTemplateElement.cloneNode(true);
					childScope.onDestroy(() => {
						element.removeChild(clonedElement)
					});
					element.appendChild(clonedElement);
					bnc.$link(childScope, clonedElement);
				};

				const objMatch = expression.match(OBJ_REGEX);
				if (objMatch !== null) {
					identifier = objMatch[3];
					const keyIdf = objMatch[1];
					const valIdf = objMatch[2];

					createChildren = obj => {
						for (key in obj) {
							const scopeObj = {};
							scopeObj[keyIdf] = key;
							scopeObj[valIdf] = obj[key];
							createChild(scopeObj);
						}
					};
				} else {
					const arrMatch = expression.match(ARR_REGEX);
					if (arrMatch === null) {
						console.error(`Invalid expression for <bnc-for> ${expression}`);
					}
					identifier = arrMatch[3];
					const idxIdf = arrMatch[1];
					const valIdf = arrMatch[2];

					createChildren = array => {
						array.forEach((val, idx) => {
							const scopeObj = {};
							if (idxIdf) {
								scopeObj[idxIdf] = idx;
							}
							scopeObj[valIdf] = val;
							createChild(scopeObj);
						});
					};
				}

				nearestModule.$watcher(identifier, value => {
					bnc.$destroy(element);
					createChildren(value);
					bnc.$rebuildSubtree(element);
				}, false);

				createChildren(nearestModule.$get(identifier));
				resolve();
			});
		});
	});

	define('bnc_bind', (bnc) => {
		return bnc.$directive('[bnc-bind]', (element, nearestModule) => {
			const identifier = element.getAttribute('bnc-bind');
			nearestModule.$watcher(identifier, value => {
				element.textContent = value;
			});
		});
	});

	define('bnc_css', (bnc) => {
		return bnc.$directive('[bnc-css]', (element, nearestModule) => {
			const identifier = element.getAttribute('bcn-css');
			nearestModule.$watcher(identifier, value => {
				element.style = value;
			});
		});
	});

	define('bnc_class', (bnc) => {
		return bnc.$directive('[bnc-class]', (element, nearestModule) => {
			const identifier = element.getAttribute('bnc-class');
			nearestModule.$watcher(identifier, value => {
				const classArray = Array.isArray(value) ? value : [value];
				element.className = classArray.join(' ');
			});
		});
	});

	define('bnc_if', (bnc) => {
		return bnc.$directive('[bnc-if]', (element, nearestModule) => {
			const identifier = element.getAttribute('bnc-if');
			nearestModule.$watcher(identifier, value => {
				element.style.display = !!value ? '' : 'none';
			});
		});
	});

	define('bnc_template', (bnc, debounce) => {
		const TEMPLATE_REGEX = /\${[$A-Z_][0-9A-Z_$]*}/gmi
		const ILLEGAL_PLACEHOLDERS = /\${(?:[0-9A-Z_$]*[^0-9A-Z_${}]+[0-9A-Z_$]*)+}/gi

		bnc.$directive('[bnc-template]', (element, nearestModule) => {
			const rawTemplate = element.textContent;
			let templateString = '`' + rawTemplate.replace(/`/g, '\\`') + '`';
			templateString = templateString.replace(ILLEGAL_PLACEHOLDERS, '');

			const identifiers = [];
			templateString.match(TEMPLATE_REGEX).forEach(match => {
				identifiers.push(match.substring(2, match.length - 1));
			});

			const map = {};
			const onChange = debounce(100, () => {
				let populatedString = eval(templateString);
				element.textContent = populatedString;
			});

			identifiers.forEach(identifier => {
				templateString = templateString.replace(identifier, `map.${identifier}`);
				nearestModule.$watcher(identifier, value => {
					map[identifier] = value;
					onChange();
				});
			});
		});
	});

	define('bnc_ready', (bnc, bnc_root, bnc_module, bnc_element, bnc_state, bnc_bind, bnc_css, bnc_class, bnc_if, bnc_for, bnc_template, bnc_docready) => {
		bnc.$rebuild();
	});
	load('bnc_ready');

	window.bnc_bunch = bnc_bunch;
}());
