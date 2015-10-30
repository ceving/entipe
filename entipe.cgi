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

sub schema
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

sub query
{
  my $self = shift;
  my $sql  = shift;

  my $sth = $self->{dbh}->prepare ($sql);
  $sth->execute(@_);
  my $result = $sth->fetchall_arrayref ({});
  $sth->finish;
  return $result;
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

DEBUG->warn (\%ENV);

DEBUG->warn (SESSION->id);
DEBUG->warn (SESSION->id);

# Must constraints

die "Gateway interface is not CGI/1.1"
    unless $ENV{GATEWAY_INTERFACE} =~ m{\bCGI/1.1\b}i;
die "Request is neither GET nor POST"
    unless $ENV{REQUEST_METHOD} eq 'GET' || $ENV{REQUEST_METHOD} eq 'POST';
die "Invalid query string"
    unless $ENV{QUERY_STRING} =~ /^[a-z][a-z0-9]*$/i;

my $APP = $ENV{QUERY_STRING};
my $CFG = CFG->new("$APP.cfg");
DEBUG->warn ($CFG);

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

my $JSON = JSON->new->utf8;

# Process GET request: deliver DAO objects.

if ($ENV{REQUEST_METHOD} eq 'GET')
{
  my $url = $JSON->allow_nonref->encode ($URL);
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
      unless $ENV{CONTENT_TYPE} =~ m{application/sql;[ ]+charset=utf-8}i;
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

  # Return response

  $RESPONSE = RESPONSE->new (
    'application/json',
    $JSON->encode ($data));
}

# Disconnect database.

$DB->disconnect;

# Deliver response.

print STDOUT DEBUG->warn($RESPONSE->format);

__DATA__

__END__
