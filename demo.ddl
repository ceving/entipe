-- -*- sql -*-

CREATE TABLE ":ID"
(
  ":int" integer PRIMARY KEY AUTOINCREMENT,
  ":uuid" blob
);

CREATE TABLE "Address"
(
  ":id"      integer,
  "street"   text,
  "locality" text,
  "country"  text,
  FOREIGN KEY (":id") REFERENCES ":ID" (":int"),
  PRIMARY KEY (":id")
);

CREATE TABLE ":LIST Address"
(
  ":id" integer,
  FOREIGN KEY (":id") REFERENCES ":ID" (":int"),
  PRIMARY KEY (":id")
);

CREATE TABLE ":ELEM Address"
(
  ":list" integer,
  ":elem" integer,
  FOREIGN KEY (":list") REFERENCES ":LIST Address" (":id"),
  FOREIGN KEY (":elem") REFERENCES "Address" (":id"),
  PRIMARY KEY (":list", ":elem")
);

CREATE TABLE "Person"
(
  ":id"                  integer,
  "first name"           text,
  "last name"            text,
  "main residence"       integer,
  "secundary residences" integer,
  FOREIGN KEY ("main residence") REFERENCES "Address" (":id"),
  FOREIGN KEY ("secundary residences") REFERENCES ":LIST Address" (":id"),
  FOREIGN KEY (":id") REFERENCES ":ID" (":int"),
  PRIMARY KEY (":id")
);
