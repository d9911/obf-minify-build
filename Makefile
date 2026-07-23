PACKAGE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

-include config.mk

SRC_DIR ?= src
BUILD_DIR ?= build

.PHONY: all clean lint test

all:
	node "$(PACKAGE_DIR)bin/cli.js" --src "$(SRC_DIR)" --out "$(BUILD_DIR)"

clean:
	node -e "require('node:fs').rmSync(process.argv[1], { recursive: true, force: true })" "$(BUILD_DIR)"

lint:
	npm run lint

test:
	npm test
