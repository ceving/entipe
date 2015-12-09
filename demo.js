"use strict";

function dump() { console.debug(arguments); }

function dbval (entity, id, attribute, value)
{
  return $ ('<span>')
    .addClass('dbval')
    .attr ('id', entity + '#' + id + '.' + attribute)
    .attr ('contenteditable', 'true')
    .append (value);
}


$ (function () {
  //  demo.query (
  demo.Person.select(
    null,
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

});
