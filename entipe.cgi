#! /usr/bin/perl

######################################################################
package DEBUG;
use strict;
use warnings;
use Carp;
use Data::Dumper;

sub warn
{
  shift;
  my $msg = Dumper(@_);
  $msg =~ s/\n*$//;
  carp $msg;
  return @_;
}

######################################################################
package SESSION;
use strict;
use warnings;
use Carp;
use Time::HiRes qw(gettimeofday);
use integer;
use constant BITS_32 => 0xffffffff;

sub xorshift32
{
  my $x = int($_[0]) & BITS_32;
  $x ^= ($x << 13) & BITS_32;
  $x ^= ($x >> 17) & BITS_32;
  $x ^= ($x << 5) & BITS_32;
  return $x;
}

sub id
{
  croak "SCRIPT_FILENAME undefined" unless exists $ENV{SCRIPT_FILENAME};
  croak "REMOTE_PORT undefined" unless exists $ENV{REMOTE_PORT};

  my ($devid, $inode) = stat $ENV{SCRIPT_FILENAME};
  my $rport = int $ENV{REMOTE_PORT};
  my ($sec, $msec) = gettimeofday;

  my $r0 = xorshift32($$ * (1+{}) * $devid * $inode * $rport * $sec * $msec);
  my $r1 = xorshift32($r0);
  my $r2 = xorshift32($r1);
  my $r3 = xorshift32($r2);

  return sprintf ('%0.8X' x 4, $r0, $r1, $r2, $r3);
}

######################################################################
package CFG;
use strict;
use warnings;
use Carp;

sub set
{
  my $self = shift;
  my $value = pop;
  my $key = pop;
  return unless defined $key;
  return unless defined $value;
  for (@_) {
    $self->{$_} = {} unless exists $self->{$_};
    $self = $self->{$_};
  }
  $self->{$key} = $value;
  return $value;
}

sub get
{
  my $self = shift;
  my $key = pop;
  return unless defined $key;
  for (@_) {
    return unless exists $self->{$_};
    $self = $self->{$_};
  }
  return $self->{$key};
}

