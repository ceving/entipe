#! /usr/bin/perl

use strict;
use warnings;
use Marpa::R2;
use Data::Dumper;
use File::Map qw(map_file);
use JSON;

sub lhs {
  my ($lhs) = map {
    $Marpa::R2::Context::slg->symbol_display_form($_)
  } $Marpa::R2::Context::slg->rule_expand($Marpa::R2::Context::rule);
  return $lhs;
}

sub dump_and_exit
{
  my ($self, @args) = @_;
  print lhs, "\n", Dumper (@args);
  exit;
}

sub make_hash_by_name_of
{
  my ($child, @args) = @_;
  my $hash = {};
  for my $element (@args) {
    if (ref $element eq 'HASH') {
      $element = $element->{$child};
      my $name = $element->{name};
      delete $element->{name};
      $hash->{$name} = $element;
    }
  }
  return $hash;
}

sub join_hashes
{
  my ($self, @args) = @_;
  my $jh = {};
  for my $h (@args) {
    @$jh{keys %$h} = values %$h;
  }
  return $jh;
}

sub ddl
{
  my ($self, @args) = @_;
  return make_hash_by_name_of ('table', @args);
}

sub create_table
{
  my ($self, @args) = @_;
  my @columns = grep {exists $_->{column}} @{$args[1]};
  my $columns = make_hash_by_name_of ('column', @columns);
  my @primary_key = grep {exists $_->{primary_key}} @{$args[1]};
  @primary_key = @{$primary_key[0]->{primary_key}} if scalar @primary_key > 0;
  # Normalize primary key constrain.
  for my $c (keys %$columns) {
    if (defined $columns->{$c}->{constrains} &&
        exists $columns->{$c}->{constrains}->{primary_key} &&
        $columns->{$c}->{constrains}->{primary_key}) {
      push @primary_key, $c;
      delete $columns->{$c}->{constrains}->{primary_key};
      undef $columns->{$c}->{constrains} if scalar (keys %{$columns->{$c}->{constrains}}) == 0;
    }
  }
  my @unique = grep {exists $_->{unique}} @{$args[1]};
  my $unique;
  $unique = "TODO" if scalar (@unique) > 0;
  my @references = grep {exists $_->{reference}} @{$args[1]};
  my $references;
  $references = [ map {$_->{reference}} @references ] if scalar (@references) > 0;
  return {table => {name => $args[0],
                    columns => $columns,
                    primary_key => \@primary_key,
                    unique => $unique,
                    references => $references}};
}

sub table_unique_constrain
{
  my ($self, @args) = @_;
  return {(keys %{$args[0]})[0] => $args[1]};
}

sub referential_constraint_definition
{
  my ($self, @args) = @_;
  my $ref = $args[1];
  $ref->{source} = $args[0];
  return {reference => $ref};
}

sub reference_specification
{
  my ($self, @args) = @_;
  return {destination => {$args[0] => $args[1]}};
}

sub column_definition
{
  my ($self, @args) = @_;
  my $constrains = $args[2];
  undef $constrains if scalar(keys %$constrains) == 0;
  return {column => {name => $args[0],
                     type => $args[1],
                     constrains => $constrains}};
}

sub primary_key
{
  my ($self, @args) = @_;
  return {primary_key => JSON::true};
}

sub autoincrement
{
  my ($self, @args) = @_;
  return {autoincrement => JSON::true};
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

my $JSON = JSON->new->utf8->pretty->allow_nonref;
print $JSON->encode ($$value_ref);
