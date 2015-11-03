all:


lines:
	@echo -n "Lines: ";cat entipe.cgi entipe.js|grep -v ^$$|wc -l
