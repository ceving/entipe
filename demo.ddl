-- -*- sql -*-

CREATE TABLE "ID"
(
  "num" integer PRIMARY KEY AUTOINCREMENT,
  "uuid" blob
);

CREATE TABLE "Address"
(
  "id"       integer,
  "street"   text,
  "locality" text,
  "country"  text,
  FOREIGN KEY ("id") REFERENCES "ID" ("num"),
  PRIMARY KEY ("id")
);

CREATE TABLE "Address :L"
(
  "id" integer,
  FOREIGN KEY ("id") REFERENCES "ID" ("num"),
  PRIMARY KEY ("id")
);

CREATE TABLE "Address :E"
(
  "list"    integer,
  "address" integer,
  FOREIGN KEY ("list")    REFERENCES "Address :L" ("id"),
  FOREIGN KEY ("address") REFERENCES "Address" ("id"),
  PRIMARY KEY ("list", "address")
);

CREATE TABLE "Person"
(
  "id"                   integer,
  "first name"           text,
  "last name"            text,
  "main residence"       integer,
  "secundary residences" integer,
  FOREIGN KEY ("main residence") REFERENCES "Address" ("id"),
  FOREIGN KEY ("secundary residences") REFERENCES "Address :L" ("id"),
  FOREIGN KEY ("id") REFERENCES "ID" ("num"),
  PRIMARY KEY ("id")
);
