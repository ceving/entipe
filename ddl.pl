#! /usr/bin/perl
use strict;
use warnings;
use Marpa::R2;
use Data::Dumper;
use File::Map qw(map_file);

sub create_table
{
  my $self = shift;
  print Dumper (@_);
  exit;
}

sub table_element_list
{
  my $self = shift;
  print Dumper (@_);
  exit;
}

sub column_definition
{
  my $self = shift;
  print Dumper (@_);
  exit;
}

map_file my $bnf, 'ddl.marpa';
map_file my $input, 'demo.ddl';

my $grammar = Marpa::R2::Scanless::G->new ({
  bless_package => 'main',
  source => \$bnf});

#print Dumper($grammar->parse (\$input));


my $recce = Marpa::R2::Scanless::R->new ({ grammar => $grammar });
my $self = bless { grammar => $grammar };
$self->{recce} = $recce;

if (not defined eval { $recce->read(\$input); 1 })
{
  my $eval_error = $@;
  chomp $eval_error;
  die $self->show_last_expression(), "\n", $eval_error, "\n";
}

my $value_ref = $recce->value ($self);
if (not defined $value_ref) {
  die $self->show_last_expression(), "\n",
  "No parse was found, after reading the entire input\n";
}
