#! /usr/bin/perl
use strict;
use warnings;
use Marpa::R2;
use Data::Dumper;
use File::Map qw(map_file);

map_file my $eql, 'eql.marpa';

my $marpa = Marpa::R2::Scanless::G->new ({source => \$eql});

my $select = 'select * from "person"';

print Dumper($marpa->parse (\$select));
