include node_modules/make-lint/index.mk

test: lint 
	./node_modules/.bin/_mocha

coverage:
	./node_modules/istanbul/lib/cli.js cover ./node_modules/.bin/_mocha	

.PHONY: test coverage
