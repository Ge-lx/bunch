# bnc.js - bunch node controller

## TAGS:
-------------------------------------------
Special HTML Tags are prefixed like bnc-

 [✓] `<bnc-root>`

	Marks the root of the bnc-app

 [✓] `<bnc-module>`

	Bind bunch modules with <bnc-module name="moduleName"> (modules can be observable)
	Consider in the following a module like:

	
	moduleName: {
		hello: 'world',
		someArray: ['A', 'B', 'C'],
		someObj: { a: 1, b: 2, c: 3 },
		bool: false
	}
	

 [✓] `<bnc-for>`
 
 	Iterare objects or arrays. Has to contain exactly one child element, which will be repeatet.

 	<bnc-for each="key, value of someObj">
 		<p class="repeatMe" bnc-bind="value"></p>
 	</bnc-for>

 	<bnc-for each="value in someArray">
 		<...></...>
 	</bnc-for>


## ATTRIBUTES:
--------------------------------------------
Special attributes are prefixed with a $
They are evaluated in the scope of their nearest enclosing <bnc->

```
 [✓] bnc-bind 		Bind 'textContent' of node

 [✓] bnc-css 		Bind 'style' of node

 [✓] bnc-class		Bind 'className' of node via an array

 [✓] bnc-if			Conditionally render element
 [x] $else 			Can follow an $if like <div $if="something"> 

 [✓] bnc-template	Use ${placeholders} in the textContent
```