#!/usr/bin/env make
# =============================================================================
# streetmp-ctl — Build Makefile
# Dual-target: linux/amd64 (K3s host) + darwin/arm64 (Mac admin workstation)
# =============================================================================

BINARY    := streetmp-ctl
VERSION   := v100.0.0
BUILD_DIR := ./dist
LDFLAGS   := -ldflags="-X 'main.Version=$(VERSION)' -s -w"

.PHONY: all clean linux mac

all: linux mac

linux:
	@echo "Building $(BINARY) for linux/amd64..."
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY)-linux-amd64 ./main.go
	@echo "✓ $(BUILD_DIR)/$(BINARY)-linux-amd64"

mac:
	@echo "Building $(BINARY) for darwin/arm64..."
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY)-darwin-arm64 ./main.go
	@echo "✓ $(BUILD_DIR)/$(BINARY)-darwin-arm64"

clean:
	rm -rf $(BUILD_DIR)

install: linux
	@echo "Installing to /usr/local/bin/streetmp-ctl"
	sudo cp $(BUILD_DIR)/$(BINARY)-linux-amd64 /usr/local/bin/streetmp-ctl
	sudo chmod +x /usr/local/bin/streetmp-ctl
	@echo "✓ streetmp-ctl installed"
