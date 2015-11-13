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

function new_peter()
{
  peter = new demo.person({firstname: "Peter", lastname: "Pan"});
  home = new demo.address({street: "Second to the right",
                           locality: "Straight on till morning",
                           country: "Neverland"});
}

$ (function () {
  //  demo.query (
  demo.person.select(
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

function dump() { console.debug(arguments); }

function clip (value, min, max)
{
  return value < min ? min : value > max ? max : value;
}

function movable (bounding_box, element_to_move, element_to_select)
{
  let bb = $(bounding_box);
  let em = bb.find(element_to_move);
  let es = em.find(element_to_select);

  bb = bb.get(0);
  em = em.get(0);
  es = es.get(0);

  console.debug ('bounding box', bb);
  console.debug ('element to move', em);
  console.debug ('element to select', es);

  if (!bb || !em || !es) return;

  function start (event)
  {
    bb.addEventListener ("mousemove", move_within, true);
    bb.addEventListener ("mouseup", stop_within, true);
    bb.addEventListener ("mouseleave", leave, true);

  }

  function move_within (event)
  {
    let left = clip (em.offsetLeft + event.movementX,
                     0, bb.clientWidth - em.offsetWidth);
    let top  = clip (em.offsetTop  + event.movementY,
                     0, bb.clientHeight - em.offsetHeight);

    em.style.left = left + "px";
    em.style.top  = top + "px";

    event.preventDefault ();
  }

  function move_outside (event)
  {
    event.preventDefault ();
  }

  function leave (event)
  {
    if (event.target === bb) {
      console.debug ("LEAVE", event);

      bb.removeEventListener ("mousemove", move_within, true);
      bb.removeEventListener ("mouseup", stop_within, true);
      bb.removeEventListener ("mouseleave", leave, true);

      document.addEventListener ("mousemove", move_outside, true);
      document.addEventListener ("mouseup", stop_outside, true);
    }
    event.preventDefault ();
  }

  function stop_within (event)
  {
    bb.removeEventListener ("mousemove", move_within, true);
    bb.removeEventListener ("mouseup", stop_within, true);
    bb.removeEventListener ("mouseleave", leave, true);

    event.preventDefault ();
  }

  function stop_outside (event)
  {
    document.removeEventListener ("mousemove", move_outside, true);
    document.removeEventListener ("mouseup", stop_outside, true);

    event.preventDefault ();
  }

  em.style.position = 'relative';
  es.addEventListener ("mousedown", start, true);
}

movable ('div.schema', 'table.entity', 'caption');


var fk1 = document.getElementById('fk1');

