compile:
	browserify --bare index.js --im -o test.js && tessel push -s test.js

.PHONY: compile
