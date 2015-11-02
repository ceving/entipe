#! /usr/bin/perl -CSDAL

use strict;
use warnings;
use DBI;
use Data::Dumper;
use Encode qw(decode_utf8);

sub trace {
    for (@_) {
        print Encode::is_utf8($_) ? 'UTF-8' : 'BINARY', ': ', Dumper ($_);
    }
}

#"select * from person where lastname = 'Schütte'";
my $sql = shift;

trace $sql;

#trace $sql, decode_utf8($sql);
#my $sql = decode_utf8($ARGV[0]);

my $dbh = DBI->connect(
    "dbi:SQLite:dbname=demo.sqlite3",
    "", # no user
    "", # no pw
    {
        RaiseError => 1,
        sqlite_unicode => 1
    },
) || die $DBI::errstr;
#$dbh->trace(2);

my $sth = $dbh->prepare($sql);
$sth->execute();

if ($sql =~ /^\s*select\b/i) {
  print Dumper ($sth->fetchall_arrayref({}));
}
elsif ($sql =~ /^\s*insert\b/i) {
  $sth->finish();
  $sth = $dbh->prepare('SELECT last_insert_rowid() as id');
  $sth->execute();
  print Dumper ($sth->fetchall_arrayref({}));
}

$sth->finish();
$dbh->disconnect();
