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
      if (exists $element->{$child}) {
        $element = $element->{$child};
        my $name = $element->{name};
        delete $element->{name};
        $hash->{$name} = $element;
      }
    }
  }
  return $hash;
}

sub grep_hash_values
{
  my ($child, @args) = @_;
  return map { $_->{$child} } grep {exists $_->{$child}} @args;
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

sub unprefix_hash_keys
{
  my ($regex, $hash) = @_;
  for my $key (keys %$hash) {
    if ($key =~ $regex) {
      $hash->{$1} = $hash->{$key};
      delete $hash->{$key};
    }
  }
  return $hash;
}

use constant NAME_OF_ID_TABLE        => ':ID';

use constant NAME_OF_NUMID_COLUMN    => ':int';
use constant NAME_OF_UUID_COLUMN     => ':uuid';

use constant NAME_OF_ID_COLUMN       => ':id';
use constant NAME_OF_LIST_COLUMN     => ':list';
use constant NAME_OF_ELEMENT_COLUMN  => ':elem';

use constant TYPE_OF_ID_COLUMN       => 'integer';

use constant PREFIX_OF_LIST_TABLE    => qr/^:LIST (.+)$/;
use constant PREFIX_OF_ELEMENT_TABLE => qr/^:ELEM (.+)$/;

use constant QUOTE_OF_COLON_PREFIX   => '::';

sub ddl
{
  my ($self, undef, @tables) = @_;

  # Convert list tables to types.
  my $lists = make_hash_by_name_of ('list', @tables);
  my $elements = make_hash_by_name_of ('element', @tables);
  my $entities = make_hash_by_name_of ('entity', @tables);

  for my $entity (values %$entities) {
    print Dumper $entity;
    if (scalar @{$entity->{references}} == 0) {
      delete $entity->{references};
    }
  }

  # Lift columns
  for my $entity (keys %$entities) {
    $entities->{$entity} = $entities->{$entity}->{columns};
  }

  return $entities;
}

sub create_table
{
  my ($self, $name, $elements) = @_;

  # Ignore ID table.
  return if $name eq &NAME_OF_ID_TABLE;
  my $is_list;
  my $is_list_element;
  if ($name =~ &PREFIX_OF_LIST_TABLE) {
    $is_list = 1;
  }
  elsif ($name =~ &PREFIX_OF_ELEMENT_TABLE) {
    $is_list_element = 1;
  }

  my @columns = grep {exists $_->{column}} @$elements;
  my $columns = make_hash_by_name_of ('column', @columns);

  my @primary_key = grep {exists $_->{primary_key}} @$elements;
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

  # Remove implicit primary key column for all but the list element
  # helper table.
  die "No primary key in table " if scalar @primary_key == 0;
  if (!$is_list_element && scalar @primary_key == 1) {
    my $p = $primary_key[0];
    die "Primary key is called \"$p\" and not \"&NAME_OF_ID_COLUMN\" in table \"$name\""
        unless $p eq &NAME_OF_ID_COLUMN;
    die "Primary key type is not \"".&TYPE_OF_ID_COLUMN."\" in table \"$name\""
        unless $columns->{$p}->{type} eq &TYPE_OF_ID_COLUMN;
    @primary_key = ();
    delete $columns->{$p};
  }

  # Remove undefined column constrains.
  for my $c (keys %$columns) {
    delete $columns->{$c}->{constrains}
    unless (defined $columns->{$c}->{constrains} &&
            scalar ($columns->{$c}->{constrains}) > 0);
  }

  # Convert references to types.
  my @references = map {$_->{reference}} grep {exists $_->{reference}} @$elements;
  my $foreign_primary;
  @references = grep {
    my $src = $_->{source};
    my $dst = $_->{destination};
    if (!$is_list_element &&
        scalar @$src == 1 &&
        $src->[0] eq &NAME_OF_ID_COLUMN &&
        exists $dst->{&NAME_OF_ID_TABLE} &&
        scalar @{$dst->{&NAME_OF_ID_TABLE}} == 1 &&
        $dst->{&NAME_OF_ID_TABLE}->[0] eq &NAME_OF_NUMID_COLUMN) {
      $foreign_primary = 1;
      delete $columns->{&NAME_OF_ID_COLUMN};
      0;
    } else {
      1;
    }
  } @references;
  die "Table \"$name\" has no foreign primary key."
      unless $is_list_element || $foreign_primary;

  # Build table.
  my $table = {name => $name,
               columns => $columns,
               references => \@references};

  # Add optional unique attribute.
  my @unique = grep {exists $_->{unique}} @$elements;
  my $unique;
  $unique = "TODO" if scalar (@unique) > 0;
  $table->{unique} = $unique if defined $unique;

  # Add optional primary key.
  $table->{primary_key} = \@primary_key if scalar (@primary_key) > 0;

  return {$is_list ? 'list' : $is_list_element ? 'element' : 'entity' => $table};
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