sub load
{
  my ($self, $file) = @_;

  open (my $cfg, '<', $file) || warn "Can not open file: $!";
  return unless defined $cfg;
  my @context = ();
  my $id = qr/[a-z_][a-z0-9_.-]*/;
  while (<$cfg>) {
    next if /^\s*[^!"\$\%\&]\/\(\)\[\]\{\}=\?*+~'#,;:<>|-]/;
    if (/^\s*(\.?)($id):\s*$/) {
      @context = () unless $1;
      push @context, split ('\.', $2);
      next;
    }
    if (/^\s*(\.?)($id)\s*=\s*(.+)\r?\n$/i) {
      @context = () unless $1;
      my @key = @context;
      push @key, split ('\.', $2);
      $self->set (@key, $3);
      next;
    }
  }
  close $cfg;
}

sub new
{
  my ($class, $file) = @_;
  my $self = bless {}, $class;

  $self->load ($file) if defined $file;

  return $self;
}

######################################################################
package SQL;

use strict;
use warnings;
use Marpa::R2;
use Data::Dumper; # TODO: replace this by DEBUG
use File::Map qw(map_file);
use JSON; # TODO: remove this dependency

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

sub first_key
{
  my ($hashref) = @_;
  my @keys = keys %$hashref;
  return $keys[0];
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

  my $lists = make_hash_by_name_of ('list', @tables);
  my $elements = make_hash_by_name_of ('element', @tables);
  my $entities = make_hash_by_name_of ('entity', @tables);

  # Convert list tables to types.
  for my $entity (values %$entities) {
    for my $ref (@{$entity->{references}}) {
      my $src = $ref->{source};
      die "Multi-value references are not supported" if scalar @$src > 1;
      if (scalar @$src == 1) {
        my $col = $entity->{columns}->{$src->[0]};
        die "Reference to non-id type" unless $col->{type} eq &TYPE_OF_ID_COLUMN;
        my $dst = first_key $ref->{destination};
        if ($dst =~ PREFIX_OF_LIST_TABLE) {
          $col->{cardinality} = '*';
          $col->{referee} = $1;
        } else {
          $col->{cardinality} = '?';
          $col->{referee} = $dst;
        }
        $col->{type} = 'reference';
      }
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

# Convert a relational model given by DDL statements into a record
# structure of nested hashes representing the logical model.
sub rel2log
{
  my ($ddl) = @_;

  map_file my $bnf, 'sql.marpa';

  my $grammar = Marpa::R2::Scanless::G->new ({
    bless_package => 'main',
    source => \$bnf});

  my $recce = Marpa::R2::Scanless::R->new ({grammar => $grammar});
  my $self = bless {grammar => $grammar};
  $self->{recce} = $recce;

  if (not defined eval { $recce->read(\$ddl); 1 })
  {
    die $self->show_last_expression(), "\n", $@;
  }

  my $value_ref = $recce->value ($self);
  if (not defined $value_ref) {
    die $self->show_last_expression(), "\n",
    "No parse was found, after reading the entire input\n";
  }

  return $$value_ref;
}


######################################################################
package RESPONSE;
use strict;
use warnings;
use Carp;

sub new
{
  my ($class, $type, $body) = @_;
  my $self = bless {type => $type, body => $body}, $class;
  return $self;
}

sub format
{
  my $self = shift;
  croak "type undefined" unless exists $self->{type};
  croak "body undefined" unless exists $self->{body};

  my ($time) = @_;
  $time = time unless defined $time;

  my @days = qw(Sun Mon Tue Wed Thu Fri Sat);
  my @months = qw(Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec);

  my ($sec,$min,$hour,$mday,$mon,$year,$wday) = gmtime($time);

  my $now = sprintf (
    "%s, %02d %s %d %02d:%02d:%02d GMT",
    $days[$wday], $mday, $months[$mon], $year+1900,
    $hour, $min, $sec);

  return join (
    "\r\n",
    "Content-length:".length($self->{body}),
    "Content-Type:".$self->{type}.";charset=utf-8",
    "Date:$now",
    "Expires:$now",
    "Cache-Control:max-age=0,no-cache,no-store",
    "Pragma:no-cache",
    "",
    $self->{body});
}

######################################################################
package SQLITE;
use strict;
use warnings;
use Carp;
use DBI;

sub new
{
  my ($class, $file) = @_;
  my $self = bless {}, $class;

  croak "file undefined" unless defined $file;

  my $source = join (':', 'dbi', 'SQLite', $file);
  $self->{dbh} = DBI->connect (
    $source,
    undef, undef, {
      RaiseError => 1,
      sqlite_unicode => 1
    }) || die $DBI::errstr;
  #$self->{dbh}->trace(2);

  return $self;
}

sub schema__
{
  my $self = shift;

  my $schema;

  # Get a list of all tables

  my $sth = $self->{dbh}->prepare (
    q{select name from sqlite_master where name not like 'sqlite_%'}) ||
    die "Can not prepare statement: " . $self->{dbh}->errstr;
  $sth->execute();
  my @tables = map { $_->[0] } @{$sth->fetchall_arrayref ()};
  $sth->finish();

  # Get a list of all rows for each table

  for my $table (@tables) {
    my $sql = 'pragma table_info('.$self->{dbh}->quote_identifier($table).')';
    my $sth = $self->{dbh}->prepare ($sql) ||
        die "Can not prepare statement: " . $self->{dbh}->errstr;
    $sth->execute();
    my $rows = $sth->fetchall_arrayref ({});
    $schema->{$table} = [grep { $_ ne 'id' } map { $_->{name} } @$rows];
    $sth->finish();
  }

  return $schema;
}

use constant SELECT_SCHEMA => <<';;';
SELECT group_concat(sql, ';' || char(10)) || ';'
FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'
;;

sub schema
{
  my $self = shift;

  my $schema;
  my $sth = $self->{dbh}->prepare (&SELECT_SCHEMA) ||
    die "Can not prepare statement: " . $self->{dbh}->errstr;
  $sth->execute();
  my $ddl = $sth->fetchall_arrayref()->[0]->[0];
  $sth->finish();

  return SQL::rel2log ($ddl);
}


sub query
{
  my $self = shift;
  my $sql  = shift;

  if ($sql =~ /^\s*select\b/i) {
    my $sth = $self->{dbh}->prepare ($sql) || die "prepare";
    $sth->execute(@_) || die "execute";
    my $result = $sth->fetchall_arrayref ({}) || die "fetch";
    $sth->finish || die "finish";
    return $result;
  }
  if ($sql =~ /^\s*update\b/i) {
    my $sth = $self->{dbh}->prepare ($sql);
    $sth->execute(@_);
    return;
  }
  if ($sql =~ /^\s*insert\b/i) {
    my $sth = $self->{dbh}->prepare ($sql);
    $sth->execute(@_);
    $sth->finish;
    $sth = $self->{dbh}->prepare ('SELECT last_insert_rowid() as id');
    $sth->execute();
    my $result = $sth->fetchall_arrayref ({});
    $sth->finish;
    return $result;
  }
}

sub disconnect
{
  my $self = shift;
  return $self->{dbh}->disconnect;
}

######################################################################
package main;

use strict;
use warnings;
use DBI;
use JSON;
use CGI::Carp;
use Parse::RecDescent;
use Encode qw(decode_utf8);

#DEBUG->warn (\%ENV);

#DEBUG->warn (SESSION->id);
#DEBUG->warn (SESSION->id);

# Must constraints

die "Gateway interface is not CGI/1.1"
    unless $ENV{GATEWAY_INTERFACE} =~ m{\bCGI/1.1\b}i;
die "Request is neither GET nor POST"
    unless $ENV{REQUEST_METHOD} eq 'GET' || $ENV{REQUEST_METHOD} eq 'POST';
die "Invalid query string"
    unless $ENV{QUERY_STRING} =~ /^[a-z][a-z0-9]*$/i;

my $APP = $ENV{QUERY_STRING};
my $CFG = CFG->new("$APP.cfg");
#DEBUG->warn ($CFG);

die "Application is unknown"
    unless exists $CFG->{app}->{$APP};

my $URL = $ENV{REQUEST_SCHEME} . '://'. $ENV{HTTP_HOST} . $ENV{REQUEST_URI};

# Should constraints

warn "Request is not encrypted"
    unless $ENV{REQUEST_SCHEME} =~ /^https$/i;

# Binary IO

binmode STDIN;
binmode STDOUT;

my $RESPONSE;

# Open database connection

die "Database driver undefined"
    unless exists $CFG->{app}->{$APP}->{db}->{driver};

my $DB;
if ($CFG->{app}->{$APP}->{db}->{driver} eq 'SQLite') {
  die "SQlite database file undefined"
      unless exists $CFG->{app}->{$APP}->{db}->{file};
  $DB = SQLITE->new ($CFG->{app}->{$APP}->{db}->{file});
} else {
  die "Unsupported driver " . $DB->{driver};
}

# JSON encoder

my $JSON = JSON->new->utf8->allow_nonref;

# Process GET request: deliver DAO objects.

if ($ENV{REQUEST_METHOD} eq 'GET')
{
  my $url = $JSON->encode ($URL);
  my $schema_json = $JSON->encode ($DB->schema);
  $RESPONSE = RESPONSE->new (
    'application/javascript',
    qq{var $APP = new Schema($url, $schema_json);});
}

# Process POST request: modify data.

elsif ($ENV{REQUEST_METHOD} eq 'POST')
{
  # Must constraints

  die "Content is not UTF-8 encoded SQL"
      unless $ENV{CONTENT_TYPE} =~ m{application/sql;[ ]*charset=utf-8}i;
  die "Content length is not numeric"
      unless $ENV{CONTENT_LENGTH} =~ /^\d+$/;

  # Read request

  my $content;
  my $n = read (STDIN, $content, $ENV{CONTENT_LENGTH});

  die "Content length ($ENV{CONTENT_LENGTH}) differs from the number of bytes read ($n)"
      unless $n == $ENV{CONTENT_LENGTH};

  my $sql = decode_utf8 $content;

  # Verify request

  warn "SQL verification not implemented";

  # Query database

  my $data = $DB->query($sql);
  DEBUG->warn($data);

  # Return response

  $RESPONSE = RESPONSE->new (
    'application/json',
    $JSON->encode ({result => 'ok',
                    data => $data}));
}

# Disconnect database.

$DB->disconnect;

# Deliver response.

END {
  if ($?) {
    $RESPONSE = RESPONSE->new (
      'application/json',
      $JSON->encode ({result => 'error'}));
  }
  print STDOUT DEBUG->warn($RESPONSE->format);
}

__DATA__

__END__
