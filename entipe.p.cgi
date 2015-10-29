#! /bin/bash
export NYTPROF=addtimestamp=1:addpid=1:trace=1:start=init:file=/tmp/entipe.nytprof
CGI=$(dirname $0)/$(basename $0 .p.cgi).cgi
exec perl -d:NYTProf $CGI ${1+"$@"}
