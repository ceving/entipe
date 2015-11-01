"use strict";

var o = {
  a: 7,
  get b() {
    return this.a + 1;
  },
  set c(x) {
    this.a = x / 2
  }
};


function dbval (entity, id, attribute, value)
{
  return $ ('<span>')
    .addClass('dbval')
    .attr ('id', entity + '#' + id + '.' + attribute)
    .attr ('contenteditable', 'true')
    .append (value);
}


var peter;
var home;

$ (function () {
  demo.query (
    "select * from person",
    function (data) {
      $.each (data, function (key, val) {
        console.log (val.id, val.firstname, val.lastname);
        $ ("#person").find('tbody')
          .append ($ ('<tr>')
                   .append ($ ('<td>').addClass("oplus").append ('&oplus;'))
                   .append ($ ('<td>').append (dbval ('person', val.id, 'firstname', val.firstname)))
                   .append ($ ('<td>').append (dbval ('person', val.id, 'lastname', val.lastname)))
                   .append ($ ('<td>').addClass("ominus").append ('&ominus;'))
                  );
      });
    });

  peter = new demo.person({firstname: "Peter", lastname: "Pan"});
  home = new demo.address({street: "Second to the right",
                           locality: "Straight on till morning",
                           country: "Neverland"});
});

function test1 () {
    var s = {};
    var a = {n:1, m:2};
    var i;
    
    for (i in a) {
      (function(i) {
        s[i] = function() { this[i] = a[i]; };
        console.log (s[i]);
      })(i);
    }
    
    var x = new s.n;
    var y = new s.m;
    
    console.log (x);
    console.log (y);
}

function test2 () {
    x = {};
    for (i of ['a', 'b']) {
      (function(i) {
        x[i] = function() { this.v = i; }
      })(i);
    }

    y = {};
    for (i of ['a', 'b']) {
      y[i] = function() { this.v = i; }
    }
}


var S = function(es)
{
  for (let e of es) {
    this[e] = function() {
      this.v = e;
    }
  }
}

var s = new S(['a', 'b']);
