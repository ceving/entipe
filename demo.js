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
var xy;

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
  xy = new demo.person({firstname: "X", lastname: "Y"});
});
