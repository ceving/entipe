DOC_BRANCH := gh-pages
CLIENT_SRC := entipe.js
SERVER_SRC := entipe.cgi
SRC := $(CLIENT_SRC) $(SERVER_SRC)

CLIENT_DOC_DIR := $(DOC_BRANCH)/client
CLIENT_DOC_HTML := $(CLIENT_DOC_DIR)/index.html

all:

doc: $(CLIENT_DOC_HTML)

lines:
	@cat $(SRC) | grep -v ^$$ | wc -l

.PHONY: all doc clean lines

$(CLIENT_DOC_DIR):
	mkdir -p $@

.PHONY: $(CLIENT_DOC_HTML)

$(CLIENT_DOC_HTML): entipe.js client.md $(DOC_BRANCH) $(CLIENT_DOC_DIR)
	rm -rf $(CLIENT_DOC_DIR)/*
	jsdoc -R client.md -c client.json -d $(CLIENT_DOC_DIR) $<

$(DOC_BRANCH):
	git clone `git ls-remote --get-url` --branch $@ --single-branch $@
