(function ({ define, resolve, Observable, ComputedObservable }) {
	// Utility for binding to scope values/observables via element's html attributes
	// For usage examples see elements below
	define('bind', () => {
		return (scope, element, obj) => {
			const results = {};
			for (let attributeName of obj) {
				const expression = element.getAttribute(attributeName);
				if (attributeName.endsWith('$')) {
					results[attributeName] = scope.$get$(expression);
				} else {
					results[attributeName] = scope.$get(expression);
				}
			}
			return results;
		};
	});

	define('element_input', [{ noCache: true }, (bind) => {
		return {
			$template: `
				<div class="element_input__holder">
					<input class="clickable" type="text" bnc-model="model$"
						bnc-attr="name: input_name, readonly: input_readonly$.value, placeholder: input_placeholder"/>
					<div bnc-class="buttonClass$" bnc-click="submit()" bnc-bind="input_button_text"></div>
				</div>
			`,
			$link: (scope, element) => {
				const bindings = bind(scope, element, ['input_model$', 'input_name', 'input_readonly$', 'input_placeholder', 'input_button_text', 'input_show_button']);
				
				const model$ = Observable(bindings.input_model$.value);
				const submit = () => {
					if (bindings.input_readonly$.value !== true) {
						bindings.input_model$.value = model$.value;
					}
				};
				const keyDownHandler = (event) => {
					if (event.code === 'Enter') {
						submit();
					}
				};

				const shouldShowButton = (function () {
					switch (bindings.input_show_button || 'CHANGED') {
						case 'NON_EMPTY':
							return (model, external) => model !== '';
						case 'CHANGED': // fall through
						default:
							return (model, external) => model !== external;
					}
				}());

				element.addEventListener('keydown', keyDownHandler);
				const unbindExternalModule = bindings.input_model$.onChange(input => {
					model$.value = input || '';
				});
				const buttonClass$ = ComputedObservable([bindings.input_readonly$, model$], (readonly, model) => {
					const externalValue = bindings.input_model$.value;
					const canEdit = bindings.input_readonly$.value !== true;
					const show = canEdit && shouldShowButton(model, externalValue);
					return 'element_input__button' + (show ? '' : ' hide');
				});

				scope.$onDestroy(() => {
					unbindExternalModule();
					buttonClass$.destroy();
					element.removeEventListener('keydown', keyDownHandler);
				});

				scope.$assign({
					...bindings,
					buttonClass$,
					model$,
					submit
				});
			},
		};
	}]);

	define('element_choice', [{ noCache: true }, (bind) => {
		return {
			$template: `
				<div class="element_choice__holder" bnc-for="choice in choices$">
					<div class="element_choice__choice clickable" bnc-click="selected$.value = choice">
						<div bnc-class="choiceClass_$(choice[choice_key])"></div>
						<div bnc-bind="choice[choice_name]"></div>
					</div>
				</div>
			`,
			$link: (scope, element) => {
				const bindings = bind(scope, element, ['choices$', 'selected$', 'choice_name', 'choice_key']);

				const choiceClassObservableMap = bindings.choices$.value.reduce((acc, curr) => {
					const thisChoiceKey = curr[bindings.choice_key];
					acc[thisChoiceKey] = ComputedObservable(bindings.selected$, selectedChoice => {
						return 'checkbox' + (selectedChoice[bindings.choice_key] === thisChoiceKey ? ' selected' : '');
					});
					return acc;
				}, {});

				// This prevents a memory leak, I think. Maybe the references are deleted though **hmm*
				scope.$onDestroy(() => {
					for (let observable of choiceClassObservableMap) {
						observable.destroy();
					}
				});

				const choiceClass_$ = (choiceKey) => {
					return choiceClassObservableMap[choiceKey];
				};

				scope.$assign({ ...bindings, choiceClass_$ });
			}
		};
	}]);

}(bnc_bunch));